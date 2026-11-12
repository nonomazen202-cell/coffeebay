/**
 * Centralized Role-Based Access Control (RBAC) & Domain Isolation Engine.
 * 
 * Domains:
 * 1. PROMOTIONS: Campaigns, Drinks Menu, Categories, Vouchers, Branches, Cashier POS Terminal, Reports.
 * 2. LUCKY_CUP: Seeded Serial Codes, Prizes Catalog, Entries, Participants, Prize Claims Pipeline.
 * 3. SHARED: Media Library, Users Management, Global Settings, Infrastructure Notifications.
 * 
 * Five Canonical Roles:
 * - SUPER_ADMIN: Full cross-domain administrative oversight, user management, and system development.
 * - PROMOTIONS_ADMIN: Domain Administrator for Promotions & Beverages.
 * - PROMOTIONS_STAFF: Operational Cashier / Barista for Promotions (POS Terminal + Vouchers lookup).
 * - LUCKY_CUP_ADMIN: Domain Administrator for Lucky Cup Contest.
 * - LUCKY_CUP_STAFF: Operational Staff for Lucky Cup Prize Verification & Delivery.
 */

export type AppRole =
  | 'SUPER_ADMIN'
  | 'PROMOTIONS_ADMIN'
  | 'PROMOTIONS_STAFF'
  | 'LUCKY_CUP_ADMIN'
  | 'LUCKY_CUP_STAFF'
  // Legacy aliases for seamless backwards-compatibility
  | 'ADMIN'
  | 'STAFF';

export interface UserRoleLike {
  id?: string | number;
  role?: string | null;
  email?: string | null;
  name?: string | null;
}

/**
 * Normalizes legacy roles into canonical domain roles.
 * - Legacy 'ADMIN' maps to 'PROMOTIONS_ADMIN' by default (as decided by business requirements).
 * - Legacy 'STAFF' maps to 'PROMOTIONS_STAFF' (the active Cairo Flagship cashier).
 */
