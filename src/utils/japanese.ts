/** Text helpers for rendering Japanese transcripts. */

const KANJI_RE = /[㐀-䶿一-鿿]/;

export function hasKanji(text: string): boolean {
  return KANJI_RE.test(text);
}

/**
 * Split Japanese text into tappable word units. Uses Intl.Segmenter where
 * available (web, Hermes with full Intl); falls back to whitespace/punctuation
 * splitting otherwise.
 */
export function segmentJapanese(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
    return Array.from(segmenter.segment(text), (s) => s.segment).filter(
      (s) => s.trim().length > 0,
    );
  }
  return text.split(/([\s、。！？!?]+)/).filter((s) => s.trim().length > 0);
}
