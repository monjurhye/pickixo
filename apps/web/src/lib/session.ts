import 'server-only';
import { cookies } from 'next/headers';
import { apiFetchOrNull, type User } from './api';
import { IS_STATIC_SITE } from './static-site';

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
 *
 * On the static site there are no sessions, and the answer is always null. The
 * check comes before cookies() on purpose: reading the request's cookies is
 * what makes a page per-request, and a page that is per-request cannot be
 * written out as a file.
 */
export async function getCurrentUser(): Promise<User | null> {
  if (IS_STATIC_SITE) return null;
  const cookieHeader = cookies().toString();
  if (!cookieHeader.includes('pickixo_access')) return null;
  return apiFetchOrNull<User>('/me', { cookie: cookieHeader });
}

/** Pass the caller's cookies through to the API from a server component. */
export function forwardCookies(): string {
  if (IS_STATIC_SITE) return '';
  return cookies().toString();
}
