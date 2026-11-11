import crypto from 'crypto';
import { sql } from 'drizzle-orm';
import { getPayloadClient } from '../../lib/payload';
import {
  getOrLoadCachedCampaign,
  revalidateDrinkCampaignCache,
} from '../../lib/cache/drink-rewards-cache';
import { drinkOtpService } from './drink-otp-service';
import { notificationService } from '../notification-service';
import { alertEmailService } from '../alert-email-service';

export interface PublicCampaignData {
  id: number | string;
  title: string;
  slug: string;
  description?: string;
  startDate: string;
  endDate: string;
  bannerUrl?: string | null;
  active: boolean;
  isExpired: boolean;
  hasStarted: boolean;
  isExhausted: boolean;
  categories: {
    id: number | string;
    name: string;
    slug: string;
    description?: string;
  }[];
  drinks: {
    id: number | string;
    name: string;
    description?: string;
    imageUrl?: string | null;
    categoryId: number | string;
    categoryName: string;
  }[];
  branches: {
    id: number | string;
    name: string;
    code: string;
    address?: string;
  }[];
}

export interface ClaimEntitlementParams {
  sessionToken: string;
  customerName: string;
  selectedDrinkId: number | string;
  campaignSlug: string;
  selectedBranchId?: number | string | null;
}

export interface ClaimEntitlementResult {
  success: boolean;
  message: string;
  idempotentReplay?: boolean;
  reason?:
    | 'INVALID_SESSION'
    | 'CAMPAIGN_NOT_FOUND'
    | 'CAMPAIGN_INACTIVE'
    | 'CAMPAIGN_EXPIRED'
    | 'CAMPAIGN_EXHAUSTED'
    | 'ALREADY_CLAIMED'
    | 'ACTIVE_VOUCHER_EXISTS'
    | 'INVALID_DRINK'
    | 'INTERNAL_ERROR';
  voucher?: {
    entitlementId?: number | string;
    voucherCode: string;
    customerName: string;
    phone: string;
    drinkName: string;
    drinkImageUrl?: string | null;
    branchId?: number | string | null;
    branchName?: string | null;
    campaignTitle: string;
    status?: 'ISSUED' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED';
    redeemedAt?: string | null;
    expiresAt: string;
    issuedAt: string;
  };
}

export class DrinkCampaignService {
  /**
   * Generates a 5-digit numeric voucher code with CB- prefix (e.g. CB-48291).
   * Range: 10000 to 99999 (90,000 combinations).
   * Effortless to speak, memorize, and type across the coffee bar counter.
   */
  generateVoucherCode(): string {
    const randomNum = crypto.randomInt(10000, 100000);
    return `CB-${randomNum}`;
  }

