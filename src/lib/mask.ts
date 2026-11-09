/** إخفاء البريد: أول حرف + نجوم + آخر حرفين قبل @ — مثال m*****ed@gmail.com */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "غير متاح";
  const raw = String(email).trim();
  const at = raw.lastIndexOf("@");
  if (at <= 0) return "******";
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  if (!domain) return "******";
  if (local.length <= 1) return `*@${domain}`;
  if (local.length === 2) return `${local[0]}*@${domain}`;
  if (local.length === 3) return `${local[0]}*${local.slice(-2)}@${domain}`;
  const stars = "*".repeat(Math.max(3, local.length - 3));
  return `${local[0]}${stars}${local.slice(-2)}@${domain}`;
}

/**
 * إخفاء IP للأدمن الثانوي:
 * IPv4: ***.***.*.125 (آخر خانة كاملة فقط)
 * IPv6: أخفِ كل المجموعات إلا الأخيرة
 */
export function maskIp(ip: string | null | undefined): string {
  if (!ip || !String(ip).trim()) return "غير متاح";
  const s = String(ip).trim();

  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) {
    const parts = s.split(".");
    return `***.***.*.${parts[3]}`;
  }

  // IPv6 (including compressed forms — show last group only)
  if (s.includes(":")) {
    const normalized = s.split("%")[0]; // drop zone id
    const groups = normalized.split(":");
    const last = groups.filter((g) => g.length > 0).pop() || "0";
    return `****:****:****:****:****:****:****:${last}`;
  }

  // Unknown format — do not leak
  return "غير متاح";
}

/** يعرض IP كاملًا للأدمن الكامل، ومقنّعًا للثانوي */
export function displayIp(ip: string | null | undefined, fullAccess: boolean): string {
  if (!ip || !String(ip).trim()) return "غير متاح";
  return fullAccess ? String(ip).trim() : maskIp(ip);
}

export function displayEmail(email: string | null | undefined, fullAccess: boolean): string {
  if (!email) return "غير متاح";
  return fullAccess ? String(email) : maskEmail(email);
}
