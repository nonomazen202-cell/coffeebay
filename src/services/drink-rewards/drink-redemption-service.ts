import { sql } from "drizzle-orm";
import { getPayloadClient } from "../../lib/payload";
import {
  getAuthUser,
  type AuthenticatedUser,
} from "../../lib/security/auth-helper";
import {
  hasPromotionsAccess,
  hasPromotionsAdminAccess,
} from "../../lib/security/roles";
import { validateAndNormalizePhone } from "../../lib/validators/phone-validator";

export interface CashierContext {
  user: AuthenticatedUser;
  branchId: number;
  branchName: string;
  branchCode: string;
}

export interface CashierDashboardKpi {
  todayRedeemed: number;
  activeVouchers: number;
  totalRedeemed: number;
  totalSubstitutions: number;
  topDrinkToday: string;
}

export interface RecentRedemptionItem {
  id: number;
  voucherCode: string;
  customerName: string;
  phone?: string;
  maskedPhone?: string;
  status: string;
  issuedAt: string;
  redeemedAt: string | null;
  changeReason: string | null;
  selectedDrinkName: string;
  servedDrinkName: string;
  wasSubstituted: boolean;
  branchName: string;
  cashierName: string;
}

export interface CashierProfile {
  name: string;
  role: string;
  branchName: string;
  branchCode: string;
}

export interface CashierDashboardData {
  cashier: CashierProfile;
  kpi: CashierDashboardKpi;
  recentRedemptions: RecentRedemptionItem[];
}

export interface VoucherLookupResult {
  found: boolean;
  message?: string;
  voucher?: {
    id: number;
    voucherCode: string;
    customerName: string;
    phone: string;
    maskedPhone: string;
    status: "ISSUED" | "REDEEMED" | "EXPIRED" | "CANCELLED";
    campaignId: number;
    campaignTitle: string;
    expiresAt: string;
    isExpired: boolean;
    issuedAt: string;
    redeemedAt?: string | null;
    changeReason?: string | null;
    branchName?: string | null;
    cashierName?: string | null;
    selectedDrink: {
      id: number;
      name: string;
      categoryName?: string;
    };
    redeemedDrink?: {
      id: number;
      name: string;
    } | null;
    isBranchAllowed: boolean;
    branchRestrictionMessage?: string;
    allowedAlternativeDrinks: {
      id: number;
      name: string;
      categoryName?: string;
    }[];
  };
}

export interface RedeemVoucherParams {
  voucherCode: string;
  servedDrinkId?: number | string;
  changeReason?: string;
  adminOverrideBranchId?: number | string;
  resolvedContext?: CashierContext;
}

export interface RedeemVoucherResult {
  success: boolean;
  message: string;
  reason?:
    | "UNAUTHENTICATED"
    | "UNAUTHORIZED"
    | "NO_BRANCH_ASSIGNED"
    | "CONFLICTING_ASSIGNMENTS"
    | "VOUCHER_NOT_FOUND"
    | "ALREADY_REDEEMED"
    | "VOUCHER_EXPIRED"
    | "VOUCHER_CANCELLED"
    | "BRANCH_NOT_ALLOWED"
    | "INVALID_SERVED_DRINK"
    | "CHANGE_REASON_REQUIRED"
    | "INTERNAL_ERROR";
  redemption?: {
    id?: number;
    voucherCode: string;
    customerName: string;
    phone?: string;
    status?: string;
    issuedAt?: string;
    selectedDrinkName?: string;
    servedDrinkName: string;
    branchName: string;
    cashierName: string;
    redeemedAt: string;
    wasSubstituted: boolean;
    changeReason?: string | null;
  };
}

export class DrinkRedemptionService {
  /**
   * Helper to mask customer phone (e.g. +201012345678 -> +2010****5678)
   */
  private maskPhone(phone: string): string {
    if (!phone || phone.length < 8) return "****";
    const start = phone.substring(0, 5);
    const end = phone.substring(phone.length - 4);
    return `${start}****${end}`;
  }

