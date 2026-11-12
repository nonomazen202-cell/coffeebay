import { getPayloadClient } from '../payload';
import { headers } from 'next/headers';
import type { AppRole } from './roles';

export interface AuthenticatedUser {
  id: string | number;
  name: string;
  email: string;
  role: AppRole;
}

export const authMock = {
  currentUser: null as AuthenticatedUser | null,
};

/**
 * Retrieves the currently authenticated user from Payload CMS using request headers.
 */
export async function getAuthUser(): Promise<AuthenticatedUser | null> {
  if (authMock.currentUser) {
    return authMock.currentUser;
  }
  try {
    const payload = await getPayloadClient();
    const authResult = await payload.auth({
      headers: await headers(),
    });

    if (!authResult || !authResult.user) {
      return null;
    }

    return {
      id: authResult.user.id,
      name: authResult.user.name ?? '',
      email: authResult.user.email ?? '',
      role: (authResult.user.role ?? 'PROMOTIONS_STAFF') as AppRole,
    };
  } catch (error) {
    console.error('[AUTH ERROR] Failed to retrieve session user:', error);
    return null;
  }
}
