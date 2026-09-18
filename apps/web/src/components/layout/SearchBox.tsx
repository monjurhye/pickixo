'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch, type SearchResponse } from '@/lib/api';
import { getVertical } from '@/lib/verticals';
import { StatusBadge } from '@/components/apps/AppCard';

/**
 * Global search across every vertical (§10).
 *
 * Results are grouped by section rather than shown as one flat list, because
 * "CV" legitimately matches a jobs tool, an AI product and a course — and which
 * section a result is in is most of what tells them apart.
 *
 * Only the public registry is searched. A user's own files, chats and My Apps
 * are never in this index (§147).
 */
export function SearchBox({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(null);
      return;
    }
    // Debounced, and aborted on the next keystroke, so typing does not queue a
    // request per character.
    const controller = new AbortController();
    const timer = setTimeout(() => {
      apiFetch<SearchResponse>(
        `/search?q=${encodeURIComponent(trimmed)}&limit=8`,
        { signal: controller.signal },
      )
        .then((data) => { setResults(data); setOpen(true); })
        .catch(() => { /* a failed suggestion is not worth an error message */ });
    }, 180);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setOpen(false);
    onNavigate?.();
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  const groups = results ? Object.entries(results.groups) : [];

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={submit} role="search">
        <label htmlFor="pickixo-search" className="sr-only">
          Search Pickixo
        </label>
        <div className="relative">
          <svg
            viewBox="0 0 20 20"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4
                       -translate-y-1/2 text-ink-subtle"
            aria-hidden="true"
          >
            <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
            <path d="M13.5 13.5 17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            id="pickixo-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results && setOpen(true)}
            placeholder="Search Pickixo"
            autoComplete="off"
            className="h-9 w-full rounded-control border border-border bg-surface pl-9 pr-3
                       text-small text-ink placeholder:text-ink-subtle
                       focus:border-accent focus:outline-none focus:ring-2
                       focus:ring-accent/25"
          />
        </div>
      </form>

      {open && results ? (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto
                     rounded-card border border-border bg-surface shadow-overlay"
        >
          {results.total === 0 ? (
            <p className="px-4 py-6 text-center text-small text-ink-muted">
              Nothing matched &ldquo;{results.query}&rdquo;.
            </p>
          ) : (
            groups.map(([vertical, items]) => (
              <div key={vertical} className="border-b border-border last:border-0">
                <p className="px-4 pb-1 pt-3 text-micro font-medium uppercase tracking-wide
                              text-ink-subtle">
                  {getVertical(vertical)?.name ?? vertical}
                </p>
                {items.map((app) => (
                  <Link
                    key={app.id}
                    href={app.route}
                    onClick={() => { setOpen(false); onNavigate?.(); }}
                    className="flex items-center justify-between gap-3 px-4 py-2
                               hover:bg-surface-sunken"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-small text-ink">{app.name}</span>
                      {app.tagline ? (
                        <span className="block truncate text-micro text-ink-subtle">
                          {app.tagline}
                        </span>
                      ) : null}
                    </span>
                    <StatusBadge status={app.status} />
                  </Link>
                ))}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
