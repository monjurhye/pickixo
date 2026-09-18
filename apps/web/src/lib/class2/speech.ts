/**
 * Saying things out loud, and listening to the child.
 *
 * A seven-year-old learning English needs to *hear* the word far more than
 * read it, so audio is not a nice-to-have here — a lesson with no sound is a
 * lesson that does not teach pronunciation at all.
 *
 * Recorded audio would be better than speech synthesis and this is written so
 * that it can replace it later without touching a component: every vocabulary
 * item carries an `audio` field, and `say()` is only reached when it is null.
 *
 * Known limits, designed around rather than hidden:
 *   * the voice list differs per device and is sometimes empty on first call;
 *   * no Bangladeshi-accented English voice exists in browser TTS;
 *   * iOS will not speak until the child has tapped something.
 * In every one of those cases the UI stays usable and simply has no sound,
 * because a silent button is better than a frozen one.
 */

const PREFERRED_LOCALES = ['en-GB', 'en-IN', 'en-US', 'en-AU', 'en'];

/**
 * Bangla, in the order we would rather have it.
 *
 * bn-BD first because the learner is Bangladeshi and the pronunciation
 * differs audibly from bn-IN.
 */
const BANGLA_LOCALES = ['bn-BD', 'bn-IN', 'bn'];

export type Language = 'en' | 'bn';

let cachedVoice: SpeechSynthesisVoice | null = null;
let cachedBanglaVoice: SpeechSynthesisVoice | null = null;
let banglaChecked = false;
let voicesReady = false;

export function speechSupported(): boolean {
  return typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && typeof window.SpeechSynthesisUtterance === 'function';
}

/**
 * Pick an English voice once.
 *
 * getVoices() is famously empty on the first call in several browsers, and
 * only populates after a `voiceschanged` event — so this is re-attempted
 * rather than cached as "none available" on a first miss.
 */
function pickVoice(): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null;
  if (cachedVoice) return cachedVoice;

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  voicesReady = true;

  for (const locale of PREFERRED_LOCALES) {
    const match = voices.find((v) => v.lang?.replace('_', '-').startsWith(locale));
    if (match) {
      cachedVoice = match;
      return match;
    }
  }
  cachedVoice = voices[0] ?? null;
  return cachedVoice;
}

/**
 * Find a Bangla voice, if the device has one.
 *
 * Most Android phones in Bangladesh ship Google's Bangla voice, and iOS offers
 * a Bengali voice as a download. Plenty of desktops have neither. So this may
 * legitimately return null, and callers must treat that as "this device cannot
 * say Bangla" rather than substituting something.
 */
function pickBanglaVoice(): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null;
  if (cachedBanglaVoice) return cachedBanglaVoice;

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  banglaChecked = true;

  for (const locale of BANGLA_LOCALES) {
    const match = voices.find(
      (v) => v.lang?.replace('_', '-').toLowerCase().startsWith(locale.toLowerCase()),
    );
    if (match) {
      cachedBanglaVoice = match;
      return match;
    }
  }
  return null;
}

/** Whether this device can speak Bangla at all. */
export function banglaSpeechAvailable(): boolean {
  if (!speechSupported()) return false;
  return pickBanglaVoice() !== null;
}

export function warmUpVoices(): void {
  if (!speechSupported() || voicesReady) return;
  pickVoice();
  pickBanglaVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    pickVoice();
    cachedBanglaVoice = null;
    banglaChecked = false;
    pickBanglaVoice();
  }, { once: true });
}

export type Speed = 'normal' | 'slow';

/**
 * Speak a phrase.
 *
 * Resolves when speech finishes, or immediately when speech is unavailable —
 * callers `await` this to sequence a dialogue, and must not hang on a device
 * with no voices.
 */
export function say(
  text: string, speed: Speed = 'normal', language: Language = 'en',
): Promise<void> {
  if (!speechSupported() || !text.trim()) return Promise.resolve();

  // Reading Bengali script with an English voice produces noise, not words —
  // so if the device has no Bangla voice we stay silent rather than teaching
  // a child a mangled pronunciation of their own language.
  if (language === 'bn' && !pickBanglaVoice()) return Promise.resolve();

  return new Promise((resolve) => {
    try {
      // Cancel anything still speaking: a child tapping 🔊 twice should hear
      // the word again, not hear two overlapping voices.
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const voice = language === 'bn' ? pickBanglaVoice() : pickVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = 'en-GB';
      }

      // 0.6 is slow enough to separate the sounds of a word without dropping
      // into the growl that very low rates produce.
      utterance.rate = speed === 'slow' ? 0.6 : 0.9;
      utterance.pitch = 1.05;   // very slightly bright, reads as friendly

      let settled = false;
      const finish = () => { if (!settled) { settled = true; resolve(); } };
      utterance.onend = finish;
      utterance.onerror = finish;

      // Some browsers never fire onend for short strings. Without this the
      // player would wait forever mid-dialogue.
      const guard = Math.max(1500, text.length * 120);
      setTimeout(finish, guard);

      window.speechSynthesis.speak(utterance);
    } catch {
      resolve();
    }
  });
}

