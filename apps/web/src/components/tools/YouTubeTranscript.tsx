'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Badge } from '@/components/ui/States';
import {
  formatTimestamp,
  looksLikeYouTubeUrl,
  safeFilename,
  toPlainText,
  toSrtFile,
  toTimestampedText,
  toTxtFile,
  type TranscriptResult,
} from '@/lib/transcript';

/**
 * The YouTube Transcript tool.
 *
 * Paste, fetch, read, take it away. Everything else is deliberately absent.
 *
 * The API key lives only on the server; this component talks to
 * /api/tools/youtube-transcript and never sees a provider credential.
 */

/** Error copy, keyed by the stable code the API returns. Never the server's
 *  own words — those can name the provider and cannot be translated. */
const MESSAGES: Record<string, string> = {
  invalid_youtube_url:
    'That does not look like a YouTube link. Paste a link like ' +
    'https://www.youtube.com/watch?v=… or https://youtu.be/…',
  transcript_unavailable:
    'We could not find a transcript for this video. It may have no captions, ' +
    'or it may be private or unavailable.',
  transcript_too_large:
    'This video is too long for us to process. Try a shorter one.',
  transcript_failed:
    'We could not get the transcript right now. Please try again in a moment.',
  provider_not_configured:
    'The transcript service is not available right now. Please try again later.',
  provider_quota_exhausted:
    'The transcript service is at its limit right now. Please try again later.',
  service_busy: 'Too many requests. Please wait a moment and try again.',
  daily_limit_reached:
    'You have used your transcripts for today. Create a free account for a ' +
    'higher daily limit.',
};

const GENERIC = 'Something went wrong. Please try again.';

type Status = { available: boolean; quota: { remaining: number; limit: number; is_guest: boolean } };

export function YouTubeTranscript() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Ask the server what it can actually do before offering to do it.
  useEffect(() => {
    apiFetch<Status>('/tools/youtube-transcript/status')
      .then(setStatus)
      .catch(() => { /* the button still works; the hint is just absent */ });
  }, []);

  // Clear the "Copied" confirmation on its own rather than leaving it stuck.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const submit = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();
      // The single most important guard against wasting a provider credit:
      // a second click while the first request is in flight does nothing.
      if (loading) return;

      const trimmed = url.trim();
      if (!trimmed) {
        setError('Paste a YouTube link first.');
        return;
      }
      if (!looksLikeYouTubeUrl(trimmed)) {
        // Answered here, without a round trip and without touching the provider.
        setError(MESSAGES.invalid_youtube_url!);
        return;
      }

      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const data = await apiFetch<TranscriptResult>(
          '/tools/youtube-transcript',
          { method: 'POST', body: { url: trimmed } },
        );
        setResult(data);
        // Move focus to the result so a screen reader announces it and a phone
        // scrolls to it rather than leaving the user looking at the form.
        requestAnimationFrame(() => resultRef.current?.focus());
        apiFetch<Status>('/tools/youtube-transcript/status')
          .then(setStatus)
          .catch(() => {});
      } catch (err) {
        setError(
          err instanceof ApiError ? (MESSAGES[err.code] ?? GENERIC) : GENERIC,
        );
      } finally {
        setLoading(false);
      }
    },
    [url, loading],
  );

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setError('Your browser blocked copying. Select the text and copy it manually.');
    }
  }

  function download(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Without this the blob stays in memory for the life of the page, which
    // matters when someone downloads several long transcripts.
    URL.revokeObjectURL(href);
  }

  const unavailable = status !== null && !status.available;

  return (
    <div>
      {/* --- input ---------------------------------------------------------- */}
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <Input
            label="YouTube URL"
            type="url"
            inputMode="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(null); }}
            disabled={loading}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="yt-help"
          />
        </div>
        <Button
          type="submit"
          size="lg"
          loading={loading}
          loadingLabel="Getting transcript"
          disabled={unavailable}
          className="sm:mt-[1.9rem] sm:w-auto"
          fullWidth
        >
          {loading ? 'Getting transcript…' : 'Get Transcript'}
        </Button>
      </form>

      <p id="yt-help" className="mt-2 text-small text-ink-muted">
        Works with normal videos, Shorts and <code className="text-ink">youtu.be</code>{' '}
        share links.
        {status && !unavailable ? (
          <span className="ml-1 text-ink-subtle">
            {status.quota.remaining} of {status.quota.limit} left today
            {status.quota.is_guest ? ' — sign in for more.' : '.'}
          </span>
        ) : null}
      </p>

      {unavailable ? (
        <p role="status" className="mt-4 rounded-control border border-border
                                    bg-surface-sunken px-4 py-3 text-small text-ink-muted">
          The transcript service is not configured on this server yet, so this
          tool cannot run right now.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-control border border-danger/30
                                   bg-danger/5 px-4 py-3 text-small text-danger">
          {error}
        </p>
      ) : null}

      {/* --- result --------------------------------------------------------- */}
      {result ? (
        <section
          ref={resultRef}
          tabIndex={-1}
          aria-label="Transcript"
          className="mt-8 rounded-card border border-border bg-surface outline-none"
        >
          <header className="border-b border-border p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-subheading text-ink">
                  {result.video.title ?? 'Transcript'}
                </h2>
                <p className="mt-1 text-small text-ink-muted">
                  {result.video.channel ? <>{result.video.channel} · </> : null}
                  {result.segment_count.toLocaleString()} lines
                  {result.video.duration_seconds
                    ? <> · {formatTimestamp(result.video.duration_seconds)}</>
                    : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge>{result.language.toUpperCase()}</Badge>
                {result.cached ? <Badge>Cached</Badge> : null}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => copy(toPlainText(result.transcript), 'text')}
              >
                {copied === 'text' ? '✓ Copied' : 'Copy transcript'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => copy(toTimestampedText(result.transcript), 'stamped')}
              >
                {copied === 'stamped' ? '✓ Copied' : 'Copy with timestamps'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  download(
                    toTxtFile(result),
                    `${safeFilename(result.video.title, result.video.id)}.txt`,
                    'text/plain',
                  )
                }
              >
                Download TXT
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  download(
                    toSrtFile(result.transcript),
                    `${safeFilename(result.video.title, result.video.id)}.srt`,
                    'application/x-subrip',
                  )
                }
              >
                Download SRT
              </Button>
            </div>
          </header>

          {/* Capped height with its own scroll: a three-hour transcript must not
              turn the page into an endless scroll past the controls above. */}
          <div className="max-h-[32rem] overflow-y-auto p-5">
            <ol className="space-y-3">
              {result.transcript.map((segment, index) => (
                <li key={`${segment.start}-${index}`} className="flex gap-4">
                  <a
                    href={`${result.video.url}&t=${Math.floor(segment.start)}s`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 pt-0.5 font-mono text-micro text-accent-ink
                               tabular-nums hover:underline"
                    title="Open this moment on YouTube"
                  >
                    {formatTimestamp(segment.start)}
                  </a>
                  <p className="text-body leading-relaxed text-ink">{segment.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}
    </div>
  );
}
