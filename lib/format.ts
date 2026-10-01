// Display formatting helpers (Korean-friendly money / number formatting).

export function formatMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_0000_0000) return `${sign}${(abs / 1_0000_0000).toFixed(2)}억`;
  if (abs >= 1_0000) return `${sign}${(abs / 1_0000).toFixed(1)}만`;
  return `${sign}${Math.round(abs).toLocaleString()}`;
}

export function formatMoneyFull(n: number): string {
  return `${Math.round(n).toLocaleString()}`;
}

export function formatNum(n: number): string {
  return Math.round(n).toLocaleString();
}

export function formatPct(n: number, digits = 1): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function changePct(curr: number, prev: number): number {
  if (!prev) return 0;
  return ((curr - prev) / prev) * 100;
}

/**
 * Pick the Korean particle that fits the last syllable of a word, e.g.
 * withJosa("닌텐도우", "을", "를") → "닌텐도우를". Non-Hangul endings use the
 * vowel form.
 */
export function withJosa(word: string, afterConsonant: string, afterVowel: string): string {
  const last = word.charCodeAt(word.length - 1);
  const hangul = last >= 0xac00 && last <= 0xd7a3;
  const hasFinal = hangul && (last - 0xac00) % 28 !== 0;
  return `${word}${hasFinal ? afterConsonant : afterVowel}`;
}