export function getCanonicalRole(role?: string | null): AppRole {
  if (!role) return 'PROMOTIONS_STAFF';
  const upper = role.toUpperCase();
  if (upper === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (upper === 'PROMOTIONS_ADMIN') return 'PROMOTIONS_ADMIN';
  if (upper === 'PROMOTIONS_STAFF') return 'PROMOTIONS_STAFF';
  if (upper === 'LUCKY_CUP_ADMIN') return 'LUCKY_CUP_ADMIN';
  if (upper === 'LUCKY_CUP_STAFF') return 'LUCKY_CUP_STAFF';

  // Legacy mappings:
  if (upper === 'ADMIN') return 'LUCKY_CUP_ADMIN';
  if (upper === 'STAFF') return 'PROMOTIONS_STAFF';

  return 'PROMOTIONS_STAFF';
}

/**
 * Checks if the user is a Super Administrator (Full Cross-Domain Access).
 */
export function isSuperAdmin(user?: UserRoleLike | null): boolean {
  if (!user || !user.role) return false;
  return user.role.toUpperCase() === 'SUPER_ADMIN';
}

/**
 * Checks if the user is a Promotions Domain Administrator.
 */
export function isPromotionsAdmin(user?: UserRoleLike | null): boolean {
  if (!user || !user.role) return false;
  const canonical = getCanonicalRole(user.role);
  return canonical === 'PROMOTIONS_ADMIN';
}

/**
 * Checks if the user is a Promotions Staff member / Cashier.
 */
export function isPromotionsStaff(user?: UserRoleLike | null): boolean {
  if (!user || !user.role) return false;
  const canonical = getCanonicalRole(user.role);
  return canonical === 'PROMOTIONS_STAFF';
}

/**
 * Checks if the user has access to Promotions resources (Super Admin, Promotions Admin, or Promotions Staff).
 */
export function hasPromotionsAccess(user?: UserRoleLike | null): boolean {
  if (!user || !user.role) return false;
  if (isSuperAdmin(user)) return true;
  const canonical = getCanonicalRole(user.role);
  return canonical === 'PROMOTIONS_ADMIN' || canonical === 'PROMOTIONS_STAFF';
}

/**
 * Checks if the user has administrative privileges within Promotions (Super Admin or Promotions Admin).
 */
export function hasPromotionsAdminAccess(user?: UserRoleLike | null): boolean {
  if (!user || !user.role) return false;
  if (isSuperAdmin(user)) return true;
  return getCanonicalRole(user.role) === 'PROMOTIONS_ADMIN';
}

/**
 * Checks if the user is a Lucky Cup Domain Administrator.
 */
export function isLuckyCupAdmin(user?: UserRoleLike | null): boolean {
  if (!user || !user.role) return false;
  const canonical = getCanonicalRole(user.role);
  return canonical === 'LUCKY_CUP_ADMIN';
}

/**
 * Checks if the user is a Lucky Cup Staff member (Prize Claims delivery/verification).
 */
export function isLuckyCupStaff(user?: UserRoleLike | null): boolean {
  if (!user || !user.role) return false;
  const canonical = getCanonicalRole(user.role);
  return canonical === 'LUCKY_CUP_STAFF';
}

/**
 * Checks if the user has access to Lucky Cup resources (Super Admin, Lucky Cup Admin, or Lucky Cup Staff).
 */
export function hasLuckyCupAccess(user?: UserRoleLike | null): boolean {
  if (!user || !user.role) return false;
  if (isSuperAdmin(user)) return true;
  const canonical = getCanonicalRole(user.role);
  return canonical === 'LUCKY_CUP_ADMIN' || canonical === 'LUCKY_CUP_STAFF';
}

/**
 * Checks if the user has administrative privileges within Lucky Cup (Super Admin or Lucky Cup Admin).
 */
export function hasLuckyCupAdminAccess(user?: UserRoleLike | null): boolean {
  if (!user || !user.role) return false;
  if (isSuperAdmin(user)) return true;
  return getCanonicalRole(user.role) === 'LUCKY_CUP_ADMIN';
}

/**
 * User management permission:
 * - Super Admin can manage all users.
 * - Domain Admins can view/manage staff within their domain.
 */
export function canManageUsers(user?: UserRoleLike | null): boolean {
  if (!user || !user.role) return false;
  if (isSuperAdmin(user)) return true;
  const canonical = getCanonicalRole(user.role);
  return canonical === 'PROMOTIONS_ADMIN' || canonical === 'LUCKY_CUP_ADMIN';
}

/**
 * Label and badge helper for Admin UI.
 */
export function getRoleBadge(role?: string | null): { label: string; color: string; domain: string } {
  const canonical = getCanonicalRole(role);
  switch (canonical) {
    case 'SUPER_ADMIN':
      return {
        label: 'Super Admin / مدير عام المنظومة',
        color: '#D97706', // Amber Gold
        domain: 'All Domains',
      };
    case 'PROMOTIONS_ADMIN':
      return {
        label: 'Promotions Admin / مدير الحملات والعروض',
        color: '#150958', // Deep Navy
        domain: 'Promotions',
      };
    case 'PROMOTIONS_STAFF':
      return {
        label: 'Promotions Staff / كاشير الفرع',
        color: '#2563EB', // Blue
        domain: 'Promotions',
      };
    case 'LUCKY_CUP_ADMIN':
      return {
        label: 'Lucky Cup Admin / مدير مسابقة الأكواب',
        color: '#7C3AED', // Purple
        domain: 'Lucky Cup',
      };
    case 'LUCKY_CUP_STAFF':
      return {
        label: 'Lucky Cup Staff / موظف تسليم الجوائز',
        color: '#059669', // Emerald
        domain: 'Lucky Cup',
      };
    default:
      return {
        label: 'Staff Member / موظف',
        color: '#64748B',
        domain: 'Promotions',
      };
  }
}
