/**
 * Turning a transcript into the things people actually want to leave with.
 *
 * Pure functions, no React, no DOM — so they are the easy part to reason about
 * and the easy part to reuse when the summary and translation features arrive.
 */

export type TranscriptSegment = {
  start: number;
  duration: number;
  text: string;
};

export type TranscriptVideo = {
  id: string;
  url: string;
  title: string | null;
  channel: string | null;
  channel_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
};

export type TranscriptResult = {
  video: TranscriptVideo;
  language: string;
  segment_count: number;
  transcript: TranscriptSegment[];
  cached: boolean;
};

/** `MM:SS`, or `H:MM:SS` once there is an hour to show. */
export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** `HH:MM:SS,mmm` — the SRT spec, comma before milliseconds, not a full stop. */
export function formatSrtTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const whole = Math.floor(clamped);
  // Rounding rather than truncating: 3.9996s is 4.000, not 3.999. Then carry,
  // because 1000ms is not a valid millisecond field.
  let ms = Math.round((clamped - whole) * 1000);
  let secs = whole;
  if (ms === 1000) {
    ms = 0;
    secs += 1;
  }
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

/** Just the words, as flowing text. What "Copy" gives you. */
export function toPlainText(segments: TranscriptSegment[]): string {
  return segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();
}

/** Words with their timestamps, one segment per line. */
export function toTimestampedText(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => `[${formatTimestamp(s.start)}] ${s.text}`)
    .join('\n');
}

/** The .txt download: a header identifying the video, then the transcript. */
export function toTxtFile(result: TranscriptResult): string {
  const { video, language } = result;
  const header = [
    video.title ?? 'YouTube transcript',
    video.channel ? `Channel: ${video.channel}` : null,
    `Video: ${video.url}`,
    `Language: ${language}`,
    '',
    'Transcript',
    '----------',
    '',
  ].filter((line) => line !== null);

  return `${header.join('\n')}\n${toTimestampedText(result.transcript)}\n`;
}

/**
 * A valid SRT file.
 *
 * Two things subtitle players are strict about, and that naive generators get
 * wrong: cues must be numbered from 1 with no gaps, and a cue must not end
 * after the next one starts. YouTube segment durations do sometimes overlap the
 * following segment, so the end time is clamped — an overlapping cue makes
 * players drop or flicker subtitles.
 */
export function toSrtFile(segments: TranscriptSegment[]): string {
  const blocks: string[] = [];

  segments.forEach((segment, index) => {
    const next = segments[index + 1];
    let end = segment.start + segment.duration;

    // Clamp to the next cue's start.
    if (next && end > next.start) end = next.start;
    // A zero- or negative-length cue is invalid; give it a readable minimum.
    if (end <= segment.start) end = segment.start + 0.5;

    blocks.push(
      [
        String(index + 1),
        `${formatSrtTime(segment.start)} --> ${formatSrtTime(end)}`,
        segment.text,
        '',
      ].join('\n'),
    );
  });

  return blocks.join('\n');
}

/** A filesystem-safe filename stem from the video title. */
export function safeFilename(title: string | null, videoId: string): string {
  if (!title) return `youtube-transcript-${videoId}`;
  const cleaned = title
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return cleaned || `youtube-transcript-${videoId}`;
}

/**
 * Client-side URL check, matching the server's rules.
 *
 * The server validates again and is the one that counts — this exists only so
 * an obvious typo gets an instant answer instead of a round trip.
 */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
  'youtube-nocookie.com', 'www.youtube-nocookie.com',
  'youtu.be', 'www.youtu.be',
]);

export function looksLikeYouTubeUrl(raw: string): boolean {
  const value = raw.trim();
  if (!value || value.length > 2048) return false;
  if (VIDEO_ID.test(value)) return true;

  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return false;

    if (url.hostname.endsWith('youtu.be')) {
      return VIDEO_ID.test(url.pathname.replace(/^\//, '').split('/')[0] ?? '');
    }
    const v = url.searchParams.get('v');
    if (v) return VIDEO_ID.test(v);

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && ['shorts', 'embed', 'v', 'live'].includes(parts[0]!)) {
      return VIDEO_ID.test(parts[1]!);
    }
    return false;
  } catch {
    return false;
  }
}