  /**
   * Internal uncached reader for public campaign data & eligible menu.
   * Resolves multiple categories, drinks, and branches without N+1 queries.
   */
  private async fetchCampaignWithMenuDirect(slug: string): Promise<PublicCampaignData | null> {
    const payload = await getPayloadClient();

    // 1. Fetch Campaign
    const campaignDocs = await payload.find({
      collection: 'drink-campaigns',
      where: { slug: { equals: slug.trim() } },
      limit: 1,
      depth: 2,
    });

    if (campaignDocs.totalDocs === 0) {
      return null;
    }

    const campaign = campaignDocs.docs[0];
    const now = new Date();
    const startDate = new Date(campaign.start_date);
    const endDate = new Date(campaign.end_date);
    const hasStarted = startDate <= now;
    const isExpired = endDate <= now;
    const isExhausted =
      typeof campaign.max_claims === 'number' &&
      campaign.max_claims > 0 &&
      (campaign.total_claimed || 0) >= campaign.max_claims;

    // 2. Extract allowed categories (hasMany)
    const allowedCategories = Array.isArray(campaign.allowed_categories)
      ? campaign.allowed_categories
      : [];

    const categoryList: PublicCampaignData['categories'] = [];
    const rawCategoryIds: (string | number)[] = [];
    const categoryMap = new Map<string | number, string>();

    for (const catItem of allowedCategories) {
      if (typeof catItem === 'object' && catItem !== null) {
        const cat = catItem as { id: string | number; name: string; slug: string; description?: string; active?: boolean };
        if (cat.active !== false) {
          categoryList.push({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
          });
          categoryMap.set(String(cat.id), cat.name);
        }
      } else if (catItem) {
        rawCategoryIds.push(catItem);
      }
    }

    // If categories were not populated as objects, fetch them in one single batch query
    if (categoryList.length === 0 && rawCategoryIds.length > 0) {
      const fetchedCats = await payload.find({
        collection: 'drink-categories',
        where: {
          and: [
            { id: { in: rawCategoryIds } },
            { active: { equals: true } },
          ],
        },
        sort: 'id',
        limit: 50,
      });
      for (const cat of fetchedCats.docs) {
        categoryList.push({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description || undefined,
        });
        categoryMap.set(String(cat.id), cat.name);
      }
    }

    const activeCategoryIds = categoryList.map((c) => c.id);

    // 3. Batch fetch all active drinks belonging to the active allowed categories
    const drinkList: PublicCampaignData['drinks'] = [];
    if (activeCategoryIds.length > 0) {
      const drinksDocs = await payload.find({
        collection: 'drinks',
        where: {
          and: [
            { category: { in: activeCategoryIds } },
            { active: { equals: true } },
          ],
        },
        sort: 'id',
        depth: 1, // populate media image
        limit: 200,
      });

      for (const drink of drinksDocs.docs) {
        let imageUrl: string | null = null;
        if (typeof drink.image === 'object' && drink.image !== null && 'url' in drink.image) {
          imageUrl = (drink.image as { url: string }).url || null;
        }

        const catId = typeof drink.category === 'object' && drink.category !== null ? drink.category.id : drink.category;
        const catName = categoryMap.get(String(catId)) || 'Coffee Bay Beverage';

        drinkList.push({
          id: drink.id,
          name: drink.name,
          description: drink.description || undefined,
          imageUrl,
          categoryId: catId,
          categoryName: catName,
        });
      }
    }

    // Only expose categories that are active and have at least 1 active drink (or keep all active if no drinks yet)
    const populatedCategories =
      drinkList.length > 0
        ? categoryList.filter((cat) =>
            drinkList.some((d) => String(d.categoryId) === String(cat.id)),
          )
        : categoryList;

    // 4. Resolve all active Coffee Bay branches directly from the Branches collection
    // so adding, renaming, or toggling any branch in Payload Admin -> Branches immediately reflects in the UI.
    const branchList: PublicCampaignData['branches'] = [];
    const allBranches = await payload.find({
      collection: 'branches',
      where: { active: { equals: true } },
      sort: 'id',
      limit: 100,
    });
    for (const b of allBranches.docs) {
      branchList.push({
        id: b.id,
        name: b.name,
        code: b.code,
        address: b.address || undefined,
      });
    }

    // Banner image URL
    let bannerUrl: string | null = null;
    if (typeof campaign.banner_image === 'object' && campaign.banner_image !== null && 'url' in campaign.banner_image) {
      bannerUrl = (campaign.banner_image as { url: string }).url || null;
    }

    return {
      id: campaign.id,
      title: campaign.title,
      slug: campaign.slug,
      description: campaign.description || undefined,
      startDate: campaign.start_date,
      endDate: campaign.end_date,
      bannerUrl,
      active: !!campaign.active,
      isExpired,
      hasStarted,
      isExhausted,
      categories: populatedCategories,
      drinks: drinkList,
      branches: branchList,
    };
  }

