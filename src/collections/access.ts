import type { Access, FieldAccess } from 'payload';

export const isAdmin: Access = ({ req: { user } }) => {
  return Boolean(user && user.role === 'ADMIN');
};

export const isAdminOrSelf: Access = ({ req: { user }, id }) => {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  return user.id === id;
};

export const isAdminOrStaff: Access = ({ req: { user } }) => {
  return Boolean(user && (user.role === 'ADMIN' || user.role === 'STAFF'));
};

export const isFieldAdmin: FieldAccess = ({ req: { user } }) => {
  return Boolean(user && user.role === 'ADMIN');
};
