'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch, type MyAppEntry } from '@/lib/api';
import { StatusBadge } from '@/components/apps/AppCard';
import { cn } from '@/lib/utils';

/**
 * My Apps: pin, reorder, remove (§16-§18).
 *
 * Reordering is offered two ways on purpose. Drag-and-drop is the natural
 * desktop gesture, but it is close to unusable on a touch screen and completely
 * unusable from a keyboard — so every row also has Move up / Move down buttons,
 * which work everywhere and are what a screen reader announces.
 *
 * Order is applied optimistically and saved in one request carrying the whole
 * list, so a dropped request leaves the server holding the previous order
 * rather than a half-applied one.
 */
export function MyAppsList({ initial }: { initial: MyAppEntry[] }) {
  const router = useRouter();
  const [entries, setEntries] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function persist(next: MyAppEntry[]) {
    const previous = entries;
    setEntries(next);
    setError(null);
    try {
      await apiFetch('/me/apps/order', {
        method: 'PUT',
        body: { app_ids: next.map((e) => e.app.id) },
      });
    } catch {
      setEntries(previous);
      setError('Could not save that order. Your apps are unchanged.');
    }
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= entries.length) return;
    const next = [...entries];
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    void persist(next);
  }

  async function togglePin(entry: MyAppEntry) {
    const next = entries.map((e) =>
      e.app.id === entry.app.id ? { ...e, is_pinned: !e.is_pinned } : e,
    );
    // Pinned items sort first; mirror that locally so the row moves at once.
    next.sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned));
    setEntries(next);
    try {
      await apiFetch(`/me/apps/${entry.app.id}/pin`, {
        method: 'PATCH',
        body: { is_pinned: !entry.is_pinned },
      });
      router.refresh();
    } catch {
      setEntries(entries);
      setError('Could not change that pin.');
    }
  }

  async function remove(entry: MyAppEntry) {
    const previous = entries;
    setEntries(entries.filter((e) => e.app.id !== entry.app.id));
    try {
      await apiFetch(`/me/apps/${entry.app.id}`, { method: 'DELETE' });
      router.refresh();
    } catch {
      setEntries(previous);
      setError('Could not remove that app.');
    }
  }

  function onDrop(targetId: string) {
    if (!dragging || dragging === targetId) return;
    const from = entries.findIndex((e) => e.app.id === dragging);
    const to = entries.findIndex((e) => e.app.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...entries];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    setDragging(null);
    void persist(next);
  }

  return (
    <div>
      {error ? (
        <p role="alert" className="mb-4 rounded-control border border-danger/30
                                   bg-danger/5 px-3 py-2 text-small text-danger">
          {error}
        </p>
      ) : null}

      <ul className="space-y-2">
        {entries.map((entry, index) => (
          <li
            key={entry.app.id}
            draggable
            onDragStart={() => setDragging(entry.app.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(entry.app.id)}
            onDragEnd={() => setDragging(null)}
            className={cn(
              'flex items-center gap-3 rounded-card border border-border bg-surface p-3',
              dragging === entry.app.id && 'opacity-50',
            )}
          >
            <span
              aria-hidden="true"
              className="hidden cursor-grab select-none px-1 text-ink-subtle md:block"
              title="Drag to reorder"
            >
              ⠿
            </span>

            <div className="min-w-0 flex-1">
              <Link
                href={entry.app.route}
                className="flex items-center gap-2 text-body text-ink hover:underline"
              >
                <span className="truncate">{entry.app.name}</span>
                <StatusBadge status={entry.app.status} />
              </Link>
              {entry.app.tagline ? (
                <p className="truncate text-micro text-ink-subtle">{entry.app.tagline}</p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move ${entry.app.name} up`}
                className="h-8 w-8 rounded-control text-ink-subtle hover:bg-surface-sunken
                           disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === entries.length - 1}
                aria-label={`Move ${entry.app.name} down`}
                className="h-8 w-8 rounded-control text-ink-subtle hover:bg-surface-sunken
                           disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => togglePin(entry)}
                aria-pressed={entry.is_pinned}
                aria-label={
                  entry.is_pinned
                    ? `Unpin ${entry.app.name}`
                    : `Pin ${entry.app.name} to the top`
                }
                className={cn(
                  'h-8 w-8 rounded-control hover:bg-surface-sunken',
                  entry.is_pinned ? 'text-accent-ink' : 'text-ink-subtle',
                )}
              >
                {entry.is_pinned ? '★' : '☆'}
              </button>
              <button
                type="button"
                onClick={() => remove(entry)}
                aria-label={`Remove ${entry.app.name} from My Apps`}
                className="h-8 w-8 rounded-control text-ink-subtle hover:bg-surface-sunken
                           hover:text-danger"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
