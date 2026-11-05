// BR-09: rounding happens only when displaying.

/** Half-up rounding that is safe for values like 1.005. */
export function roundTo(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round((value + Number.EPSILON * Math.sign(value)) * f) / f;
}

export function satangToBaht(satang: number): number {
  return roundTo(satang / 100, 2);
}

export function formatBaht(satang: number | null | undefined, withSymbol = true): string {
  if (satang === null || satang === undefined || !Number.isFinite(satang)) return '—';
  const baht = Math.round(satang) / 100;
  const s = baht.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return withSymbol ? `฿${s}` : s;
}

export function formatKcal(kcal: number): string {
  return Math.round(kcal).toLocaleString('en-US');
}

export function formatGrams(g: number, digits = 1): string {
  return roundTo(g, digits).toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function formatPct(p: number, digits = 1): string {
  return `${roundTo(p, digits).toFixed(digits)}%`;
}

/** Parse "12.50", "1,250" or "฿95" typed by the user into satang. */
export function parseBahtToSatang(input: string): number | null {
  const cleaned = input.replace(/[฿,\s]|บาท/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function parseNumber(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