  /**
   * Event-driven, zero-TTL cached public campaign & menu getter.
   * Immediately reflects any Admin change (Branch, Drink, Category, Campaign, Media)
   * on step navigation or normal reload without requiring a hard browser reload
   * and without redundant database queries when no mutation has occurred.
   */
  async getPublicCampaignWithMenu(
    slug: string,
    options?: { bypassCache?: boolean },
  ): Promise<PublicCampaignData | null> {
    return getOrLoadCachedCampaign(
      slug,
      () => this.fetchCampaignWithMenuDirect(slug),
      options,
    );
  }

  /**
   * Deterministic 32-bit signed integer hash for PostgreSQL `pg_advisory_xact_lock(key1, key2)`.
   * Isolates concurrent claim requests per (campaignId, phone) without blocking other customers.
   */
  private computePhoneAdvisoryKey(phone: string): number {
    const digest = crypto.createHash('sha256').update(phone).digest();
    return digest.readInt32BE(0);
  }

  /**
   * Atomically claim a drink voucher under a campaign.
   * Enforces:
   * 1. Valid signed verification session token from OTP
   * 2. Transactional row lock on campaign row (SELECT FOR UPDATE)
   * 3. Live campaign status, start/end dates
   * 4. Atomic max_claims ceiling check
   * 5. Live Once-Per-Campaign check
   * 6. Live validation that chosen drink belongs to campaign's allowed categories
   * 7. Historical snapshot of all eligible drink IDs at issuance time
   * 8. Cryptographic 12-char unique voucher code
   * 9. Marks OTP challenge used_at = NOW()
   * 10. Atomic counter total_claimed = total_claimed + 1
   * 11. Transactional queueing of voucher notification SMS
   */
  async claimEntitlement(params: ClaimEntitlementParams): Promise<ClaimEntitlementResult> {
    const { sessionToken, customerName, selectedDrinkId, campaignSlug, selectedBranchId } = params;

    // 1. Verify session token
    const session = drinkOtpService.verifySessionToken(sessionToken);
    if (!session) {
      return {
        success: false,
        reason: 'INVALID_SESSION',
        message: 'جلسة التحقق غير صالحة أو انتهت مدتها. يرجى إعادة التحقق من رقم الهاتف.',
      };
    }

    const resolvedCustomerName =
      typeof customerName === 'string' && customerName.trim().length > 0
        ? customerName.trim()
        : 'Guest';

    if (!campaignSlug || campaignSlug.trim().length === 0) {
      return {
        success: false,
        reason: 'CAMPAIGN_NOT_FOUND',
        message: 'معرف الحملة مطلوب.',
      };
    }

    const payload = await getPayloadClient();
    const phone = session.phone;
    const campaignId = Number(session.campaignId);
    const challengeId = Number(session.challengeId);
    const phoneLockKey = this.computePhoneAdvisoryKey(phone);

    // Run within atomic Drizzle transaction
    try {
      const result = await payload.db.drizzle.transaction(async (tx) => {
        // A0. Acquire per-(campaign, phone) transactional advisory lock first.
        // Serializes double-clicks, multi-tab clicks, or network retries from the same customer
        // without contending on the global campaign row lock.
        await tx.execute(sql`
          SELECT pg_advisory_xact_lock(${campaignId}, ${phoneLockKey})
        `);

        // A. Lock Campaign row for update to prevent concurrent race condition over max_claims
        const campaignRows = await tx.execute(sql`
          SELECT id, slug, title, active, start_date, end_date, max_claims, total_claimed,
                 max_claims_per_phone, allow_repeat_mode
          FROM drink_campaigns
          WHERE id = ${campaignId}
          FOR UPDATE
        `);

        if (!campaignRows.rows || campaignRows.rows.length === 0) {
          throw new Error('CAMPAIGN_NOT_FOUND');
        }

        const camp = campaignRows.rows[0] as {
          id: number;
          slug: string;
          title: string;
          active: boolean;
          start_date: string;
          end_date: string;
          max_claims: number | null;
          total_claimed: number;
          max_claims_per_phone?: number | null;
          allow_repeat_mode?: 'NEVER' | 'AFTER_REDEMPTION' | 'ANYTIME' | null;
        };

        // Prevent cross-campaign session replay
        if (camp.slug.trim().toLowerCase() !== campaignSlug.trim().toLowerCase()) {
          throw new Error('INVALID_SESSION');
        }

        // B. Live Multi-Claim & Eligibility check (strictly transactional, LEFT JOIN so deleted drinks never orphan a voucher)
        const existingEntitlement = await tx.execute(sql`
          SELECT e.id, e.voucher_code, e.customer_name, e.phone,
                 e.issued_at, e.expires_at, e.branch_id,
                 e.status, e.redeemed_at, e.reclaim_allowed,
                 COALESCE(d.name, 'Coffee Bay Beverage') AS drink_name,
                 m.url AS drink_image_url,
                 b.name AS branch_name
          FROM drink_entitlements e
          LEFT JOIN drinks d ON d.id = COALESCE(e.redeemed_drink_id, e.selected_drink_id)
          LEFT JOIN media m ON m.id = d.image_id
          LEFT JOIN branches b ON b.id = e.branch_id
          WHERE e.campaign_id = ${campaignId} AND e.phone = ${phone}
          ORDER BY e.issued_at DESC
        `);

        const rows = (existingEntitlement.rows || []) as {
          id: number;
          voucher_code: string;
          customer_name: string;
          phone: string;
          issued_at: string;
          expires_at: string;
          branch_id?: number | null;
          status?: 'ISSUED' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED';
          redeemed_at?: string | null;
          reclaim_allowed?: boolean;
          drink_name: string;
          drink_image_url?: string | null;
          branch_name?: string | null;
        }[];

        let hasAdminOverride = false;
        if (rows.length > 0) {
          const latestEnt = rows[0];
          const issuedMs = new Date(latestEnt.issued_at).getTime();

          // 1. Idempotent Replay if browser just claimed within verified session TTL
          if (
            typeof session.verifiedAt === 'number' &&
            issuedMs >= session.verifiedAt - 15_000
          ) {
            return {
              idempotentReplay: true,
              justExhausted: false,
              entitlementId: latestEnt.id,
              voucherCode: latestEnt.voucher_code,
              customerName: latestEnt.customer_name,
              phone: latestEnt.phone,
              drinkName: latestEnt.drink_name,
              drinkImageUrl: latestEnt.drink_image_url || null,
              branchId: latestEnt.branch_id || null,
              branchName: latestEnt.branch_name || null,
              campaignTitle: camp.title,
              status: latestEnt.status || 'ISSUED',
              redeemedAt: latestEnt.redeemed_at ? new Date(latestEnt.redeemed_at).toISOString() : null,
              expiresAt: new Date(latestEnt.expires_at).toISOString(),
              issuedAt: new Date(latestEnt.issued_at).toISOString(),
            };
          }

          // 2. Active Unredeemed Voucher Check:
          // A customer cannot hold a second concurrent active voucher while one is still ISSUED (unless reclaim_allowed is true)
          const activeIssued = rows.find((r) => r.status === 'ISSUED' && !r.reclaim_allowed);
          if (activeIssued) {
            throw new Error('ACTIVE_VOUCHER_EXISTS');
          }

          // 3. Admin Override Check (Per-customer exception)
          hasAdminOverride = rows.some((r) => r.reclaim_allowed === true);

          // 4. Campaign Repeat Policy Check
          const maxAllowed = camp.max_claims_per_phone ?? 1;
          const repeatMode = camp.allow_repeat_mode ?? 'NEVER';
          const totalClaimedCount = rows.length;

          let isEligible = hasAdminOverride;
          if (!isEligible && totalClaimedCount < maxAllowed) {
            if (repeatMode === 'ANYTIME') {
              isEligible = true;
            } else if (repeatMode === 'AFTER_REDEMPTION') {
              const allPastDone = rows.every(
                (r) => r.status === 'REDEEMED' || r.status === 'EXPIRED',
              );
              if (allPastDone) {
                isEligible = true;
              } else {
                throw new Error('ACTIVE_VOUCHER_EXISTS');
              }
            }
          }

          if (!isEligible) {
            throw new Error('ALREADY_CLAIMED');
          }
        }

        const now = new Date();
        if (!camp.active) {
          throw new Error('CAMPAIGN_INACTIVE');
        }
        if (camp.start_date && new Date(camp.start_date) > now) {
          throw new Error('CAMPAIGN_INACTIVE');
        }
        if (camp.end_date && new Date(camp.end_date) <= now) {
          throw new Error('CAMPAIGN_EXPIRED');
        }

        // C. Check max_claims ceiling
        if (camp.max_claims !== null && camp.max_claims > 0) {
          if (camp.total_claimed >= camp.max_claims) {
            throw new Error('CAMPAIGN_EXHAUSTED');
          }
        }

        // D. Verify the OTP challenge was verified and hasn't already been consumed
        const challengeCheck = await tx.execute(sql`
          SELECT id, verified_at, used_at FROM drink_otp_challenges
          WHERE id = ${challengeId}
            AND phone = ${phone}
            AND verified_at IS NOT NULL
            AND used_at IS NULL
          FOR UPDATE
        `);

        if (!challengeCheck.rows || challengeCheck.rows.length === 0) {
          throw new Error('INVALID_SESSION');
        }

        // E. Validate selected drink belongs to this campaign's ACTIVE allowed categories
        const allowedCategoriesQuery = await tx.execute(sql`
          SELECT r.drink_categories_id
          FROM drink_campaigns_rels r
          INNER JOIN drink_categories c ON c.id = r.drink_categories_id AND c.active = true
          WHERE r.parent_id = ${campaignId} AND r.path = 'allowed_categories'
        `);

        const allowedCategoryIds = (allowedCategoriesQuery.rows || []).map(
          (r) => (r as { drink_categories_id: number }).drink_categories_id,
        );

        if (allowedCategoryIds.length === 0) {
          throw new Error('INVALID_DRINK');
        }

        // Check selected drink and resolve its authoritative media URL
        const drinkQuery = await tx.execute(sql`
          SELECT d.id, d.name, d.category_id, d.active, m.url AS drink_image_url
          FROM drinks d
          LEFT JOIN media m ON m.id = d.image_id
          WHERE d.id = ${Number(selectedDrinkId)} AND d.active = true
          LIMIT 1
        `);

        if (!drinkQuery.rows || drinkQuery.rows.length === 0) {
          throw new Error('INVALID_DRINK');
        }

        const selectedDrinkRow = drinkQuery.rows[0] as {
          id: number;
          name: string;
          category_id: number;
          active: boolean;
          drink_image_url?: string | null;
        };

        if (!allowedCategoryIds.includes(selectedDrinkRow.category_id)) {
          throw new Error('INVALID_DRINK');
        }

        // E2. Resolve and validate selected branch against active branches
        let resolvedBranchId: number | null = null;
        let resolvedBranchName: string | null = null;

        if (selectedBranchId !== undefined && selectedBranchId !== null && String(selectedBranchId).trim() !== '') {
          const parsedBranchId = Number(selectedBranchId);
          if (Number.isFinite(parsedBranchId) && parsedBranchId > 0) {
            const branchCheck = await tx.execute(sql`
              SELECT id, name FROM branches WHERE id = ${parsedBranchId} AND active = true LIMIT 1
            `);
            const bRow = branchCheck.rows?.[0] as { id: number; name: string } | undefined;
            if (bRow) {
              resolvedBranchId = Number(bRow.id);
              resolvedBranchName = bRow.name;
            }
          }
        }

        // If no branch was explicitly passed and only 1 active branch exists, default to it
        if (!resolvedBranchId) {
          const activeBranchesFallback = await tx.execute(sql`
            SELECT id, name FROM branches WHERE active = true ORDER BY id ASC LIMIT 2
          `);
          if (activeBranchesFallback.rows && activeBranchesFallback.rows.length === 1) {
            const singleBranch = activeBranchesFallback.rows[0] as { id: number; name: string };
            resolvedBranchId = Number(singleBranch.id);
            resolvedBranchName = singleBranch.name;
          }
        }

        // F. Capture snapshot of all currently allowed drink IDs
        const eligibleDrinksQuery = await tx.execute(sql`
          SELECT id FROM drinks
          WHERE category_id IN (${sql.join(allowedCategoryIds, sql`, `)}) AND active = true
        `);
        const allowedDrinksSnapshot = (eligibleDrinksQuery.rows || []).map((r) => (r as { id: number }).id);

        // G. Generate unique 12-char voucher code with collision check
        let voucherCode = this.generateVoucherCode();
        let isUnique = false;
        let collisionAttempts = 0;

        while (!isUnique && collisionAttempts < 10) {
          const collision = await tx.execute(sql`
            SELECT id FROM drink_entitlements WHERE voucher_code = ${voucherCode} LIMIT 1
          `);
          if (!collision.rows || collision.rows.length === 0) {
            isUnique = true;
          } else {
            voucherCode = this.generateVoucherCode();
            collisionAttempts++;
          }
        }

        if (!isUnique) {
          throw new Error('INTERNAL_ERROR');
        }

        // H. Insert DrinkEntitlement (including branch_id when selected/resolved)
        const expiresAtStr = new Date(camp.end_date).toISOString();
        const nowStr = new Date().toISOString();

        const insertedRes = await tx.execute(sql`
          INSERT INTO drink_entitlements (
            voucher_code,
            campaign_id,
            phone,
            customer_name,
            selected_drink_id,
            branch_id,
            status,
            allowed_drinks_snapshot,
            issued_at,
            expires_at,
            created_at,
            updated_at
          ) VALUES (
            ${voucherCode},
            ${campaignId},
            ${phone},
            ${resolvedCustomerName},
            ${selectedDrinkRow.id},
            ${resolvedBranchId},
            'ISSUED',
            ${JSON.stringify(allowedDrinksSnapshot)},
            ${nowStr},
            ${expiresAtStr},
            NOW(),
            NOW()
          )
          RETURNING id
        `);
        const insertedRow = insertedRes.rows?.[0] as { id: number } | undefined;

        // H2. Consume any prior admin override so each grant applies once
        if (hasAdminOverride) {
          await tx.execute(sql`
            UPDATE drink_entitlements
            SET reclaim_allowed = false, updated_at = NOW()
            WHERE campaign_id = ${campaignId} AND phone = ${phone} AND reclaim_allowed = true
          `);
        }

        // I. Mark OTP challenge consumed
        await tx.execute(sql`
          UPDATE drink_otp_challenges
          SET used_at = NOW()
          WHERE id = ${challengeId}
        `);

        // J. Atomically increment total_claimed counter on campaign
        await tx.execute(sql`
          UPDATE drink_campaigns
          SET total_claimed = total_claimed + 1,
              updated_at = NOW()
          WHERE id = ${campaignId}
        `);

        const newTotalClaimed = (camp.total_claimed || 0) + 1;
        const justExhausted =
          camp.max_claims !== null &&
          camp.max_claims > 0 &&
          newTotalClaimed >= camp.max_claims;

        return {
          idempotentReplay: false,
          justExhausted,
          entitlementId: insertedRow?.id,
          voucherCode,
          customerName: customerName.trim(),
          phone,
          drinkName: selectedDrinkRow.name,
          drinkImageUrl: selectedDrinkRow.drink_image_url || null,
          branchId: resolvedBranchId,
          branchName: resolvedBranchName,
          campaignTitle: camp.title,
          status: 'ISSUED' as const,
          redeemedAt: null,
          expiresAt: expiresAtStr,
          issuedAt: nowStr,
        };
      });

      const { idempotentReplay, justExhausted, ...voucherPayload } = result;

      if (!idempotentReplay) {
        // Only invalidate public campaign cache if the campaign just hit its max_claims ceiling.
        // Keeping the menu cache warm avoids expensive DB re-queries when redirecting to `/success`.
        if (justExhausted) {
          revalidateDrinkCampaignCache(campaignSlug);
        }

        // Queue SMS confirmation without opening a redundant nested DB transaction
        try {
          await notificationService.queueDrinkVoucher(
            {
              phone: voucherPayload.phone,
              customerName: voucherPayload.customerName,
              voucherCode: voucherPayload.voucherCode,
              drinkName: voucherPayload.drinkName,
              campaignTitle: voucherPayload.campaignTitle,
              expiresAt: voucherPayload.expiresAt,
              branchName: voucherPayload.branchName,
            },
            '',
          );
        } catch (smsErr) {
          console.error('[DrinkCampaignService] Failed to queue voucher confirmation SMS:', smsErr);
        }

        // Asynchronously trigger Admin Email Alert (SMTP) without blocking response
        alertEmailService
          .sendDrinkRewardAlert({
            customerName: voucherPayload.customerName,
            customerPhone: voucherPayload.phone,
            drinkName: voucherPayload.drinkName,
            voucherCode: voucherPayload.voucherCode,
            campaignTitle: voucherPayload.campaignTitle,
            branchName: voucherPayload.branchName,
            expiresAt: voucherPayload.expiresAt,
            occurredAt: new Date(),
          })
          .catch((emailErr) => {
            console.error('[DrinkCampaignService] Failed to send admin email alert:', emailErr);
          });
      }

      return {
        success: true,
        idempotentReplay,
        message: 'تم إصدار قسيمة مشروبك المجاني بنجاح!',
        voucher: voucherPayload,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[DrinkCampaignService] Error claiming entitlement:', errMsg);

      if (errMsg === 'CAMPAIGN_NOT_FOUND') {
        return { success: false, reason: 'CAMPAIGN_NOT_FOUND', message: 'الحملة غير موجودة.' };
      }
      if (errMsg === 'CAMPAIGN_INACTIVE') {
        return { success: false, reason: 'CAMPAIGN_INACTIVE', message: 'هذا العرض غير متاح حالياً.' };
      }
      if (errMsg === 'CAMPAIGN_EXPIRED') {
        return { success: false, reason: 'CAMPAIGN_EXPIRED', message: 'عذراً، انتهت صلاحية هذا العرض.' };
      }
      if (errMsg === 'CAMPAIGN_EXHAUSTED') {
        return { success: false, reason: 'CAMPAIGN_EXHAUSTED', message: 'عذراً، نفدت جميع المشروبات المتاحة لهذا العرض.' };
      }
      if (errMsg === 'ALREADY_CLAIMED') {
        return { success: false, reason: 'ALREADY_CLAIMED', message: 'لقد تم الاستفادة من هذا العرض مسبقاً لهذا الرقم.' };
      }
      if (errMsg === 'ACTIVE_VOUCHER_EXISTS') {
        return {
          success: false,
          reason: 'ACTIVE_VOUCHER_EXISTS',
          message: 'لديك بالفعل قسيمة مشروب جاهزة للصرف في الفرع. يرجى التوجه للفرع وصرفها أولاً.',
        };
      }
      if (errMsg === 'INVALID_SESSION') {
        return { success: false, reason: 'INVALID_SESSION', message: 'جلسة التحقق غير صالحة. يرجى إعادة طلب رمز التحقق.' };
      }
      if (errMsg === 'INVALID_DRINK') {
        return { success: false, reason: 'INVALID_DRINK', message: 'المشروب المختار غير مؤهل ضمن هذا العرض.' };
      }

      return {
        success: false,
        reason: 'INTERNAL_ERROR',
        message: 'حدث خطأ غير متوقع أثناء إصدار القسيمة. يرجى المحاولة مرة أخرى.',
      };
    }
  }
}

export const drinkCampaignService = new DrinkCampaignService();
