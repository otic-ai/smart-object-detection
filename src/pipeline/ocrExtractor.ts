import TextRecognition from "@react-native-ml-kit/text-recognition";

// Min length of a meaningful word — filters out single letters like "w h n"
const MIN_WORD_LENGTH = 2;
// Min number of meaningful words to consider OCR valid
const MIN_VALID_WORDS = 1;
// Max ratio of single-char tokens — if too many, it's likely keyboard noise
const MAX_SINGLE_CHAR_RATIO = 0.6;

// Known noise words from keyboard / UI elements to discard
const NOISE_WORDS = new Set([
  "esc", "tab", "tat", "caps", "lock", "shift", "shitt", "ctrl", "control",
  "conlrol", "alt", "option", "command", "dommand", "fn", "delete", "enter",
  "return", "backspace", "space", "macbook", "macbock", "air", "pro", "emtan",
]);

/**
 * Filters raw OCR output to remove keyboard/UI noise.
 * Returns null if the text is too noisy to be useful.
 */
function filterOcrNoise(raw: string): string | null {
  const words = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (words.length === 0) return null;

  // Filter out noise words and very short tokens
  const meaningful = words.filter(
    (w) => w.length >= MIN_WORD_LENGTH && !NOISE_WORDS.has(w)
  );

  if (meaningful.length < MIN_VALID_WORDS) return null;

  // If majority of tokens are single chars — likely keyboard scanning noise
  const singleCharCount = words.filter((w) => w.length === 1).length;
  if (singleCharCount / words.length > MAX_SINGLE_CHAR_RATIO) return null;

  return meaningful.join(" ");
}

/**
 * Runs on-device OCR (Google ML Kit) on a native file URI.
 * Returns cleaned, noise-filtered lowercase text, or null.
 *
 * - Fully offline — no network required
 * - Filters out keyboard keys, single characters, and UI element noise
 *
 * @param uri  Native file URI from cropRegion
 */
export async function extractOcrText(uri: string): Promise<string | null> {
  try {
    const result = await TextRecognition.recognize(uri);

    if (!result?.text) return null;

    const filtered = filterOcrNoise(result.text);

    if (filtered) {
      console.log(`[OCR] Raw="${result.text.replace(/\n/g, " ")}"  Filtered="${filtered}"`);
    } else {
      console.log(`[OCR] Discarded noise: "${result.text.replace(/\n/g, " ").slice(0, 60)}..."`);
    }

    return filtered;
  } catch (err) {
    console.warn("[OCR] Recognition failed:", err);
    return null;
  }
}
