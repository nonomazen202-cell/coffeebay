import { getPayloadClient } from '../payload';
import { headers } from 'next/headers';

export interface AuthenticatedUser {
  id: string | number;
  name: string;
  email: string;
  role: 'ADMIN' | 'STAFF';
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
      role: authResult.user.role as 'ADMIN' | 'STAFF',
    };
  } catch (error) {
    console.error('[AUTH ERROR] Failed to retrieve session user:', error);
    return null;
  }
}
