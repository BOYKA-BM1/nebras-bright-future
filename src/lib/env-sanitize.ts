/** Strip BOM, zero-width, RTL marks, and non-ISO-8859-1 chars from env/header values. */
export function sanitizeAsciiHeaderValue(value: string | undefined | null): string {
  if (!value) return "";
  return String(value)
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069]/g, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .trim();
}

export function sanitizeEnv(value: string | undefined | null): string {
  return sanitizeAsciiHeaderValue(value);
}
