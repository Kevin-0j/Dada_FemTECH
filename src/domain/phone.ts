/**
 * Normalises a Kenyan mobile number to E.164 (+2547XXXXXXXX or +2541XXXXXXXX).
 * Accepts 07..., 01..., 7..., 2547..., +2547... with spaces or dashes. Returns null otherwise.
 */
export function normalizeKenyanPhone(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "").replace(/^\+/, "");
  const match = /^(?:254|0)?([17]\d{8})$/.exec(digits);
  return match?.[1] === undefined ? null : `+254${match[1]}`;
}