  /**
   * Resolve and enforce cashier's branch strictly server-side.
   * STAFF members: branch is retrieved ONLY from their active DrinkCashierAssignments record.
   * ADMIN members: can use assigned branch or explicit overrideBranchId.
   * Uses direct parameterized Drizzle SQL without ORM population overhead.
   * Fails closed if multiple active assignments are detected.
   */
  async resolveCashierContext(
    adminOverrideBranchId?: number | string,
    existingUser?: AuthenticatedUser,
  ): Promise<
    | { success: true; context: CashierContext }
    | {
        success: false;
        reason:
          | "UNAUTHENTICATED"
          | "UNAUTHORIZED"
          | "NO_BRANCH_ASSIGNED"
          | "CONFLICTING_ASSIGNMENTS";
        message: string;
      }
  > {
    const user = existingUser || (await getAuthUser());
    if (!user) {
      return {
        success: false,
        reason: "UNAUTHENTICATED",
        message: "يجب تسجيل الدخول ككاشير أو مدير نظام للمتابعة.",
      };
    }

    if (!hasPromotionsAccess(user)) {
      return {
        success: false,
        reason: "UNAUTHORIZED",
        message: "ليس لديك صلاحية لصرف مشروبات الجوائز.",
      };
    }

    const payload = await getPayloadClient();
    const drizzle = payload.db.drizzle;

    // 1. If user has Promotions Admin privileges and specified a branch override, verify branch exists and is active
    if (hasPromotionsAdminAccess(user) && adminOverrideBranchId) {
      const overrideRes = await drizzle.execute(sql`
        SELECT id, name, code, active
        FROM branches
        WHERE id = ${Number(adminOverrideBranchId)} AND active = true
        LIMIT 1;
      `);
      const overrideRows = Array.isArray(overrideRes)
        ? overrideRes
        : (overrideRes as { rows?: unknown[] }).rows || [];

      if (overrideRows.length > 0) {
        const b = overrideRows[0] as { id: number; name: string; code: string };
        return {
          success: true,
          context: {
            user,
            branchId: Number(b.id),
            branchName: b.name,
            branchCode: b.code,
          },
        };
      }
    }

    // 2. Query active cashier assignment for this user using direct parameterized SQL
    // Security invariant: fail closed if multiple active assignments exist
    const assignmentRes = await drizzle.execute(sql`
      SELECT
        a.id AS assignment_id,
        b.id AS branch_id,
        b.name AS branch_name,
        b.code AS branch_code,
        b.active AS branch_active
      FROM drink_cashier_assignments a
      JOIN branches b ON a.branch_id = b.id
      WHERE a.user_id = ${Number(user.id)}
        AND a.active = true;
    `);

    const assignmentRows = Array.isArray(assignmentRes)
      ? assignmentRes
      : (assignmentRes as { rows?: unknown[] }).rows || [];

    if (assignmentRows.length > 1) {
      return {
        success: false,
        reason: "CONFLICTING_ASSIGNMENTS",
        message:
          "تم رصد أكثر من تعيين نشط لهذا المستخدم في فروع مختلفة. يرجى مراجعة إدارة النظام لضبط فرع واحد نشط.",
      };
    }

    if (assignmentRows.length === 1) {
      const row = assignmentRows[0] as {
        assignment_id: number;
        branch_id: number;
        branch_name: string;
        branch_code: string;
        branch_active: boolean;
      };
      if (row.branch_active !== false) {
        return {
          success: true,
          context: {
            user,
            branchId: Number(row.branch_id),
            branchName: row.branch_name,
            branchCode: row.branch_code,
          },
        };
      }
    }

    // 3. If Admin with no assignment and no override, grab the first active branch as fallback
    if (hasPromotionsAdminAccess(user)) {
      const defaultBranchRes = await drizzle.execute(sql`
        SELECT id, name, code
        FROM branches
        WHERE active = true
        ORDER BY id ASC
        LIMIT 1;
      `);
      const defaultRows = Array.isArray(defaultBranchRes)
        ? defaultBranchRes
        : (defaultBranchRes as { rows?: unknown[] }).rows || [];

      if (defaultRows.length > 0) {
        const b = defaultRows[0] as { id: number; name: string; code: string };
        return {
          success: true,
          context: {
            user,
            branchId: Number(b.id),
            branchName: b.name,
            branchCode: b.code,
          },
        };
      }
    }

    return {
      success: false,
      reason: "NO_BRANCH_ASSIGNED",
      message:
        "الموظف غير معين على أي فرع نشط حالياً. يرجى مراجعة إدارة النظام لتحديد الفرع.",
    };
  }

