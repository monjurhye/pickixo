/**
 * Saying things out loud, and listening to the child.
 *
 * A four-year-old cannot read the instruction, so audio is not a nice-to-have
 * here — a silent Pickixo Kids is an unusable Pickixo Kids. Every instruction,
 * every letter and every word can be spoken, and the speaker button is always
 * on screen (§10).
 *
 * Recorded Bangla audio would be better than synthesis and this is written so
 * it can replace it without touching a component: every item carries an
 * `audio` field and `say()` is only reached when it is null.
 *
 * Known limits, designed around rather than hidden:
 *   * bn-BD voices exist on most Android builds and on few desktops;
 *   * the voice list is often empty on the first call and fills later;
 *   * iOS will not speak at all until the child has tapped something.
 * In each case the UI stays usable and simply has no sound. A silent button is
 * better than a frozen one, and no screen ever waits for audio to finish.
 */

/** bn-BD first: the learner is Bangladeshi and bn-IN sounds audibly different. */
const BANGLA_LOCALES = ['bn-BD', 'bn-IN', 'bn'];

let cached: SpeechSynthesisVoice | null = null;
let unlocked = false;

export function speechSupported(): boolean {
  return typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && typeof window.SpeechSynthesisUtterance === 'function';
}

/**
 * Pick a Bangla voice.
 *
 * Re-attempted rather than cached as "none" on a first miss, because
 * getVoices() is famously empty until the browser fires `voiceschanged`.
 */
function pickVoice(): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null;
  if (cached) return cached;

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  for (const locale of BANGLA_LOCALES) {
    const match = voices.find(
      (v) => v.lang?.replace('_', '-').toLowerCase().startsWith(locale.toLowerCase()),
    );
    if (match) { cached = match; return cached; }
  }
  // No Bangla voice. Returning null means we stay silent rather than reading
  // Bangla text aloud in an English voice, which is worse than nothing — it
  // would teach a child the wrong sound for the letter they are looking at.
  return null;
}

/** Whether this device can actually speak Bangla. Drives the UI, not an error. */
export function banglaAvailable(): boolean {
  return pickVoice() !== null;
}

/**
 * iOS refuses to speak until speech is started inside a real user gesture.
 *
 * Called from the first tap anywhere in the app. Speaking an empty string is
 * the standard way to satisfy the gesture requirement without making a noise.
 */
export function unlock(): void {
  if (unlocked || !speechSupported()) return;
  unlocked = true;
  try {
    const utterance = new SpeechSynthesisUtterance('');
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
  } catch { /* nothing to unlock */ }
}

export interface SayOptions {
  /** Slower for a single letter than for a sentence. */
  rate?: number;
  /** Called when speech finishes, or immediately if there is no voice. */
  onEnd?: () => void;
}

/**
 * Speak Bangla text.
 *
 * Cancels anything already speaking: a child who taps the speaker three times
 * should hear the word three times, not queue three copies and then sit
 * through all of them.
 *
 * `onEnd` fires even when nothing was spoken, so a caller can sequence
 * "hear the word, then show the choices" without special-casing silence.
 */
export function say(text: string, options: SayOptions = {}): void {
  const { rate = 0.85, onEnd } = options;

  if (!speechSupported()) { onEnd?.(); return; }
  const voice = pickVoice();
  if (!voice) { onEnd?.(); return; }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = rate;
    utterance.pitch = 1.05;
    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }
    window.speechSynthesis.speak(utterance);
  } catch {
    onEnd?.();
  }
}

/** A single letter, spoken slowly. */
export function sayLetter(glyph: string, onEnd?: () => void): void {
  say(glyph, { rate: 0.7, onEnd });
}

/**
 * Play a recorded file if there is one, otherwise synthesise.
 *
 * This is the whole reason every item carries `audio`. Adding real recordings
 * later is a JSON change and nothing else.
 */
export function playItem(
  audio: string | null,
  fallbackText: string,
  onEnd?: () => void,
): void {
  if (!audio) { sayLetter(fallbackText, onEnd); return; }
  try {
    const element = new Audio(audio);
    if (onEnd) {
      element.onended = onEnd;
      element.onerror = () => sayLetter(fallbackText, onEnd);
    }
    void element.play().catch(() => sayLetter(fallbackText, onEnd));
  } catch {
    sayLetter(fallbackText, onEnd);
  }
}

export function stop(): void {
  if (!speechSupported()) return;
  try { window.speechSynthesis.cancel(); } catch { /* already stopped */ }
}

/* -------------------------------------------------------------------------- */
/* Listening                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Whether the browser offers speech recognition at all.
 *
 * Bangla recognition is unreliable even where the API exists, which is why
 * §11 of the brief and this module both treat speaking as **optional and
 * never blocking**. The child always gets to continue.
 */
export function listeningSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export type ListenResult =
  | { heard: true; text: string; matched: boolean }
  | { heard: false };

/**
 * Listen for the child saying a word.
 *
 * Resolves `{ heard: false }` on every failure — unsupported browser, denied
 * microphone, silence, a timeout, or a recogniser that threw. The caller shows
 * `আমি শুনেছি! আবার চেষ্টা করো 😊` and moves on either way. Nothing here can
 * stop a child progressing, and a failure to match is never recorded as a
 * wrong answer.
 */
export function listen(expect: string, timeoutMs = 5000): Promise<ListenResult> {
  return new Promise((resolve) => {
    if (!listeningSupported()) { resolve({ heard: false }); return; }

    const w = window as unknown as Record<string, new () => SpeechRecognitionLike>;
    const Recognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Recognition) { resolve({ heard: false }); return; }

    let settled = false;
    const finish = (result: ListenResult) => {
      if (settled) return;
      settled = true;
      try { recognition.stop(); } catch { /* already stopped */ }
      resolve(result);
    };

    const recognition = new Recognition();
    recognition.lang = 'bn-BD';
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event) => {
      const alternatives: string[] = [];
      const result = event.results?.[0];
      for (let i = 0; i < (result?.length ?? 0); i += 1) {
        const text = result?.[i]?.transcript?.trim();
        if (text) alternatives.push(text);
      }
      if (!alternatives.length) { finish({ heard: false }); return; }
      finish({
        heard: true,
        text: alternatives[0]!,
        // Generous on purpose: any alternative containing the expected word
        // counts. A four-year-old's pronunciation plus an imperfect recogniser
        // means strict matching would tell confident children they are wrong.
        matched: alternatives.some((a) => a.includes(expect) || expect.includes(a)),
      });
    };
    recognition.onerror = () => finish({ heard: false });
    recognition.onend = () => finish({ heard: false });

    window.setTimeout(() => finish({ heard: false }), timeoutMs);

    try { recognition.start(); } catch { finish({ heard: false }); }
  });
}

/** The slice of the unprefixed Web Speech API this module uses. */
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: {
    results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
  }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