/**
 * Say the Bangla meaning out loud.
 *
 * Resolves to false when the device has no Bangla voice, so the UI can hide
 * the button instead of offering one that does nothing.
 */
export async function sayBangla(text: string, speed: Speed = 'normal'): Promise<boolean> {
  if (!banglaSpeechAvailable()) return false;
  await say(text, speed, 'bn');
  return true;
}

export function stopSpeaking(): void {
  if (!speechSupported()) return;
  try { window.speechSynthesis.cancel(); } catch { /* nothing to stop */ }
}

/** Play recorded audio when it exists, otherwise fall back to synthesis. */
export async function speakItem(
  item: { word?: string; audio?: string | null },
  text?: string,
  speed: Speed = 'normal',
): Promise<void> {
  const phrase = text ?? item.word ?? '';
  if (item.audio) {
    try {
      const sound = new Audio(item.audio);
      await sound.play();
      return;
    } catch {
      // A missing or blocked file should still leave the child with sound.
    }
  }
  await say(phrase, speed);
}

/* -------------------------------------------------------------------------- */
/* Listening to the child                                                     */
/* -------------------------------------------------------------------------- */

export interface HeardResult {
  transcript: string;
  /** How close it was, 0..1. Never shown as a score to the child. */
  similarity: number;
  /** Whether to say "great" rather than "nice try". */
  good: boolean;
}

/**
 * SpeechRecognition has no standard DOM typing and is still vendor-prefixed in
 * Safari, so it is described here rather than pulled from lib.dom.
 */
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function recogniser(): RecognitionLike | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  const Ctor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function listeningSupported(): boolean {
  return recogniser() !== null;
}

/**
 * Listen to the child and compare loosely with what was expected.
 *
 * Deliberately forgiving. A seven-year-old speaking a foreign language into a
 * cheap microphone will not produce a clean transcript, and the cost of being
 * strict is a child who concludes they cannot speak English. The threshold is
 * low, the feedback is always warm, and a failure to recognise anything is
 * reported as "let's try again", never as being wrong.
 */
export function listen(expected: string, timeoutMs = 6000): Promise<HeardResult | null> {
  const recognition = recogniser();
  if (!recognition) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: HeardResult | null) => {
      if (settled) return;
      settled = true;
      try { recognition.stop(); } catch { /* already stopped */ }
      resolve(result);
    };

    recognition.lang = 'en-GB';
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event) => {
      // SpeechRecognitionResultList is array-like but not iterable, so this
      // is indexed rather than looped over with for..of.
      const alternatives: string[] = [];
      for (let r = 0; r < event.results.length; r += 1) {
        const result = event.results[r];
        if (!result) continue;
        for (let a = 0; a < result.length; a += 1) {
          alternatives.push(result[a]?.transcript ?? '');
        }
      }
      // Score the best of the alternatives — the first is not always closest.
      let best = 0;
      let bestText = alternatives[0] ?? '';
      for (const candidate of alternatives) {
        const score = similarity(candidate, expected);
        if (score > best) { best = score; bestText = candidate; }
      }
      finish({ transcript: bestText.trim(), similarity: best, good: best >= 0.45 });
    };
    recognition.onerror = () => finish(null);
    recognition.onend = () => finish(null);

    setTimeout(() => finish(null), timeoutMs);

    try { recognition.start(); } catch { finish(null); }
  });
}

/** Word-overlap similarity. Enough to tell "my name is Rafi" from silence. */
export function similarity(heard: string, expected: string): number {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
    .filter(Boolean);
  const a = clean(heard);
  const b = clean(expected).filter((w) => w !== '...');
  if (!a.length || !b.length) return 0;

  // Blanks the child fills with their own words ("My name is ___") mean an
  // exact match is impossible by design, so this scores the fixed part only.
  const matched = b.filter((word) => a.includes(word)).length;
  return matched / b.length;
}

/** Warm, never corrective. */
export function encouragement(result: HeardResult | null): string {
  if (!result) return 'Let us try that again. 🎤';
  if (result.good) return 'Great speaking! 🌟';
  return 'Nice try! Say it once more. 💪';
}
