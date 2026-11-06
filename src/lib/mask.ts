/** إخفاء البريد: أول حرف + نجوم + آخر حرفين قبل @ */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [local, domain] = String(email).split("@");
  if (!domain) return "******";
  const loc = local || "";
  if (loc.length <= 1) return `*@${domain}`;
  if (loc.length === 2) return `${loc[0]}*@${domain}`;
  if (loc.length === 3) return `${loc[0]}*${loc.slice(-2)}@${domain}`;
  const first = loc[0];
  const last2 = loc.slice(-2);
  const stars = "*".repeat(Math.max(3, loc.length - 3));
  return `${first}${stars}${last2}@${domain}`;
}

/** إخفاء IP بالكامل */
export function maskIp(ip: string | null | undefined): string {
  if (!ip) return "—";
  return String(ip).replace(/[0-9a-fA-F]/g, "*");
}
