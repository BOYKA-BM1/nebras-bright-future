/** إخفاء البريد: يظهر آخر حرفين فقط قبل @ */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(-2);
  return `***${visible}@${domain}`;
}

/** إخفاء IP بالكامل */
export function maskIp(ip: string | null | undefined): string {
  if (!ip) return "—";
  return ip.replace(/[0-9a-fA-F]/g, "*");
}
