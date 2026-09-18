import 'server-only';
import { cookies } from 'next/headers';
import { apiFetchOrNull, type User } from './api';

/**
 * The signed-in user, for server components.
 *
 * Reads the httpOnly access cookie and asks the API who it belongs to. It
 * returns null rather than throwing, because "signed out" is a normal state
 * that pages render differently — not an error.
 *
 * Note what this deliberately does NOT do: it never touches the refresh token.
 * Refreshing is a rotation, and rotating a 30-day credential as a side effect of
 * rendering a page would invalidate the session in any other tab.
 */
export async function getCurrentUser(): Promise<User | null> {
  const cookieHeader = cookies().toString();
  if (!cookieHeader.includes('pickixo_access')) return null;
  return apiFetchOrNull<User>('/me', { cookie: cookieHeader });
}

/** Pass the caller's cookies through to the API from a server component. */
export function forwardCookies(): string {
  return cookies().toString();
}
