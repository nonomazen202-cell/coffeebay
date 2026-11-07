/**
 * Comprehensive Acceptance Test Suite:
 * Coffee Bay Drink Rewards — Customer Journey, OTP Cooldown & Multi-Route Session Stabilization
 *
 * Exercises the REAL production services (`drinkOtpService`, `drinkCampaignService`) and
 * REAL Next.js App Router API Route Handlers (`otp/request`, `otp/verify`, `claim`, `session`)
 * plus server-side route guards (`evaluateRouteAccess` + `resolveJourneyState`) across all
 * 14 acceptance scenarios using an in-memory transactional PostgreSQL adapter (zero external SMS/DB side effects).
 */

import { NextRequest } from 'next/server';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { Payload } from 'payload';

import * as payloadLib from '../lib/payload';
import { rateLimiter } from '../lib/security/rate-limiter';
import { notificationService } from '../services/notification-service';
import { alertEmailService, type DrinkRewardAlertParams } from '../services/alert-email-service';
import { drinkOtpService } from '../services/drink-rewards/drink-otp-service';
import { drinkCampaignService } from '../services/drink-rewards/drink-campaign-service';
import { drinkRedemptionService } from '../services/drink-rewards/drink-redemption-service';
import {
  getDrinkRewardsCacheVersion,
  revalidateBranchesCache,
  revalidateDrinkCategoryCache,
  revalidateDrinkItemCache,
} from '../lib/cache/drink-rewards-cache';
import { POST as requestOtpRoute } from '../app/api/drink-rewards/otp/request/route';
import { POST as verifyOtpRoute } from '../app/api/drink-rewards/otp/verify/route';
import { POST as claimDrinkRoute } from '../app/api/drink-rewards/claim/route';
import { GET as getCampaignRoute } from '../app/api/drink-rewards/campaign/[slug]/route';
import {
  GET as getSessionRoute,
  PATCH as patchSessionRoute,
  DELETE as deleteSessionRoute,
} from '../app/api/drink-rewards/session/route';

// ─────────────────────────────────────────────────────────────────────────────
// Virtual Clock Controller (for deterministic cooldown & expiry testing)
// ─────────────────────────────────────────────────────────────────────────────

const RealDate = Date;
let virtualOffsetMs = 0;

class ControlledDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) {
      super(RealDate.now() + virtualOffsetMs);
    } else if (args.length === 1) {
      super(args[0] as string | number | Date);
    } else {
      super(
        args[0] as number,
        args[1] as number,
        (args[2] as number | undefined) ?? 1,
        (args[3] as number | undefined) ?? 0,
        (args[4] as number | undefined) ?? 0,
        (args[5] as number | undefined) ?? 0,
        (args[6] as number | undefined) ?? 0,
      );
    }
  }

  static override now(): number {
    return RealDate.now() + virtualOffsetMs;
  }
}

globalThis.Date = ControlledDate as DateConstructor;

