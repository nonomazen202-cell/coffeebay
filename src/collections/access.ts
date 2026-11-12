import type { Access, FieldAccess, Where } from 'payload';
import {
  isSuperAdmin,
  hasPromotionsAccess,
  hasPromotionsAdminAccess,
  hasLuckyCupAccess,
  hasLuckyCupAdminAccess,
  canManageUsers,
  getCanonicalRole,
} from '../lib/security/roles';

// ─── Super Admin Access ───────────────────────────────────────────────────────
export const isSuperAdminAccess: Access = ({ req: { user } }) => {
  return Boolean(user && isSuperAdmin(user));
};

// ─── Promotions Domain Access ────────────────────────────────────────────────
export const isPromotionsAdminAccess: Access = ({ req: { user } }) => {
  return Boolean(user && hasPromotionsAdminAccess(user));
};

export const isPromotionsStaffOrAdminAccess: Access = ({ req: { user } }) => {
  return Boolean(user && hasPromotionsAccess(user));
};

// ─── Lucky Cup Domain Access ─────────────────────────────────────────────────
export const isLuckyCupAdminAccess: Access = ({ req: { user } }) => {
  return Boolean(user && hasLuckyCupAdminAccess(user));
};

export const isLuckyCupStaffOrAdminAccess: Access = ({ req: { user } }) => {
  return Boolean(user && hasLuckyCupAccess(user));
};

// ─── User Management Access ──────────────────────────────────────────────────
export const canManageUsersAccess: Access = ({ req: { user } }) => {
  return Boolean(user && canManageUsers(user));
};

export const canManageUsersOrSelfAccess: Access = ({ req: { user }, id }) => {
  if (!user) return false;
  if (canManageUsers(user)) return true;
  return String(user.id) === String(id);
};

export const usersReadAccess: Access = ({ req: { user } }) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;

  const role = getCanonicalRole(user.role);
  if (role === 'PROMOTIONS_ADMIN') {
    const constraint: Where = {
      or: [
        { id: { equals: user.id } },
        { role: { in: ['PROMOTIONS_ADMIN', 'PROMOTIONS_STAFF'] } },
      ],
    };
    return constraint;
  }

  if (role === 'LUCKY_CUP_ADMIN') {
    const constraint: Where = {
      or: [
        { id: { equals: user.id } },
        { role: { in: ['LUCKY_CUP_ADMIN', 'LUCKY_CUP_STAFF'] } },
      ],
    };
    return constraint;
  }

  // Staff roles can only read their own record
  const selfOnly: Where = {
    id: { equals: user.id },
  };
  return selfOnly;
};

export const usersUpdateAccess: Access = ({ req: { user } }) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;

  const role = getCanonicalRole(user.role);
  if (role === 'PROMOTIONS_ADMIN') {
    const constraint: Where = {
      or: [
        { id: { equals: user.id } },
        { role: { in: ['PROMOTIONS_ADMIN', 'PROMOTIONS_STAFF'] } },
      ],
    };
    return constraint;
  }

  if (role === 'LUCKY_CUP_ADMIN') {
    const constraint: Where = {
      or: [
        { id: { equals: user.id } },
        { role: { in: ['LUCKY_CUP_ADMIN', 'LUCKY_CUP_STAFF'] } },
      ],
    };
    return constraint;
  }

  const selfOnly: Where = {
    id: { equals: user.id },
  };
  return selfOnly;
};

export const notificationsReadAccess: Access = ({ req: { user } }) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;

  const role = getCanonicalRole(user.role);
  if (role === 'PROMOTIONS_ADMIN') {
    const constraint: Where = {
      template: {
        in: ['drink-reward-otp', 'drink-reward-voucher', 'drink-reward-admin-alert'],
      },
    };
    return constraint;
  }

  if (role === 'LUCKY_CUP_ADMIN') {
    const constraint: Where = {
      template: {
        in: ['verification', 'winner-notification', 'admin-alert'],
      },
    };
    return constraint;
  }

  return false;
};

export const isFieldSuperAdmin: FieldAccess = ({ req: { user } }) => {
  return Boolean(user && isSuperAdmin(user));
};

export const isFieldRoleManager: FieldAccess = ({ req: { user } }) => {
  return Boolean(user && canManageUsers(user));
};

// ─── Backwards-Compatible Shims ──────────────────────────────────────────────
export const isAdmin: Access = ({ req: { user } }) => {
  return Boolean(user && (isSuperAdmin(user) || hasPromotionsAdminAccess(user) || hasLuckyCupAdminAccess(user)));
};

export const isAdminOrSelf: Access = canManageUsersOrSelfAccess;

export const isAdminOrStaff: Access = ({ req: { user } }) => {
  return Boolean(user && (hasPromotionsAccess(user) || hasLuckyCupAccess(user)));
};

export const isFieldAdmin: FieldAccess = ({ req: { user } }) => {
  return Boolean(user && canManageUsers(user));
};
