/**
 * The one place that talks to the Pickixo API.
 *
 * Everything goes to a same-origin `/api/*` path, which next.config.mjs rewrites
 * to the backend (and nginx handles in production). That is not incidental: it
 * means the session cookies belong to the page's own origin, so they are sent
 * automatically by both the browser and server-side fetches, and there is no
 * cross-origin cookie problem to work around.
 *
 * Errors arrive as a stable code plus a translation key — never a raw message —
 * so the UI decides the wording and the user never sees an upstream error.
 */

export const INTERNAL_API =
  process.env.INTERNAL_API_URL ?? 'http://127.0.0.1:8010';

export type ApiErrorBody = {
  error: { code: string; messageKey: string; meta?: Record<string, unknown> };
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly messageKey: string,
    readonly meta?: Record<string, unknown>,
  ) {
    super(`${code} (${status})`);
    this.name = 'ApiError';
  }

  /** True when signing in again would plausibly fix it. */
  get isAuthProblem() {
    return this.status === 401;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  /** Forwarded cookie header, for calls made from a server component. */
  cookie?: string;
  /** Server-side caching. Public catalogue reads can be cached; nothing
   *  user-specific ever should be. */
  revalidate?: number | false;
  signal?: AbortSignal;
};

function endpoint(path: string): string {
  // On the server there is no origin to be relative to, so calls go straight to
  // the backend rather than back through Next.
  if (typeof window === 'undefined') return `${INTERNAL_API}/api${path}`;
  return `/api${path}`;
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, cookie, revalidate, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers['Cookie'] = cookie;

  const response = await fetch(endpoint(path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    // Without this the browser would not send the session cookies on a
    // same-origin fetch initiated by client code in every browser.
    credentials: 'include',
    signal,
    ...(revalidate === undefined
      ? { cache: 'no-store' as const }
      : revalidate === false
        ? { cache: 'no-store' as const }
        : { next: { revalidate } }),
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const err = (payload as ApiErrorBody).error;
    throw new ApiError(
      response.status,
      err?.code ?? 'internal_error',
      err?.messageKey ?? 'errors.internalError',
      err?.meta,
    );
  }
  return payload as T;
}

/**
 * For server components: fetch, but treat a failure as "no data" rather than a
 * crashed page.
 *
 * A dashboard section whose data did not load should render its empty state.
 * Taking the whole page down because one panel failed is the opposite of the
 * isolation the platform is supposed to have.
 */
export async function apiFetchOrNull<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T | null> {
  try {
    return await apiFetch<T>(path, options);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Types mirroring the API schemas
// ---------------------------------------------------------------------------
export type Vertical =
  | 'ai' | 'apps' | 'tools' | 'games' | 'jobs' | 'education' | 'banking' | 'bangladesh';

export type AppStatus = 'live' | 'beta' | 'planned' | 'disabled';

export type AppSummary = {
  id: string;
  slug: string;
  vertical: Vertical;
  name: string;
  name_bn: string | null;
  tagline: string | null;
  icon: string | null;
  route: string;
  status: AppStatus;
  is_featured: boolean;
  supports_my_apps: boolean;
  requires_auth: boolean;
};

export type AppDetail = AppSummary & {
  description: string | null;
  category: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image: string | null;
  structured_data_type: string | null;
  use_count: number;
  /** Real content change time, for og:modified_time. Never fabricated. */
  updated_at: string | null;
  /** Whether the caller already has this in My Apps. Null when signed out,
   *  which the UI renders differently from false. */
  in_my_apps: boolean | null;
};

export type MyAppEntry = {
  app: AppSummary;
  is_pinned: boolean;
  sort_order: number;
  added_at: string;
};

export type RecentEntry = {
  app: AppSummary;
  last_used_at: string;
  use_count: number;
};

export type User = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
  locale: 'en' | 'bn';
};

export type SearchResponse = {
  query: string;
  total: number;
  groups: Record<string, AppSummary[]>;
};

export type AiStatus = {
  available: boolean;
  free: boolean;
  quota: { kind: string; used: number; limit: number; remaining: number; is_guest: boolean };
  signed_in: boolean;
};