function advanceClockMs(ms: number): void {
  virtualOffsetMs += ms;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stateful In-Memory Transactional PostgreSQL Simulator (with Advisory Locks)
// ─────────────────────────────────────────────────────────────────────────────

interface CampaignRow {
  id: number;
  slug: string;
  title: string;
  active: boolean;
  start_date: string;
  end_date: string;
  max_claims: number | null;
  total_claimed: number;
  allowed_category_ids: number[];
}

interface DrinkRow {
  id: number;
  name: string;
  category_id: number;
  active: boolean;
}

interface OtpChallengeRow {
  id: number;
  phone: string;
  campaign_id: number;
  code: string;
  expires_at: string;
  last_sent_at: string;
  attempts: number;
  verified_at: string | null;
  used_at: string | null;
  created_at: string;
  updated_at: string;
}

interface EntitlementRow {
  id: number;
  voucher_code: string;
  campaign_id: number;
  phone: string;
  customer_name: string;
  selected_drink_id: number;
  redeemed_drink_id?: number | null;
  branch_id?: number | null;
  cashier_id?: number | null;
  status: string;
  redeemed_at?: string | null;
  change_reason?: string | null;
  allowed_drinks_snapshot: string;
  issued_at: string;
  expires_at: string;
}

interface BranchRow {
  id: number;
  name: string;
  code: string;
  address?: string;
  active: boolean;
}

const pgDialect = new PgDialect();

const dbState = {
  nextChallengeId: 1,
  nextEntitlementId: 1,
  campaignMenuLoadCount: 0,
  campaigns: [] as CampaignRow[],
  drinks: [] as DrinkRow[],
  branches: [] as BranchRow[],
  challenges: [] as OtpChallengeRow[],
  entitlements: [] as EntitlementRow[],
};

// Real async mutex map simulating PostgreSQL `pg_advisory_xact_lock` & `SELECT ... FOR UPDATE`
const activeLocks = new Map<string, Promise<void>>();

async function acquireLock(lockKey: string): Promise<() => void> {
  while (activeLocks.has(lockKey)) {
    await activeLocks.get(lockKey);
  }
  let releaseFn: () => void = () => {};
  const lockPromise = new Promise<void>((resolve) => {
    releaseFn = () => {
      activeLocks.delete(lockKey);
      resolve();
    };
  });
  activeLocks.set(lockKey, lockPromise);
  return releaseFn;
}

// Notification Spies
interface SentOtpSms {
  phone: string;
  code: string;
  campaignSlug?: string;
}

interface SentVoucherSms {
  phone: string;
  voucherCode: string;
  drinkName: string;
}

const smsSpies = {
  otpMessages: [] as SentOtpSms[],
  voucherMessages: [] as SentVoucherSms[],
  adminEmails: [] as DrinkRewardAlertParams[],
};

notificationService.queueDrinkOtp = async (
  phone: string,
  otpCode: string,
  _txId: string,
  campaignSlug?: string,
): Promise<void> => {
  smsSpies.otpMessages.push({ phone, code: otpCode, campaignSlug });
};

notificationService.queueDrinkVoucher = async (
  data: {
    phone: string;
    customerName: string;
    voucherCode: string;
    drinkName: string;
    campaignTitle: string;
    expiresAt: string;
  },
): Promise<void> => {
  smsSpies.voucherMessages.push({
    phone: data.phone,
    voucherCode: data.voucherCode,
    drinkName: data.drinkName,
  });
};

alertEmailService.sendDrinkRewardAlert = async (
  params: DrinkRewardAlertParams,
): Promise<{ success: boolean }> => {
  smsSpies.adminEmails.push(params);
  return { success: true };
};

function resetDatabase(): void {
  virtualOffsetMs = 0;
  rateLimiter.reset();
  smsSpies.otpMessages = [];
  smsSpies.voucherMessages = [];
  smsSpies.adminEmails = [];
  dbState.nextChallengeId = 1;
  dbState.nextEntitlementId = 1;
  dbState.challenges = [];
  dbState.entitlements = [];

  const startIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const endIso = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();

  dbState.campaigns = [
    {
      id: 1,
      slug: 'cairo-opening',
      title: 'Cairo Flagship Opening',
      active: true,
      start_date: startIso,
      end_date: endIso,
      max_claims: 100,
      total_claimed: 0,
      allowed_category_ids: [10],
    },
    {
      id: 2,
      slug: 'alexandria-summer',
      title: 'Alexandria Summer Wave',
      active: true,
      start_date: startIso,
      end_date: endIso,
      max_claims: 50,
      total_claimed: 0,
      allowed_category_ids: [20],
    },
  ];

  dbState.drinks = [
    { id: 101, name: 'Iced Spanish Latte', category_id: 10, active: true },
    { id: 102, name: 'Salted Caramel Frappe', category_id: 10, active: true },
    { id: 201, name: 'Blue Lagoon Mojito', category_id: 20, active: true },
  ];

  dbState.branches = [
    {
      id: 1,
      name: 'Maadi Flagship',
      code: 'MAADI-01',
      address: 'Street 9, Maadi',
      active: true,
    },
    {
      id: 2,
      name: 'New Cairo Hub',
      code: 'CAIRO-01',
      address: 'North 90th Street, New Cairo',
      active: true,
    },
  ];
}

function createTxExecutor(txReleases: (() => void)[]) {
  return {
    execute: async (
      queryObj: unknown,
    ): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> => {
      const { sql: rawSql, params } = pgDialect.sqlToQuery(queryObj as SQL);
      const q = rawSql.replace(/\s+/g, ' ').trim().toLowerCase();
      const nowIso = new Date().toISOString();

      // 1. Advisory lock
      if (q.includes('pg_advisory_xact_lock')) {
        const key = `advisory:${String(params[0])}:${String(params[1])}`;
        const release = await acquireLock(key);
        txReleases.push(release);
        // Yield microtask so concurrent callers genuinely queue behind the lock
        await new Promise((r) => setTimeout(r, 2));
        return { rows: [{}], rowCount: 1 };
      }

      // 2. Campaign row lock / quota check
      if (q.includes('from drink_campaigns') && !q.includes('drink_campaigns_rels')) {
        const campId = Number(params[0]);
        if (q.includes('for update')) {
          const release = await acquireLock(`campaign:${campId}`);
          txReleases.push(release);
          await new Promise((r) => setTimeout(r, 2));
        }
        const camp = dbState.campaigns.find((c) => c.id === campId);
        if (!camp) return { rows: [], rowCount: 0 };
        return { rows: [{ ...camp }], rowCount: 1 };
      }

      // 3. Campaign allowed categories / allowed branches relation query
      if (q.includes('from drink_campaigns_rels')) {
        const campId = Number(params[0]);
        if (q.includes('allowed_branches')) {
          return {
            rows: [
              { branches_id: 1, name: 'Maadi Flagship' },
              { branches_id: 2, name: 'New Cairo Hub' },
            ],
            rowCount: 2,
          };
        }
        const camp = dbState.campaigns.find((c) => c.id === campId);
        const rows = (camp?.allowed_category_ids || []).map((cid) => ({
          drink_categories_id: cid,
        }));
        return { rows, rowCount: rows.length };
      }

      // 4. Entitlement lookup by voucher_code (collision check or cashier FOR UPDATE lock)
      if (q.includes('from drink_entitlements') && q.includes('voucher_code =')) {
        const code = String(params[0]);
        if (q.includes('for update')) {
          const release = await acquireLock(`entitlement:${code}`);
          txReleases.push(release);
          await new Promise((r) => setTimeout(r, 2));
        }
        const found = dbState.entitlements.filter((e) => e.voucher_code === code);
        return {
          rows: found.map((e) => {
            const camp = dbState.campaigns.find((c) => c.id === e.campaign_id);
            return {
              ...e,
              campaign_title: camp?.title || 'Drink Campaign',
            };
          }),
          rowCount: found.length,
        };
      }

      // 5. Entitlement lookup by (campaign_id, phone) joined with drinks
      if (q.includes('from drink_entitlements') && q.includes('join drinks')) {
        const campId = Number(params[0]);
        const phone = String(params[1]);
        const ent = dbState.entitlements.find(
          (e) => e.campaign_id === campId && e.phone === phone,
        );
        if (!ent) return { rows: [], rowCount: 0 };
        const effectiveDrinkId = ent.redeemed_drink_id ?? ent.selected_drink_id;
        const drink = dbState.drinks.find((d) => d.id === effectiveDrinkId);
        return {
          rows: [
            {
              ...ent,
              drink_name: drink?.name || 'Coffee Bay Drink',
              drink_image_url: `/media/drink-${effectiveDrinkId}.png`,
              branch_name: ent.branch_id === 2 ? 'New Cairo Hub' : ent.branch_id === 1 ? 'Maadi Flagship' : null,
            },
          ],
          rowCount: 1,
        };
      }

      // 5b. Update DrinkEntitlement (Redemption or Expiration stamp)
      if (q.startsWith('update drink_entitlements')) {
        if (q.includes("set status = 'expired'")) {
          const entId = Number(params[0]);
          const ent = dbState.entitlements.find((e) => e.id === entId);
          if (ent) {
            ent.status = 'EXPIRED';
          }
          return { rows: [], rowCount: ent ? 1 : 0 };
        }
        if (q.includes("set status = 'redeemed'")) {
          const finalDrinkId = Number(params[0]);
          const branchId = Number(params[1]);
          const cashierId = Number(params[2]);
          const redeemedAt = String(params[3]);
          const changeReason = params[4] !== null && params[4] !== undefined ? String(params[4]) : null;
          const entId = Number(params[5]);
          const ent = dbState.entitlements.find(
            (e) => e.id === entId && e.status === 'ISSUED',
          );
          if (!ent) {
            return { rows: [], rowCount: 0 };
          }
          ent.status = 'REDEEMED';
          ent.redeemed_drink_id = finalDrinkId;
          ent.branch_id = branchId;
          ent.cashier_id = cashierId;
          ent.redeemed_at = redeemedAt;
          ent.change_reason = changeReason;
          return { rows: [{ id: ent.id }], rowCount: 1 };
        }
      }

      // 6. Insert DrinkEntitlement
      if (q.startsWith('insert into drink_entitlements')) {
        const row: EntitlementRow = {
          id: dbState.nextEntitlementId++,
          voucher_code: String(params[0]),
          campaign_id: Number(params[1]),
          phone: String(params[2]),
          customer_name: String(params[3]),
          selected_drink_id: Number(params[4]),
          branch_id: params[5] !== null && params[5] !== undefined ? Number(params[5]) : null,
          status: 'ISSUED',
          allowed_drinks_snapshot: String(params[6]),
          issued_at: String(params[7]),
          expires_at: String(params[8]),
        };
        dbState.entitlements.push(row);
        return { rows: [{ id: row.id }], rowCount: 1 };
      }

      // 7. Increment campaign total_claimed
      if (q.startsWith('update drink_campaigns set total_claimed')) {
        const campId = Number(params[0]);
        const camp = dbState.campaigns.find((c) => c.id === campId);
        if (camp) {
          camp.total_claimed += 1;
        }
        return { rows: [], rowCount: camp ? 1 : 0 };
      }

      // 7b. Select branches
      if (q.includes('from branches')) {
        if (q.includes('where id =')) {
          const branchId = Number(params[0]);
          const branch = dbState.branches.find((b) => b.id === branchId && b.active);
          return {
            rows: branch ? [{ id: branch.id, name: branch.name }] : [],
            rowCount: branch ? 1 : 0,
          };
        }
        const activeBranches = dbState.branches
          .filter((b) => b.active)
          .map((b) => ({ id: b.id, name: b.name }));
        return {
          rows: activeBranches,
          rowCount: activeBranches.length,
        };
      }

      // 8. Select drinks
      if (q.includes('from drinks')) {
        if (q.includes('where id =') || q.includes('where d.id =')) {
          const drinkId = Number(params[0]);
          const drink = dbState.drinks.find((d) => d.id === drinkId && d.active);
          return {
            rows: drink
              ? [{ ...drink, drink_image_url: `/media/drink-${drink.id}.png` }]
              : [],
            rowCount: drink ? 1 : 0,
          };
        }
        if (q.includes('category_id in')) {
          const catIds = params.map((p) => Number(p));
          const matching = dbState.drinks.filter(
            (d) => d.active && catIds.includes(d.category_id),
          );
          return {
            rows: matching.map((d) => ({ id: d.id })),
            rowCount: matching.length,
          };
        }
      }

      // 9. Select OTP challenges
      if (q.includes('from drink_otp_challenges')) {
        // Case A: WHERE id = $1 AND phone = $2 AND campaign_id = $3 ...
        if (q.includes('where id =') && q.includes('campaign_id =')) {
          const id = Number(params[0]);
          const phone = String(params[1]);
          const campId = Number(params[2]);
          const mustBeUnused = q.includes('used_at is null');
          const mustBeVerified = q.includes('verified_at is not null');
          const found = dbState.challenges.find(
            (c) =>
              c.id === id &&
              c.phone === phone &&
              c.campaign_id === campId &&
              (!mustBeUnused || c.used_at === null) &&
              (!mustBeVerified || c.verified_at !== null),
          );
          return { rows: found ? [{ ...found }] : [], rowCount: found ? 1 : 0 };
        }

        // Case B: Claim check WHERE id = $1 AND phone = $2 AND verified_at IS NOT NULL AND used_at IS NULL
        if (q.includes('where id =') && !q.includes('campaign_id =')) {
          const id = Number(params[0]);
          const phone = String(params[1]);
          const found = dbState.challenges.find(
            (c) =>
              c.id === id &&
              c.phone === phone &&
              c.verified_at !== null &&
              c.used_at === null,
          );
          return { rows: found ? [{ ...found }] : [], rowCount: found ? 1 : 0 };
        }

        // Case C: WHERE phone = $1 AND campaign_id = $2 ...
        const phone = String(params[0]);
        const campId = Number(params[1]);
        const mustBeUnused = q.includes('used_at is null');
        const list = dbState.challenges
          .filter(
            (c) =>
              c.phone === phone &&
              c.campaign_id === campId &&
              (!mustBeUnused || c.used_at === null),
          )
          .sort((a, b) => {
            if (q.includes('order by last_sent_at desc')) {
              return Date.parse(b.last_sent_at) - Date.parse(a.last_sent_at);
            }
            return b.id - a.id;
          });

        return {
          rows: list.length > 0 ? [{ ...list[0] }] : [],
          rowCount: list.length > 0 ? 1 : 0,
        };
      }

      // 10. Insert OTP challenge
      if (q.startsWith('insert into drink_otp_challenges')) {
        const row: OtpChallengeRow = {
          id: dbState.nextChallengeId++,
          phone: String(params[0]),
          campaign_id: Number(params[1]),
          code: String(params[2]),
          expires_at: String(params[3]),
          last_sent_at: String(params[4]),
          attempts: 0,
          verified_at: null,
          used_at: null,
          created_at: nowIso,
          updated_at: nowIso,
        };
        dbState.challenges.push(row);
        return { rows: [{ id: row.id }], rowCount: 1 };
      }

      // 11. Update OTP challenges
      if (q.startsWith('update drink_otp_challenges')) {
        // Bulk invalidate unconsumed challenges for (phone, campaign_id)
        if (q.includes('where phone =') && q.includes('campaign_id =')) {
          const phone = String(params[0]);
          const campId = Number(params[1]);
          let updated = 0;
          for (const ch of dbState.challenges) {
            if (ch.phone === phone && ch.campaign_id === campId && ch.used_at === null) {
              ch.used_at = nowIso;
              ch.updated_at = nowIso;
              updated++;
            }
          }
          return { rows: [], rowCount: updated };
        }

        // Update attempts + used_at
        if (q.includes('set attempts =') && q.includes('used_at =')) {
          const attempts = Number(params[0]);
          const usedAt = String(params[1]);
          const id = Number(params[2]);
          const ch = dbState.challenges.find((c) => c.id === id);
          if (ch) {
            ch.attempts = attempts;
            ch.used_at = usedAt;
            ch.updated_at = nowIso;
          }
          return { rows: [], rowCount: ch ? 1 : 0 };
        }

        // Update attempts only
        if (q.includes('set attempts =')) {
          const attempts = Number(params[0]);
          const id = Number(params[1]);
          const ch = dbState.challenges.find((c) => c.id === id);
          if (ch) {
            ch.attempts = attempts;
            ch.updated_at = nowIso;
          }
          return { rows: [], rowCount: ch ? 1 : 0 };
        }

        // Update verified_at
        if (q.includes('set verified_at =')) {
          const verifiedAt = String(params[0]);
          const id = Number(params[1]);
          const ch = dbState.challenges.find((c) => c.id === id);
          if (ch) {
            ch.verified_at = verifiedAt;
            ch.updated_at = nowIso;
          }
          return { rows: [], rowCount: ch ? 1 : 0 };
        }

        // Update used_at (either NOW() with 1 param or $1 with 2 params)
        if (q.includes('set used_at =')) {
          const hasExplicitTimestamp = params.length === 2;
          const usedAt = hasExplicitTimestamp ? String(params[0]) : nowIso;
          const id = Number(hasExplicitTimestamp ? params[1] : params[0]);
          const ch = dbState.challenges.find((c) => c.id === id);
          if (ch) {
            ch.used_at = usedAt;
            ch.updated_at = nowIso;
          }
          return { rows: [], rowCount: ch ? 1 : 0 };
        }
      }

      throw new Error(`Unhandled SQL in test adapter: ${rawSql}`);
    },
  };
}

const rootExecutor = createTxExecutor([]);

const mockPayload = {
  db: {
    beginTransaction: async () => 'tx-1',
    commitTransaction: async () => {},
    rollbackTransaction: async () => {},
    drizzle: {
      execute: rootExecutor.execute,
      transaction: async <T>(
        fn: (tx: { execute: typeof rootExecutor.execute }) => Promise<T>,
      ): Promise<T> => {
        const txReleases: (() => void)[] = [];
        const txExec = createTxExecutor(txReleases);
        try {
          return await fn(txExec);
        } finally {
          for (const rel of txReleases.reverse()) {
            rel();
          }
        }
      },
    },
  },
  find: async (args: {
    collection: string;
    depth?: number;
    where?: { slug?: { equals?: string }; active?: { equals?: boolean } };
  }) => {
    if (args.collection === 'drink-campaigns') {
      if ((args.depth ?? 0) > 0) {
        dbState.campaignMenuLoadCount += 1;
      }
      const targetSlug = args.where?.slug?.equals?.trim().toLowerCase();
      const found = dbState.campaigns
        .filter((c) => !targetSlug || c.slug.toLowerCase() === targetSlug)
        .map((c) => ({
          ...c,
          allowed_categories: c.allowed_category_ids.map((cid) => ({
            id: cid,
            name: cid === 10 ? 'Hot & Iced Signatures' : 'Summer Refreshers',
            slug: cid === 10 ? 'signatures' : 'refreshers',
            active: true,
          })),
          allowed_branches: [],
        }));
      return { docs: found, totalDocs: found.length };
    }
    if (args.collection === 'branches') {
      const activeBranches = dbState.branches.filter((b) => b.active);
      return { docs: activeBranches, totalDocs: activeBranches.length };
    }
    if (args.collection === 'drinks') {
      const activeDrinks = dbState.drinks
        .filter((d) => d.active)
        .map((d) => ({
          id: d.id,
          name: d.name,
          category: d.category_id,
          active: d.active,
          image: { url: `/media/drink-${d.id}.png` },
        }));
      return { docs: activeDrinks, totalDocs: activeDrinks.length };
    }
    return { docs: [], totalDocs: 0 };
  },
} as unknown as Payload;

payloadLib.setPayloadClientForTesting(mockPayload);

// ─────────────────────────────────────────────────────────────────────────────
// Simulated Browser Cookie Jar (enforcing HttpOnly cookie isolation per browser)
// ─────────────────────────────────────────────────────────────────────────────

class BrowserSessionJar {
  private cookies = new Map<string, string>();
  public readonly ip: string;

  constructor(ip: string) {
    this.ip = ip;
  }

  getCookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  buildCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  ingestResponseCookies(res: Response): string[] {
    const rawHeaders = res.headers.getSetCookie();
    for (const header of rawHeaders) {
      const firstPart = header.split(';')[0] || '';
      const eqIdx = firstPart.indexOf('=');
      if (eqIdx === -1) continue;
      const name = firstPart.slice(0, eqIdx).trim();
      const val = firstPart.slice(eqIdx + 1).trim();

      if (header.toLowerCase().includes('max-age=0') || val === '') {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, val);
      }
    }
    return rawHeaders;
  }

  async postJson<T>(
    url: string,
    handler: (req: NextRequest) => Promise<Response>,
    body: Record<string, unknown>,
  ): Promise<{ status: number; data: T; setCookies: string[] }> {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'x-forwarded-for': this.ip,
    });
    const cookieHeader = this.buildCookieHeader();
    if (cookieHeader) {
      headers.set('cookie', cookieHeader);
    }

    const req = new NextRequest(new URL(url, 'http://localhost:3000'), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const res = await handler(req);
    const setCookies = this.ingestResponseCookies(res);
    const data = (await res.json()) as T;
    return { status: res.status, data, setCookies };
  }

  async patchJson<T>(
    url: string,
    handler: (req: NextRequest) => Promise<Response>,
    body: Record<string, unknown>,
  ): Promise<{ status: number; data: T; setCookies: string[] }> {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'x-forwarded-for': this.ip,
    });
    const cookieHeader = this.buildCookieHeader();
    if (cookieHeader) {
      headers.set('cookie', cookieHeader);
    }

    const req = new NextRequest(new URL(url, 'http://localhost:3000'), {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    const res = await handler(req);
    const setCookies = this.ingestResponseCookies(res);
    const data = (await res.json()) as T;
    return { status: res.status, data, setCookies };
  }

  async getReq<T>(
    url: string,
    handler: (req: NextRequest) => Promise<Response>,
  ): Promise<{ status: number; data: T; setCookies: string[] }> {
    const headers = new Headers({ 'x-forwarded-for': this.ip });
    const cookieHeader = this.buildCookieHeader();
    if (cookieHeader) {
      headers.set('cookie', cookieHeader);
    }
    const req = new NextRequest(new URL(url, 'http://localhost:3000'), {
      method: 'GET',
      headers,
    });
    const res = await handler(req);
    const setCookies = this.ingestResponseCookies(res);
    const data = (await res.json()) as T;
    return { status: res.status, data, setCookies };
  }

  async deleteReq<T>(
    url: string,
    handler: (req: NextRequest) => Promise<Response>,
  ): Promise<{ status: number; data: T; setCookies: string[] }> {
    const headers = new Headers({ 'x-forwarded-for': this.ip });
    const cookieHeader = this.buildCookieHeader();
    if (cookieHeader) {
      headers.set('cookie', cookieHeader);
    }
    const req = new NextRequest(new URL(url, 'http://localhost:3000'), {
      method: 'DELETE',
      headers,
    });
    const res = await handler(req);
    const setCookies = this.ingestResponseCookies(res);
    const data = (await res.json()) as T;
    return { status: res.status, data, setCookies };
  }

  async visitServerRoute(
    campaignSlug: string,
    stage: 'DETAILS' | 'VERIFY' | 'CHOOSE_DRINK' | 'SUCCESS',
    options?: { allowWelcomeWhenClaimed?: boolean },
  ) {
    const campHeader = await drinkOtpService.getCampaignHeaderBySlug(campaignSlug);
    if (!campHeader) {
      throw new Error(`Campaign not found: ${campaignSlug}`);
    }
    const cookieName = drinkOtpService.getJourneyCookieName(campaignSlug);
    const rawCookie = this.getCookie(cookieName);
    const journey = await drinkOtpService.resolveJourneyState(campHeader, rawCookie);
    const access = drinkOtpService.evaluateRouteAccess(
      campaignSlug,
      stage,
      journey,
      options,
    );
    return { journey, access };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Acceptance Scenarios Runner
// ─────────────────────────────────────────────────────────────────────────────

async function runAcceptanceSuite(): Promise<void> {
  console.log('======================================================================');
  console.log('🧪 COFFEE BAY DRINK REWARDS — 14-SCENARIO ACCEPTANCE SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(label: string, condition: boolean, detail?: string): void {
    if (condition) {
      console.log(`✅ PASS: ${label}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
      failed++;
    }
  }

  resetDatabase();
  const browserA = new BrowserSessionJar('197.55.10.1');
  const browserB = new BrowserSessionJar('197.55.10.2');

  // ── Scenario 10a (Pre-start): Opening /choose-drink or /verify with no session is blocked
  {
    const unauthChoose = await browserA.visitServerRoute('cairo-opening', 'CHOOSE_DRINK');
    const unauthVerify = await browserA.visitServerRoute('cairo-opening', 'VERIFY');
    const unauthSuccess = await browserA.visitServerRoute('cairo-opening', 'SUCCESS');

    assert(
      'Scenario 10a: Direct visit to /choose-drink before starting is blocked by server guard',
      !unauthChoose.access.allowed &&
        unauthChoose.access.redirectTo === '/drink-rewards/cairo-opening',
    );
    assert(
      'Scenario 6a: Direct visit to /verify with no session redirects to Step 1 (?step=details)',
      !unauthVerify.access.allowed &&
        unauthVerify.access.redirectTo === '/drink-rewards/cairo-opening?step=details',
    );
    assert(
      'Scenario 10b: Direct visit to /success without entitlement is blocked by server guard',
      !unauthSuccess.access.allowed &&
        unauthSuccess.access.redirectTo === '/drink-rewards/cairo-opening',
    );
  }

  // ── Scenario 1: First-time OTP request
  {
    const res = await browserA.postJson<{
      success: boolean;
      resumed?: boolean;
      nextStep?: string;
      expiresAt?: string;
      resendAvailableAt?: string;
      serverNow?: string;
    }>('/api/drink-rewards/otp/request', requestOtpRoute, {
      customerName: 'Ahmed Mansour',
      phone: '01012345678',
      selectedBranchId: 1,
      campaignSlug: 'cairo-opening',
      intent: 'start',
    });

    const cookieName = drinkOtpService.getJourneyCookieName('cairo-opening');
    const rawCookie = browserA.getCookie(cookieName) || '';
    const otpSent = smsSpies.otpMessages[0]?.code || '';

    assert(
      'Scenario 1a: First OTP request succeeds (200) and dispatches 1 SMS',
      res.status === 200 &&
        res.data.success === true &&
        res.data.resumed === false &&
        res.data.nextStep === 'VERIFY' &&
        smsSpies.otpMessages.length === 1,
    );
    assert(
      'Scenario 1b: Sets HttpOnly, SameSite=Lax AES-256-GCM encrypted cookie (NO plaintext phone, name, or OTP code anywhere in cookie)',
      res.setCookies.some(
        (c) =>
          c.includes(`${cookieName}=`) &&
          c.toLowerCase().includes('httponly') &&
          c.toLowerCase().includes('samesite=lax'),
      ) &&
        rawCookie.startsWith('enc.') &&
        !rawCookie.includes('01012345678') &&
        !rawCookie.includes('Ahmed') &&
        !rawCookie.includes(otpSent),
    );
  }

  // ── Scenario 2: Leave /verify and return after 6 seconds
  {
    advanceClockMs(6_000);
    const { journey, access } = await browserA.visitServerRoute('cairo-opening', 'VERIFY');
    const remainingCooldownSec = Math.ceil(
      (Date.parse(journey.resendAvailableAt || '') - Date.now()) / 1000,
    );
    const remainingExpirySec = Math.ceil(
      (Date.parse(journey.expiresAt || '') - Date.now()) / 1000,
    );

    assert(
      'Scenario 2: Returning to /verify after 6s restores exact remaining cooldown (54s) & expiry (294s) with 0 new SMS',
      access.allowed === true &&
        journey.stage === 'PENDING_OTP' &&
        remainingCooldownSec === 54 &&
        remainingExpirySec === 294 &&
        smsSpies.otpMessages.length === 1,
      `cooldown=${remainingCooldownSec}, expiry=${remainingExpirySec}`,
    );
  }

  // ── Scenario 3: Page Refresh (F5) while waiting for OTP
  {
    advanceClockMs(4_000); // Now at t = +10s
    const { journey, access } = await browserA.visitServerRoute('cairo-opening', 'VERIFY');
    const remainingCooldownSec = Math.ceil(
      (Date.parse(journey.resendAvailableAt || '') - Date.now()) / 1000,
    );

    assert(
      'Scenario 3: Refreshing /verify at +10s preserves customerName, phone, branch, challengeId & 50s cooldown',
      access.allowed === true &&
        journey.stage === 'PENDING_OTP' &&
        journey.customerName === 'Ahmed Mansour' &&
        journey.selectedBranchId === 1 &&
        remainingCooldownSec === 50 &&
        smsSpies.otpMessages.length === 1,
    );
  }

  // ── Scenario 4: Go back to Customer Details (/drink-rewards/cairo-opening) and return to /verify
  {
    const step1 = await browserA.visitServerRoute('cairo-opening', 'DETAILS');
    assert(
      'Scenario 4a: Going Back to Step 1 restores customer details without wiping session',
      step1.access.allowed === true &&
        step1.journey.customerName === 'Ahmed Mansour' &&
        step1.journey.phone.endsWith('1012345678'),
    );

    // User even clicks "Claim My Reward" submit button again on Step 1 with same phone (updated name)
    const resubmit = await browserA.postJson<{
      success: boolean;
      resumed?: boolean;
      nextStep?: string;
      reason?: string;
      resendAvailableAt?: string;
    }>('/api/drink-rewards/otp/request', requestOtpRoute, {
      customerName: 'Ahmed M. Mansour',
      phone: '01012345678',
      selectedBranchId: 2,
      campaignSlug: 'cairo-opening',
      intent: 'start',
    });

    assert(
      'Scenario 4b: Re-submitting Step 1 with same phone silently resumes challenge (NO 429 cooldown error, 0 new SMS!)',
      resubmit.status === 200 &&
        resubmit.data.success === true &&
        resubmit.data.resumed === true &&
        resubmit.data.nextStep === 'VERIFY' &&
        smsSpies.otpMessages.length === 1,
      `status=${resubmit.status}, reason=${resubmit.data.reason}`,
    );
  }

  // ── Scenario 5: Direct URL visit to /verify in same browser
  {
    const directVerify = await browserA.visitServerRoute('cairo-opening', 'VERIFY');
    assert(
      'Scenario 5: Opening /drink-rewards/cairo-opening/verify directly in same browser restores updated name & branch + challenge',
      directVerify.access.allowed === true &&
        directVerify.journey.stage === 'PENDING_OTP' &&
        directVerify.journey.customerName === 'Ahmed M. Mansour' &&
        directVerify.journey.selectedBranchId === 2,
    );
  }

  // ── Scenario 6 & 10c: Opening /verify or /choose-drink in ANOTHER browser (or before verification)
  {
    const otherBrowserVerify = await browserB.visitServerRoute('cairo-opening', 'VERIFY');
    const pendingChooseAttempt = await browserA.visitServerRoute(
      'cairo-opening',
      'CHOOSE_DRINK',
    );
    const prematureClaimApi = await browserA.postJson<{
      success: boolean;
      reason?: string;
    }>('/api/drink-rewards/claim', claimDrinkRoute, {
      selectedDrinkId: 101,
      campaignSlug: 'cairo-opening',
    });

    assert(
      'Scenario 6b: Opening /verify in a different browser cannot borrow active OTP session',
      !otherBrowserVerify.access.allowed &&
        otherBrowserVerify.journey.stage === 'UNINITIALIZED',
    );
    assert(
      'Scenario 10c: Typing /choose-drink while OTP is still pending redirects to /verify and API rejects claim (401)',
      !pendingChooseAttempt.access.allowed &&
        pendingChooseAttempt.access.redirectTo ===
          '/drink-rewards/cairo-opening/verify' &&
        prematureClaimApi.status === 401 &&
        prematureClaimApi.data.reason === 'INVALID_SESSION',
    );
  }

  // ── Scenario 7: Resend blocked during cooldown, then allowed once 60s cooldown finishes
  {
    // Still at t = +10s (50s cooldown left) -> explicit resend click MUST return 429 COOLDOWN_ACTIVE
    const earlyResend = await browserA.postJson<{
      success: boolean;
      reason?: string;
    }>('/api/drink-rewards/otp/request', requestOtpRoute, {
      campaignSlug: 'cairo-opening',
      intent: 'resend',
    });

    assert(
      'Scenario 7a: Explicit Resend click BEFORE 60s cooldown finishes returns 429 COOLDOWN_ACTIVE',
      earlyResend.status === 429 && earlyResend.data.reason === 'COOLDOWN_ACTIVE',
    );

    // Advance +51s -> total elapsed = 61s (cooldown finished!)
    advanceClockMs(51_000);
    const validResend = await browserA.postJson<{
      success: boolean;
      resumed?: boolean;
      challengeId?: number;
    }>('/api/drink-rewards/otp/request', requestOtpRoute, {
      campaignSlug: 'cairo-opening',
      intent: 'resend',
    });

    assert(
      'Scenario 7b: After 60s cooldown expires, Resend issues new OTP challenge & invalidates previous code',
      validResend.status === 200 &&
        validResend.data.success === true &&
        validResend.data.resumed === false &&
        smsSpies.otpMessages.length === 2 &&
        dbState.challenges[0]?.used_at !== null,
    );
  }

  // ── Scenario 13: Multi-tab concurrent Resend requests race condition test
  {
    advanceClockMs(61_000); // Let second challenge's 60s cooldown expire
    const smsCountBefore = smsSpies.otpMessages.length;

    // Fire 4 concurrent resend requests from 4 tabs of Browser A at the exact same instant
    const concurrentResults = await Promise.all([
      browserA.postJson<{ success: boolean; reason?: string }>(
        '/api/drink-rewards/otp/request',
        requestOtpRoute,
        { campaignSlug: 'cairo-opening', intent: 'resend' },
      ),
      browserA.postJson<{ success: boolean; reason?: string }>(
        '/api/drink-rewards/otp/request',
        requestOtpRoute,
        { campaignSlug: 'cairo-opening', intent: 'resend' },
      ),
      browserA.postJson<{ success: boolean; reason?: string }>(
        '/api/drink-rewards/otp/request',
        requestOtpRoute,
        { campaignSlug: 'cairo-opening', intent: 'resend' },
      ),
      browserA.postJson<{ success: boolean; reason?: string }>(
        '/api/drink-rewards/otp/request',
        requestOtpRoute,
        { campaignSlug: 'cairo-opening', intent: 'resend' },
      ),
    ]);

    const successCount = concurrentResults.filter(
      (r) => r.status === 200 && r.data.success,
    ).length;
    const cooldownBlockedCount = concurrentResults.filter(
      (r) => r.status === 429 && r.data.reason === 'COOLDOWN_ACTIVE',
    ).length;
    const rateLimitedCount = concurrentResults.filter(
      (r) => r.status === 429 && r.data.reason === 'RATE_LIMITED',
    ).length;

    // Two independent defenses: per-phone rate limit (3/min) rejects excess requests before the DB,
    // and the PostgreSQL advisory lock serializes the rest so only one challenge is issued.
    assert(
      'Scenario 13: 4 concurrent multi-tab Resend requests -> exactly 1 SMS; others blocked (advisory-lock COOLDOWN_ACTIVE ≥1 + phone RATE_LIMITED)',
      successCount === 1 &&
        cooldownBlockedCount >= 1 &&
        cooldownBlockedCount + rateLimitedCount === 3 &&
        smsSpies.otpMessages.length === smsCountBefore + 1,
      `success=${successCount}, cooldown=${cooldownBlockedCount}, rateLimited=${rateLimitedCount}`,
    );
  }

  // ── Scenario 8: OTP 5-minute expiration & clean recovery path
  {
    const expiredCode =
      smsSpies.otpMessages[smsSpies.otpMessages.length - 1]?.code || '000000';

    advanceClockMs(5 * 60 * 1000 + 2_000); // Advance > 5 minutes

    const expiredVisit = await browserA.visitServerRoute('cairo-opening', 'VERIFY');
    const expiredChoose = await browserA.visitServerRoute(
      'cairo-opening',
      'CHOOSE_DRINK',
    );
    const verifyExpiredAttempt = await browserA.postJson<{
      success: boolean;
      reason?: string;
    }>('/api/drink-rewards/otp/verify', verifyOtpRoute, {
      campaignSlug: 'cairo-opening',
      otpCode: expiredCode,
    });

    assert(
      'Scenario 8a: After 5m expiry, resolveJourneyState transitions to EXPIRED_OTP while preserving customer details',
      expiredVisit.access.allowed === true &&
        expiredVisit.journey.stage === 'EXPIRED_OTP' &&
        expiredVisit.journey.customerName === 'Ahmed M. Mansour' &&
        !expiredChoose.access.allowed &&
        expiredChoose.access.redirectTo === '/drink-rewards/cairo-opening/verify',
    );
    assert(
      'Scenario 8b: Submitting expired OTP code is rejected (400 EXPIRED_OR_NOT_FOUND)',
      verifyExpiredAttempt.status === 400 &&
        verifyExpiredAttempt.data.reason === 'EXPIRED_OR_NOT_FOUND',
    );

    // Request fresh OTP cleanly from expired state
    rateLimiter.reset();
    const freshOtpRes = await browserA.postJson<{ success: boolean }>(
      '/api/drink-rewards/otp/request',
      requestOtpRoute,
      { campaignSlug: 'cairo-opening', intent: 'resend' },
    );
    assert(
      'Scenario 8c: Customer cleanly requests fresh OTP from EXPIRED_OTP state without re-typing details',
      freshOtpRes.status === 200 && freshOtpRes.data.success === true,
    );
  }

  // ── Scenario 9 & 11: Valid OTP verification -> Refresh + Back/Forward navigation
  {
    const latestCode =
      smsSpies.otpMessages[smsSpies.otpMessages.length - 1]?.code || '';

    const verifyRes = await browserA.postJson<{
      success: boolean;
      verificationToken?: string;
    }>('/api/drink-rewards/otp/verify', verifyOtpRoute, {
      campaignSlug: 'cairo-opening',
      otpCode: latestCode,
    });

    assert(
      'Scenario 9a: Valid 6-digit OTP verifies phone and upgrades HttpOnly session cookie to VERIFIED',
      verifyRes.status === 200 && verifyRes.data.success === true,
    );

    // Select second drink (102: Salted Caramel Frappe) and persist in session cookie
    const patchRes = await browserA.patchJson<{ success: boolean }>(
      '/api/drink-rewards/session',
      patchSessionRoute,
      {
        campaignSlug: 'cairo-opening',
        selectedDrinkId: 102,
      },
    );

    // Refresh (F5) on /choose-drink
    const refreshedChoose = await browserA.visitServerRoute(
      'cairo-opening',
      'CHOOSE_DRINK',
    );
    // Pressing Back onto /verify after verification redirects forward to /choose-drink without new OTP
    const revisitVerify = await browserA.visitServerRoute('cairo-opening', 'VERIFY');
    // Browser B still cannot access /choose-drink even though phone is verified in DB!
    const browserBChoose = await browserB.visitServerRoute(
      'cairo-opening',
      'CHOOSE_DRINK',
    );

    assert(
      'Scenario 9b: Refreshing /choose-drink restores VERIFIED stage & selectedDrinkId=102 without new OTP',
      patchRes.status === 200 &&
        refreshedChoose.access.allowed === true &&
        refreshedChoose.journey.stage === 'VERIFIED' &&
        refreshedChoose.journey.selectedDrinkId === 102,
    );
    assert(
      'Scenario 11a: Visiting /verify when already VERIFIED redirects cleanly to /choose-drink',
      !revisitVerify.access.allowed &&
        revisitVerify.access.redirectTo ===
          '/drink-rewards/cairo-opening/choose-drink',
    );
    assert(
      'Scenario 6c: Another browser STILL cannot access /choose-drink for a verified phone (strict browser binding)',
      !browserBChoose.access.allowed &&
        browserBChoose.journey.stage === 'UNINITIALIZED',
    );

    // Advance +45 minutes while user is browsing menu on /choose-drink and hits F5 reload
    advanceClockMs(45 * 60 * 1000);
    const refreshedAfter45m = await browserA.visitServerRoute(
      'cairo-opening',
      'CHOOSE_DRINK',
    );
    assert(
      'Scenario 9c: Reloading /choose-drink after 45 minutes STILL keeps user VERIFIED (never kicks back to /verify)',
      refreshedAfter45m.access.allowed === true &&
        refreshedAfter45m.journey.stage === 'VERIFIED' &&
        refreshedAfter45m.journey.selectedDrinkId === 102,
    );

    // Even if user somehow triggers intent="resend" while already VERIFIED, 0 SMS is sent and nextStep is CHOOSE_DRINK
    const smsBeforeResendWhileVerified = smsSpies.otpMessages.length;
    const resendWhileVerified = await browserA.postJson<{
      success: boolean;
      resumed?: boolean;
      nextStep?: string;
    }>('/api/drink-rewards/otp/request', requestOtpRoute, {
      campaignSlug: 'cairo-opening',
      intent: 'resend',
    });
    assert(
      'Scenario 9d: Calling OTP resend while already VERIFIED in DB refuses to waste SMS and returns nextStep=CHOOSE_DRINK',
      resendWhileVerified.status === 200 &&
        resendWhileVerified.data.resumed === true &&
        resendWhileVerified.data.nextStep === 'CHOOSE_DRINK' &&
        smsSpies.otpMessages.length === smsBeforeResendWhileVerified,
    );

    // Verify cross-bundle global cache version increments immediately on drink/category change
    const vBefore = getDrinkRewardsCacheVersion();
    revalidateDrinkItemCache(101, 10);
    const vAfterDrink = getDrinkRewardsCacheVersion();
    revalidateDrinkCategoryCache(10, 'iced-coffee');
    const vAfterCat = getDrinkRewardsCacheVersion();
    assert(
      'Scenario 9e: Admin drink/category changes immediately bump globalThis cache version across all route bundles',
      vAfterDrink > vBefore && vAfterCat > vAfterDrink,
    );

    // Navigate Back to Step 1, edit name, submit -> resumes CHOOSE_DRINK with 0 SMS!
    const smsBeforeStep1Edit = smsSpies.otpMessages.length;
    const step1ResumeVerified = await browserA.postJson<{
      success: boolean;
      resumed?: boolean;
      nextStep?: string;
    }>('/api/drink-rewards/otp/request', requestOtpRoute, {
      customerName: 'Ahmed Mansour Verified',
      phone: '01012345678',
      selectedBranchId: 2,
      campaignSlug: 'cairo-opening',
      intent: 'start',
    });

    assert(
      'Scenario 11b: Going Back to Step 1 and continuing while VERIFIED jumps directly to CHOOSE_DRINK with 0 SMS',
      step1ResumeVerified.status === 200 &&
        step1ResumeVerified.data.resumed === true &&
        step1ResumeVerified.data.nextStep === 'CHOOSE_DRINK' &&
        smsSpies.otpMessages.length === smsBeforeStep1Edit,
    );
  }

  // ── Scenario 12: Cross-Campaign Isolation (`alexandria-summer` vs `cairo-opening`)
  {
    const otherCampDetails = await browserA.visitServerRoute(
      'alexandria-summer',
      'DETAILS',
    );
    const otherCampChoose = await browserA.visitServerRoute(
      'alexandria-summer',
      'CHOOSE_DRINK',
    );

    // Attempt cross-campaign claim using cairo-opening browser session against alexandria-summer
    const crossCampClaim = await browserA.postJson<{
      success: boolean;
      reason?: string;
    }>('/api/drink-rewards/claim', claimDrinkRoute, {
      selectedDrinkId: 201,
      campaignSlug: 'alexandria-summer',
    });

    assert(
      'Scenario 12: Opening another campaign (/drink-rewards/alexandria-summer) isolates sessions completely & blocks cross-campaign claim',
      otherCampDetails.journey.stage === 'UNINITIALIZED' &&
        !otherCampChoose.access.allowed &&
        crossCampClaim.status === 401 &&
        crossCampClaim.data.reason === 'INVALID_SESSION',
    );
  }

  // ── Scenario 14: Atomic Claim, Idempotent Retry & Refresh on /success (Zero Duplicate Vouchers)
  {
    const [claim1, claim2] = await Promise.all([
      browserA.postJson<{
        success: boolean;
        idempotentReplay?: boolean;
        voucher?: { voucherCode: string; drinkName: string };
      }>('/api/drink-rewards/claim', claimDrinkRoute, {
        selectedDrinkId: 102,
        campaignSlug: 'cairo-opening',
      }),
      browserA.postJson<{
        success: boolean;
        idempotentReplay?: boolean;
        voucher?: { voucherCode: string; drinkName: string };
      }>('/api/drink-rewards/claim', claimDrinkRoute, {
        selectedDrinkId: 102,
        campaignSlug: 'cairo-opening',
      }),
    ]);

    const cairoCamp = dbState.campaigns.find((c) => c.slug === 'cairo-opening');
    const successPageRefresh = await browserA.visitServerRoute(
      'cairo-opening',
      'SUCCESS',
    );
    const rootRedirectAfterClaim = await browserA.visitServerRoute(
      'cairo-opening',
      'DETAILS',
    );
    const browserBSuccessSteal = await browserB.visitServerRoute(
      'cairo-opening',
      'SUCCESS',
    );

    assert(
      'Scenario 14a: Concurrent/duplicate claim requests issue EXACTLY 1 entitlement, 1 voucher SMS & total_claimed=1',
      claim1.status === 200 &&
        claim2.status === 200 &&
        claim1.data.voucher?.voucherCode === claim2.data.voucher?.voucherCode &&
        dbState.entitlements.length === 1 &&
        cairoCamp?.total_claimed === 1 &&
        smsSpies.voucherMessages.length === 1,
      `entitlements=${dbState.entitlements.length}, sms=${smsSpies.voucherMessages.length}`,
    );
    assert(
      'Scenario 14b: Refreshing /drink-rewards/cairo-opening/success restores the exact issued voucher from PostgreSQL',
      successPageRefresh.access.allowed === true &&
        successPageRefresh.journey.stage === 'CLAIMED' &&
        successPageRefresh.journey.voucher?.voucherCode ===
          claim1.data.voucher?.voucherCode &&
        successPageRefresh.journey.voucher?.drinkName === 'Salted Caramel Frappe',
    );
    assert(
      'Scenario 14c: Visiting /drink-rewards/cairo-opening after claiming redirects to /success, while Browser B is blocked',
      !rootRedirectAfterClaim.access.allowed &&
        rootRedirectAfterClaim.access.redirectTo ===
          '/drink-rewards/cairo-opening/success' &&
        !browserBSuccessSteal.access.allowed,
    );

    // ── Scenario 15: Voucher Lifecycle (Read-Time Expiry, Cashier Atomic Redemption Race & Session Polling Sync)
    const issuedCode = claim1.data.voucher?.voucherCode || '';

    // Mock server-side cashier context resolution (Cashier assigned to Branch #1: Maadi Flagship)
    drinkRedemptionService.resolveCashierContext = async () => ({
      success: true,
      context: {
        user: {
          id: 77,
          email: 'cashier.maadi@coffeebay.com',
          name: 'Omar Cashier',
          role: 'STAFF',
        } as never,
        branchId: 1,
        branchName: 'Maadi Flagship',
        branchCode: 'CB-MAA-01',
      },
    });

    // 15a. Test Read-Time Expiry WITHOUT modifying DB status column (zero cron job required)
    const entRow = dbState.entitlements[0]!;
    const originalExpiresAt = entRow.expires_at;
    entRow.expires_at = new Date(Date.now() - 60_000).toISOString(); // expired 1 minute ago while entRow.status === 'ISSUED'

    const pollExpiredRes = await browserA.getReq<{
      success: boolean;
      journey?: {
        voucher?: {
          status?: string;
          voucherCode: string;
        } | null;
      };
    }>(
      '/api/drink-rewards/session?campaignSlug=cairo-opening',
      getSessionRoute,
    );

    assert(
      'Scenario 15a: Read-time expiry computes voucher.status="EXPIRED" when expires_at <= NOW() even while DB column is still "ISSUED" (no cron needed)',
      pollExpiredRes.status === 200 &&
        pollExpiredRes.data.journey?.voucher?.status === 'EXPIRED' &&
        entRow.status === 'ISSUED',
      `computedStatus=${pollExpiredRes.data.journey?.voucher?.status}, dbRowStatus=${entRow.status}`,
    );

    // 15b. Test Cashier Redemption rejection on expired voucher
    const expiredRedeemAttempt = await drinkRedemptionService.redeemVoucher({
      voucherCode: issuedCode,
    });

    assert(
      'Scenario 15b: Cashier terminal blocks redemption of an expired voucher with VOUCHER_EXPIRED and stamps DB status="EXPIRED"',
      !expiredRedeemAttempt.success &&
        expiredRedeemAttempt.reason === 'VOUCHER_EXPIRED' &&
        entRow.status === 'EXPIRED',
      `reason=${!expiredRedeemAttempt.success ? expiredRedeemAttempt.reason : 'OK'}, dbRowStatus=${entRow.status}`,
    );

    // Restore voucher to active ISSUED state to test concurrent cashier redemption race
    entRow.status = 'ISSUED';
    entRow.expires_at = originalExpiresAt;

    // 15c. Test Concurrent Cashier Redemption Race (SELECT ... FOR UPDATE OF e + WHERE status = 'ISSUED')
    const [redeemRace1, redeemRace2] = await Promise.all([
      drinkRedemptionService.redeemVoucher({
        voucherCode: issuedCode,
        servedDrinkId: 101,
        changeReason: 'Customer requested Iced Spanish Latte at counter',
      }),
      drinkRedemptionService.redeemVoucher({
        voucherCode: issuedCode,
        servedDrinkId: 101,
        changeReason: 'Customer requested Iced Spanish Latte at counter',
      }),
    ]);

    const redeemSuccesses = [redeemRace1, redeemRace2].filter((r) => r.success);
    const redeemRejections = [redeemRace1, redeemRace2].filter(
      (r) => !r.success && r.reason === 'ALREADY_REDEEMED',
    );

    assert(
      'Scenario 15c: Concurrent cashier redemption requests allow EXACTLY 1 success and reject the duplicate with ALREADY_REDEEMED via FOR UPDATE lock',
      redeemSuccesses.length === 1 &&
        redeemRejections.length === 1 &&
        entRow.status === 'REDEEMED' &&
        entRow.branch_id === 1 &&
        entRow.redeemed_drink_id === 101 &&
        Boolean(entRow.redeemed_at),
      `successes=${redeemSuccesses.length}, rejections=${redeemRejections.length}, dbStatus=${entRow.status}`,
    );

    // 15d. Test Customer 15s Polling / Tab Return Endpoint (`GET /api/drink-rewards/session`) after Cashier Redemption
    const pollAfterRedeemRes = await browserA.getReq<{
      success: boolean;
      journey?: {
        voucher?: {
          voucherCode: string;
          status?: string;
          redeemedAt?: string | null;
          branchName?: string | null;
          drinkName?: string;
        } | null;
      };
    }>(
      '/api/drink-rewards/session?campaignSlug=cairo-opening',
      getSessionRoute,
    );

    assert(
      'Scenario 15d: Customer /success session poll returns authoritative DB status="REDEEMED", redeemedAt timestamp, redeemed branch ("Maadi Flagship"), and served drink ("Iced Spanish Latte")',
      pollAfterRedeemRes.status === 200 &&
        pollAfterRedeemRes.data.journey?.voucher?.status === 'REDEEMED' &&
        Boolean(pollAfterRedeemRes.data.journey?.voucher?.redeemedAt) &&
        pollAfterRedeemRes.data.journey?.voucher?.branchName === 'Maadi Flagship' &&
        pollAfterRedeemRes.data.journey?.voucher?.drinkName === 'Iced Spanish Latte',
      `status=${pollAfterRedeemRes.data.journey?.voucher?.status}, branch=${pollAfterRedeemRes.data.journey?.voucher?.branchName}, drink=${pollAfterRedeemRes.data.journey?.voucher?.drinkName}`,
    );

    // Explicit session reset ("Register with another phone number")
    const clearRes = await browserA.deleteReq<{ success: boolean }>(
      '/api/drink-rewards/session?campaignSlug=cairo-opening',
      deleteSessionRoute,
    );
    const afterClear = await browserA.visitServerRoute('cairo-opening', 'DETAILS');
    assert(
      'Scenario 14d: Explicit session reset clears only that campaign cookie so another customer can register cleanly',
      clearRes.status === 200 && afterClear.journey.stage === 'UNINITIALIZED',
    );
  }

  // ── Scenario 16: Zero-TTL Event-Driven Branch & Campaign Cache Invalidation (Normal Reload & Step Navigation)
  {
    dbState.campaignMenuLoadCount = 0;
    revalidateBranchesCache();

    // 16a. First load populates the in-memory cache; subsequent normal reloads / step syncs execute 0 DB queries
    const firstLoad =
      await drinkCampaignService.getPublicCampaignWithMenu('cairo-opening');
    const loadsAfterFirst = dbState.campaignMenuLoadCount;

    const secondLoad =
      await drinkCampaignService.getPublicCampaignWithMenu('cairo-opening');
    const stepSyncReq = new NextRequest(
      new URL(
        'http://localhost:3000/api/drink-rewards/campaign/cairo-opening',
      ),
      { method: 'GET' },
    );
    const stepSyncRes = await getCampaignRoute(stepSyncReq, {
      params: Promise.resolve({ slug: 'cairo-opening' }),
    });
    const stepSyncPayload = (await stepSyncRes.json()) as {
      success: boolean;
      campaign?: { branches: { id: number | string; name: string }[] };
    };
    const loadsAfterCachedReads = dbState.campaignMenuLoadCount;

    assert(
      'Scenario 16a: Subsequent normal reloads and step transitions serve campaign & branches from zero-TTL in-memory cache with ZERO database queries',
      loadsAfterFirst === 1 &&
        loadsAfterCachedReads === 1 &&
        firstLoad?.branches.length === 2 &&
        secondLoad?.branches.length === 2 &&
        stepSyncPayload.success === true &&
        stepSyncPayload.campaign?.branches.length === 2,
      `loadsAfterFirst=${loadsAfterFirst}, loadsAfterCachedReads=${loadsAfterCachedReads}`,
    );

    // 16b. Rename a branch + add a 3rd branch -> revalidateBranchesCache() -> immediately reflected on next normal load without ?fresh=1
    dbState.branches[0].name = 'Maadi Grand Flagship (Renamed)';
    dbState.branches.push({
      id: 3,
      name: 'Zamalek Riverfront Branch',
      code: 'ZAMALEK-01',
      address: '26th of July Corridor, Zamalek',
      active: true,
    });
    const vBeforeBranchChange = getDrinkRewardsCacheVersion();
    revalidateBranchesCache();
    const vAfterBranchChange = getDrinkRewardsCacheVersion();

    const afterBranchUpdate =
      await drinkCampaignService.getPublicCampaignWithMenu('cairo-opening');
    const loadsAfterInvalidation = dbState.campaignMenuLoadCount;

    assert(
      'Scenario 16b: Renaming a branch or adding a new branch immediately invalidates the cache and reflects on the very next normal load or step transition without hard reload',
      vAfterBranchChange > vBeforeBranchChange &&
        loadsAfterInvalidation === 2 &&
        afterBranchUpdate?.branches.length === 3 &&
        afterBranchUpdate?.branches[0].name === 'Maadi Grand Flagship (Renamed)' &&
        afterBranchUpdate?.branches[2].name === 'Zamalek Riverfront Branch',
      `branches=${JSON.stringify(afterBranchUpdate?.branches.map((b) => b.name))}`,
    );

    // 16c. Deactivating a branch immediately removes it on the next normal load
    dbState.branches[1].active = false;
    revalidateBranchesCache();
    const afterBranchDeactivate =
      await drinkCampaignService.getPublicCampaignWithMenu('cairo-opening');

    assert(
      'Scenario 16c: Deactivating a branch immediately removes it from public step selection on the very next load',
      afterBranchDeactivate?.branches.length === 2 &&
        afterBranchDeactivate.branches.every((b) => Number(b.id) !== 2),
      `branches=${JSON.stringify(afterBranchDeactivate?.branches.map((b) => b.name))}`,
    );
  }

  rateLimiter.destroy();

  console.log('\n======================================================================');
  console.log(
    `📊 FINAL ACCEPTANCE RESULTS: ${passed} PASSED | ${failed} FAILED (TOTAL: ${passed + failed})`,
  );
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAcceptanceSuite().catch((err) => {
  rateLimiter.destroy();
  console.error('Fatal error in acceptance suite:', err);
  process.exit(1);
});