  /**
   * Fetches the complete, minimal typed dashboard data directly on the server.
   * Can be invoked from Server Components (RSC) with zero HTTP round-trip overhead.
   */
  async getCashierDashboardData(
    authenticatedUser?: AuthenticatedUser | null,
  ): Promise<CashierDashboardData | null> {
    const user = authenticatedUser || (await getAuthUser());
    if (!user || !hasPromotionsAccess(user)) {
      return null;
    }

    const contextRes = await this.resolveCashierContext(undefined, user);
    const branchContext = contextRes.success ? contextRes.context : null;

    const payload = await getPayloadClient();
    const drizzle = payload.db.drizzle;

    // 1. Fast KPI Aggregation via Raw SQL
    const kpiRaw = await drizzle.execute(sql`
      SELECT
        COUNT(CASE WHEN e.status = 'REDEEMED' AND e.redeemed_at >= CURRENT_DATE THEN 1 END)::int AS today_redeemed,
        COUNT(CASE WHEN e.status = 'ISSUED' AND e.expires_at > now() THEN 1 END)::int AS active_vouchers,
        COUNT(CASE WHEN e.status = 'REDEEMED' THEN 1 END)::int AS total_redeemed,
        COUNT(CASE WHEN e.status = 'REDEEMED' AND e.selected_drink_id != e.redeemed_drink_id THEN 1 END)::int AS total_substitutions
      FROM drink_entitlements e;
    `);

    const kpiRows = Array.isArray(kpiRaw)
      ? kpiRaw
      : (kpiRaw as { rows?: unknown[] }).rows || [];
    const kpi = (kpiRows[0] || {
      today_redeemed: 0,
      active_vouchers: 0,
      total_redeemed: 0,
      total_substitutions: 0,
    }) as {
      today_redeemed: number;
      active_vouchers: number;
      total_redeemed: number;
      total_substitutions: number;
    };

    // 2. Fetch Top Drink of Today
    const topDrinkRaw = await drizzle.execute(sql`
      SELECT d.name, COUNT(*)::int AS count
      FROM drink_entitlements e
      JOIN drinks d ON COALESCE(e.redeemed_drink_id, e.selected_drink_id) = d.id
      WHERE e.status = 'REDEEMED' AND e.redeemed_at >= CURRENT_DATE
      GROUP BY d.name
      ORDER BY count DESC
      LIMIT 1;
    `);
    const topDrinkRows = Array.isArray(topDrinkRaw)
      ? topDrinkRaw
      : (topDrinkRaw as { rows?: unknown[] }).rows || [];
    const topDrink = (topDrinkRows[0] || null) as {
      name: string;
      count: number;
    } | null;

    // 3. Fetch Recent 25 Redemptions Feed
    const recentRaw = await drizzle.execute(sql`
      SELECT
        e.id,
        e.voucher_code,
        e.customer_name,
        e.phone,
        e.status,
        e.issued_at,
        e.redeemed_at,
        e.change_reason,
        sd.name AS selected_drink_name,
        rd.name AS redeemed_drink_name,
        b.name AS branch_name,
        u.name AS cashier_name
      FROM drink_entitlements e
      LEFT JOIN drinks sd ON e.selected_drink_id = sd.id
      LEFT JOIN drinks rd ON e.redeemed_drink_id = rd.id
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN users u ON e.cashier_id = u.id
      WHERE e.status = 'REDEEMED'
      ORDER BY e.redeemed_at DESC NULLS LAST
      LIMIT 25;
    `);
    const recentRows = Array.isArray(recentRaw)
      ? recentRaw
      : (recentRaw as { rows?: unknown[] }).rows || [];

    const recentRedemptions: RecentRedemptionItem[] = (
      recentRows as Array<{
        id: number;
        voucher_code: string;
        customer_name: string;
        phone: string;
        status: string;
        issued_at: string;
        redeemed_at: string | null;
        change_reason: string | null;
        selected_drink_name: string | null;
        redeemed_drink_name: string | null;
        branch_name: string | null;
        cashier_name: string | null;
      }>
    ).map((r) => ({
      id: r.id,
      voucherCode: r.voucher_code,
      customerName: r.customer_name,
      phone: r.phone || "",
      maskedPhone: r.phone || "",
      status: r.status,
      issuedAt: r.issued_at,
      redeemedAt: r.redeemed_at,
      changeReason: r.change_reason,
      selectedDrinkName: r.selected_drink_name || "مشروب محدد",
      servedDrinkName:
        r.redeemed_drink_name || r.selected_drink_name || "مشروب محدد",
      wasSubstituted: Boolean(
        r.redeemed_drink_name &&
        r.selected_drink_name &&
        r.redeemed_drink_name !== r.selected_drink_name,
      ),
      branchName: r.branch_name || "الفرع الرئيسي",
      cashierName: r.cashier_name || "الكاشير",
    }));

    return {
      cashier: {
        name: user.name || user.email,
        role: user.role,
        branchName:
          branchContext?.branchName ||
          (hasPromotionsAdminAccess(user)
            ? "جميع الفروع (مشرف عام)"
            : "غير محدد"),
        branchCode: branchContext?.branchCode || "ALL",
      },
      kpi: {
        todayRedeemed: kpi.today_redeemed,
        activeVouchers: kpi.active_vouchers,
        totalRedeemed: kpi.total_redeemed,
        totalSubstitutions: kpi.total_substitutions,
        topDrinkToday: topDrink
          ? `${topDrink.name} (${topDrink.count})`
          : "لا يوجد بعد",
      },
      recentRedemptions,
    };
  }

  /**
   * Lookup voucher details for the cashier redemption terminal.
   */
  async lookupVoucher(
    voucherCodeRaw: string,
    adminOverrideBranchId?: number | string,
  ): Promise<VoucherLookupResult> {
    const cashierCheck = await this.resolveCashierContext(
      adminOverrideBranchId,
    );
    if (!cashierCheck.success) {
      return { found: false, message: cashierCheck.message };
    }
    const cashierContext = cashierCheck.context;

    const queryRaw = voucherCodeRaw.trim();
    if (!queryRaw) {
      return {
        found: false,
        message:
          "من فضلك اكتب كود الكوبون أو رقم هاتف العميل / Please enter a voucher code or phone number.",
      };
    }

    const payload = await getPayloadClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let doc: any = null;

    // 1. Direct search by voucher_code
    const upperQuery = queryRaw.toUpperCase();
    const codeCandidates = [upperQuery];
    if (!upperQuery.includes("-")) {
      codeCandidates.push(`CB-${upperQuery}`);
      codeCandidates.push(`DRK-${upperQuery}`);
    } else if (upperQuery.startsWith("CB-")) {
      codeCandidates.push(upperQuery.replace(/^CB-/, ""));
    }

    const entitlementDocs = await payload.find({
      collection: "drink-entitlements",
      where: { voucher_code: { in: codeCandidates } },
      depth: 1,
      limit: 1,
    });

    if (entitlementDocs.totalDocs > 0) {
      doc = entitlementDocs.docs[0];
    }

    // 2. If not found by voucher_code, search by customer phone number
    if (!doc) {
      const pureDigits = queryRaw.replace(/\D/g, "");
      if (pureDigits.length >= 8) {
        const candidatePhones = new Set<string>();
        candidatePhones.add(queryRaw);
        candidatePhones.add(pureDigits);
        candidatePhones.add(`+${pureDigits}`);

        const last10 =
          pureDigits.length >= 10 ? pureDigits.slice(-10) : pureDigits;
        candidatePhones.add(`0${last10}`);
        candidatePhones.add(`+20${last10}`);
        candidatePhones.add(`20${last10}`);

        const norm = validateAndNormalizePhone(queryRaw, "+20");
        if (norm.valid && norm.normalized) {
          candidatePhones.add(norm.normalized);
        }

        const phoneDocs = await payload.find({
          collection: "drink-entitlements",
          where: {
            phone: {
              in: Array.from(candidatePhones),
            },
          },
          depth: 1,
          limit: 10,
          sort: "-createdAt",
        });

        const nowTime = Date.now();
        if (phoneDocs.totalDocs > 0) {
          // Prioritize active/issued & non-expired vouchers first, then latest created
          const sorted = [...phoneDocs.docs].sort((a, b) => {
            const aActive =
              a.status === "ISSUED" &&
              new Date(a.expires_at).getTime() > nowTime;
            const bActive =
              b.status === "ISSUED" &&
              new Date(b.expires_at).getTime() > nowTime;
            if (aActive && !bActive) return -1;
            if (!aActive && bActive) return 1;
            return (
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });
          doc = sorted[0];
        } else if (pureDigits.length >= 9) {
          // Fallback: contains last 9 digits (handles non-standard spacing/formatting)
          const fallbackDocs = await payload.find({
            collection: "drink-entitlements",
            where: {
              phone: {
                contains: pureDigits.slice(-9),
              },
            },
            depth: 1,
            limit: 5,
            sort: "-createdAt",
          });

          if (fallbackDocs.totalDocs > 0) {
            const sorted = [...fallbackDocs.docs].sort((a, b) => {
              const aActive =
                a.status === "ISSUED" &&
                new Date(a.expires_at).getTime() > nowTime;
              const bActive =
                b.status === "ISSUED" &&
                new Date(b.expires_at).getTime() > nowTime;
              if (aActive && !bActive) return -1;
              if (!aActive && bActive) return 1;
              return (
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
              );
            });
            doc = sorted[0];
          }
        }
      }
    }

    if (!doc) {
      return {
        found: false,
        message:
          "مفيش أي كوبون بالكود ده أو برقم الموبايل ده، اتأكد من الرقم وجرّب تاني / No voucher found for this code or phone number.",
      };
    }
    const now = new Date();
    const expiresAt = new Date(doc.expires_at);
    const isExpired = expiresAt <= now;

    // Check status
    let displayStatus: "ISSUED" | "REDEEMED" | "EXPIRED" | "CANCELLED" =
      doc.status as "ISSUED" | "REDEEMED" | "EXPIRED" | "CANCELLED";
    if (displayStatus === "ISSUED" && isExpired) {
      displayStatus = "EXPIRED";
    }

    // Resolve Campaign
    const campaignObj = doc.campaign as
      | { id: number; title: string; allowed_branches?: unknown[] }
      | undefined;
    const campaignTitle = campaignObj?.title || "Drink Campaign";
    const campaignId = campaignObj?.id || 0;

    // Check if current branch is allowed in this campaign
    let isBranchAllowed = true;
    let branchRestrictionMessage: string | undefined;

    if (
      campaignObj &&
      Array.isArray(campaignObj.allowed_branches) &&
      campaignObj.allowed_branches.length > 0
    ) {
      const allowedBranchIds = campaignObj.allowed_branches.map((b) =>
        typeof b === "object" && b !== null
          ? Number((b as { id: number }).id)
          : Number(b),
      );
      if (!allowedBranchIds.includes(cashierContext.branchId)) {
        isBranchAllowed = false;
        branchRestrictionMessage = `هذه القسيمة غير صالحة للصرف في فرع ${cashierContext.branchName}، بل تقتصر على فروع محددة للحملة.`;
      }
    }

    // Resolve Selected Drink
    const selectedDrinkObj = doc.selected_drink as
      | { id: number; name: string }
      | undefined;
    const selectedDrink = {
      id: selectedDrinkObj?.id || 0,
      name: selectedDrinkObj?.name || "مشروب القسيمة",
    };

    // Resolve Redeemed Drink if already redeemed
    let redeemedDrink: { id: number; name: string } | null = null;
    if (doc.redeemed_drink && typeof doc.redeemed_drink === "object") {
      const rd = doc.redeemed_drink as { id: number; name: string };
      redeemedDrink = { id: rd.id, name: rd.name };
    }

    // Resolve branch and cashier display names if already redeemed
    const branchName =
      typeof doc.branch === "object" && doc.branch !== null
        ? (doc.branch as { name: string }).name
        : null;
    const cashierName =
      typeof doc.cashier === "object" && doc.cashier !== null
        ? (doc.cashier as { name: string }).name
        : null;

    // Resolve eligible alternative drinks from allowed_drinks_snapshot
    let allowedDrinkIds: number[] = [];
    if (Array.isArray(doc.allowed_drinks_snapshot)) {
      allowedDrinkIds = doc.allowed_drinks_snapshot.map(Number);
    } else if (typeof doc.allowed_drinks_snapshot === "string") {
      try {
        allowedDrinkIds = JSON.parse(doc.allowed_drinks_snapshot).map(Number);
      } catch {
        allowedDrinkIds = [];
      }
    }

    // Fallback: If snapshot has <= 1 drink, check if the campaign has categories and load active drinks
    if (allowedDrinkIds.length <= 1 && campaignId) {
      try {
        const fullCampaign = await payload.findByID({
          collection: "drink-campaigns",
          id: campaignId,
          depth: 1,
        });
        if (
          fullCampaign &&
          Array.isArray(fullCampaign.allowed_categories) &&
          fullCampaign.allowed_categories.length > 0
        ) {
          const catIds = fullCampaign.allowed_categories.map((c: unknown) =>
            typeof c === "object" && c !== null
              ? Number((c as { id: number }).id)
              : Number(c),
          );
          const catDrinks = await payload.find({
            collection: "drinks",
            where: {
              and: [
                { category: { in: catIds } },
                { active: { equals: true } },
              ],
            },
            depth: 0,
            limit: 100,
          });
          if (catDrinks.totalDocs > 0) {
            allowedDrinkIds = catDrinks.docs.map((d) => Number(d.id));
          }
        }
      } catch (err) {
        console.warn(
          "[DrinkRedemptionService] Failed to fetch campaign category drinks fallback:",
          err,
        );
      }
    }

    // Ensure selected drink is included in allowedDrinkIds
    if (selectedDrink.id && !allowedDrinkIds.includes(selectedDrink.id)) {
      allowedDrinkIds.push(selectedDrink.id);
    }

    const alternativeDrinks: {
      id: number;
      name: string;
      categoryName?: string;
    }[] = [];
    if (allowedDrinkIds.length > 0) {
      const drinksDocs = await payload.find({
        collection: "drinks",
        where: {
          and: [{ id: { in: allowedDrinkIds } }, { active: { equals: true } }],
        },
        depth: 1,
        limit: 150,
      });

      for (const d of drinksDocs.docs) {
        const catName =
          d.category && typeof d.category === "object"
            ? (d.category as { name?: string }).name
            : undefined;
        alternativeDrinks.push({
          id: Number(d.id),
          name: d.name,
          categoryName: catName,
        });
      }
    }

    return {
      found: true,
      voucher: {
        id: Number(doc.id),
        voucherCode: doc.voucher_code,
        customerName: doc.customer_name,
        phone: doc.phone,
        maskedPhone: doc.phone,
        status: displayStatus,
        campaignId,
        campaignTitle,
        expiresAt: doc.expires_at,
        isExpired,
        issuedAt: doc.issued_at,
        redeemedAt: doc.redeemed_at || null,
        changeReason: doc.change_reason || null,
        branchName,
        cashierName,
        selectedDrink,
        redeemedDrink,
        isBranchAllowed,
        branchRestrictionMessage,
        allowedAlternativeDrinks: alternativeDrinks,
      },
    };
  }

  /**
   * Atomically redeem a voucher at the branch terminal.
   * Enforces:
   * 1. Cashier authentication & server-side branch resolution
   * 2. Transactional row lock on entitlement (SELECT FOR UPDATE)
   * 3. Prevents double-redemption (status MUST be ISSUED)
   * 4. Expiration check against Egyptian time / NOW()
   * 5. Branch permission check
   * 6. Beverage substitution verification + mandatory change reason
   * 7. Atomic update with cashier & branch stamped
   */
  async redeemVoucher(
    params: RedeemVoucherParams,
  ): Promise<RedeemVoucherResult> {
    const {
      voucherCode: rawCode,
      servedDrinkId,
      changeReason,
      adminOverrideBranchId,
      resolvedContext,
    } = params;

    // 1. Resolve cashier context server-side (reuse pre-resolved context if provided)
    const cashierCheck = resolvedContext
      ? { success: true as const, context: resolvedContext }
      : await this.resolveCashierContext(adminOverrideBranchId);

    if (!cashierCheck.success) {
      return {
        success: false,
        reason: cashierCheck.reason,
        message: cashierCheck.message,
      };
    }
    const { user, branchId, branchName } = cashierCheck.context;

    const voucherCode = rawCode.trim().toUpperCase();
    const payload = await getPayloadClient();

    try {
      const redemptionResult = await payload.db.drizzle.transaction(
        async (tx) => {
          // A. Lock Entitlement row for update
          const rows = await tx.execute(sql`
          SELECT
            e.id,
            e.voucher_code,
            e.campaign_id,
            e.customer_name,
            e.phone,
            e.selected_drink_id,
            e.status,
            e.issued_at,
            e.expires_at,
            e.allowed_drinks_snapshot,
            c.title AS campaign_title,
            sd.name AS selected_drink_name
          FROM drink_entitlements e
          JOIN drink_campaigns c ON c.id = e.campaign_id
          LEFT JOIN drinks sd ON sd.id = e.selected_drink_id
          WHERE e.voucher_code = ${voucherCode}
          FOR UPDATE OF e
        `);

          if (!rows.rows || rows.rows.length === 0) {
            throw new Error("VOUCHER_NOT_FOUND");
          }

          const entitlement = rows.rows[0] as {
            id: number;
            voucher_code: string;
            campaign_id: number;
            customer_name: string;
            phone: string;
            selected_drink_id: number;
            status: string;
            issued_at: string;
            expires_at: string;
            allowed_drinks_snapshot: unknown;
            campaign_title: string;
            selected_drink_name?: string;
          };

          // B. Check voucher status
          if (entitlement.status === "REDEEMED") {
            throw new Error("ALREADY_REDEEMED");
          }
          if (entitlement.status === "CANCELLED") {
            throw new Error("VOUCHER_CANCELLED");
          }

          // C. Check expiration
          const now = new Date();
          if (new Date(entitlement.expires_at) <= now) {
            // Stamp EXPIRED
            await tx.execute(sql`
            UPDATE drink_entitlements
            SET status = 'EXPIRED', updated_at = NOW()
            WHERE id = ${entitlement.id}
          `);
            throw new Error("VOUCHER_EXPIRED");
          }

          // D. Check Branch restriction for this campaign
          const allowedBranchesQuery = await tx.execute(sql`
          SELECT branches_id
          FROM drink_campaigns_rels
          WHERE parent_id = ${entitlement.campaign_id} AND path = 'allowed_branches'
        `);

          const allowedBranchIds = (allowedBranchesQuery.rows || []).map(
            (r) => (r as { branches_id: number }).branches_id,
          );

          if (
            allowedBranchIds.length > 0 &&
            !allowedBranchIds.includes(branchId)
          ) {
            throw new Error("BRANCH_NOT_ALLOWED");
          }

          // E. Determine actual served drink
          const finalDrinkId = servedDrinkId
            ? Number(servedDrinkId)
            : entitlement.selected_drink_id;
          const isSubstituted = finalDrinkId !== entitlement.selected_drink_id;

          // If substituted, reason is mandatory
          if (isSubstituted) {
            if (!changeReason || changeReason.trim().length < 3) {
              throw new Error("CHANGE_REASON_REQUIRED");
            }

            // Validate that the substituted drink is in the customer's snapshot
            let snapshotIds: number[] = [];
            if (Array.isArray(entitlement.allowed_drinks_snapshot)) {
              snapshotIds = entitlement.allowed_drinks_snapshot.map(Number);
            } else if (
              typeof entitlement.allowed_drinks_snapshot === "string"
            ) {
              try {
                snapshotIds = JSON.parse(
                  entitlement.allowed_drinks_snapshot,
                ).map(Number);
              } catch {
                snapshotIds = [];
              }
            }

            if (snapshotIds.length > 0 && !snapshotIds.includes(finalDrinkId)) {
              // Safety fallback: Check if the campaign itself allows the category of this drink
              const campCheck = await tx.execute(sql`
                SELECT allowed_categories FROM drink_campaigns WHERE id = ${entitlement.campaign_id} LIMIT 1
              `);
              let isCategoryAllowed = false;
              if (campCheck.rows && campCheck.rows.length > 0) {
                const cats = (campCheck.rows[0] as { allowed_categories: unknown }).allowed_categories;
                const drinkCatCheck = await tx.execute(sql`
                  SELECT category_id FROM drinks WHERE id = ${finalDrinkId} AND active = true LIMIT 1
                `);
                if (drinkCatCheck.rows && drinkCatCheck.rows.length > 0) {
                  const dCatId = Number((drinkCatCheck.rows[0] as { category_id: number }).category_id);
                  const allowedCats = Array.isArray(cats) ? cats.map(Number) : [];
                  if (allowedCats.includes(dCatId)) {
                    isCategoryAllowed = true;
                  }
                }
              }
              if (!isCategoryAllowed) {
                throw new Error("INVALID_SERVED_DRINK");
              }
            }
          }

          // Fetch served drink name
          const drinkQuery = await tx.execute(sql`
          SELECT name FROM drinks WHERE id = ${finalDrinkId} LIMIT 1
        `);
          const servedDrinkName =
            drinkQuery.rows && drinkQuery.rows.length > 0
              ? (drinkQuery.rows[0] as { name: string }).name
              : "مشروب كوفي باي";

          // F. Execute Atomic Redemption Update (Double-guarded by FOR UPDATE lock + WHERE status = 'ISSUED')
          const nowStr = new Date().toISOString();
          const updateRes = await tx.execute(sql`
          UPDATE drink_entitlements
          SET
            status = 'REDEEMED',
            redeemed_drink_id = ${finalDrinkId},
            branch_id = ${branchId},
            cashier_id = ${Number(user.id)},
            redeemed_at = ${nowStr},
            change_reason = ${isSubstituted ? changeReason?.trim() : null},
            updated_at = NOW()
          WHERE id = ${entitlement.id}
            AND status = 'ISSUED'
        `);

          if (
            typeof updateRes.rowCount === "number" &&
            updateRes.rowCount === 0
          ) {
            throw new Error("ALREADY_REDEEMED");
          }

          return {
            id: entitlement.id,
            voucherCode: entitlement.voucher_code,
            customerName: entitlement.customer_name,
            phone: entitlement.phone,
            status: "REDEEMED",
            issuedAt: entitlement.issued_at,
            selectedDrinkName:
              entitlement.selected_drink_name || servedDrinkName,
            servedDrinkName,
            branchName,
            cashierName: user.name || "موظف كوفي باي",
            redeemedAt: nowStr,
            wasSubstituted: isSubstituted,
            changeReason: isSubstituted ? changeReason?.trim() : null,
          };
        },
      );

      return {
        success: true,
        message: "تم صرف المشروب بنجاح وتسجيل عملية الاسترداد.",
        redemption: redemptionResult,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[DrinkRedemptionService] Redemption failed:", errMsg);

      if (errMsg === "VOUCHER_NOT_FOUND") {
        return {
          success: false,
          reason: "VOUCHER_NOT_FOUND",
          message: "القسيمة غير موجودة.",
        };
      }
      if (errMsg === "ALREADY_REDEEMED") {
        return {
          success: false,
          reason: "ALREADY_REDEEMED",
          message: "تم صرف هذه القسيمة مسبقاً.",
        };
      }
      if (errMsg === "VOUCHER_EXPIRED") {
        return {
          success: false,
          reason: "VOUCHER_EXPIRED",
          message: "عذراً، انتهت صلاحية هذه القسيمة.",
        };
      }
      if (errMsg === "VOUCHER_CANCELLED") {
        return {
          success: false,
          reason: "VOUCHER_CANCELLED",
          message: "هذه القسيمة ملغاة إدارياً.",
        };
      }
      if (errMsg === "BRANCH_NOT_ALLOWED") {
        return {
          success: false,
          reason: "BRANCH_NOT_ALLOWED",
          message: `هذه القسيمة غير مسموح بصرفها في فرع ${branchName}.`,
        };
      }
      if (errMsg === "CHANGE_REASON_REQUIRED") {
        return {
          success: false,
          reason: "CHANGE_REASON_REQUIRED",
          message: "يجب كتابة سبب تغيير المشروب عند اختيار صنف بديل.",
        };
      }
      if (errMsg === "INVALID_SERVED_DRINK") {
        return {
          success: false,
          reason: "INVALID_SERVED_DRINK",
          message: "المشروب البديل غير مسموح به ضمن صلاحيات هذه القسيمة.",
        };
      }
      if (errMsg === "CONFLICTING_ASSIGNMENTS") {
        return {
          success: false,
          reason: "CONFLICTING_ASSIGNMENTS",
          message:
            "تم رصد أكثر من تعيين نشط لهذا المستخدم في فروع مختلفة. يرجى مراجعة إدارة النظام.",
        };
      }

      return {
        success: false,
        reason: "INTERNAL_ERROR",
        message:
          "حدث خطأ في النظام أثناء محاولة صرف القسيمة. يرجى المحاولة ثانية.",
      };
    }
  }
}

export const drinkRedemptionService = new DrinkRedemptionService();
