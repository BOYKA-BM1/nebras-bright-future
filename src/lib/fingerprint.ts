// جمع بصمة الجهاز على العميل: نوع الجهاز، المتصفح، الشاشة، المنطقة الزمنية، العتاد.
// نستخدمها لتقوية نظام الجهاز الواحد ومنع التحايل بدل الاعتماد على LocalStorage فقط.

export type Fingerprint = {
  fingerprint: string;
  deviceType: string;
  browser: string;
  screen: string;
  timezone: string;
  hardware: string;
  userAgent: string;
};

function detectDeviceType(ua: string): string {
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}

function detectBrowser(ua: string): string {
  if (/Edg/i.test(ua)) return "Edge";
  if (/OPR|Opera/i.test(ua)) return "Opera";
  if (/Chrome/i.test(ua)) return "Chrome";
  if (/Firefox/i.test(ua)) return "Firefox";
  if (/Safari/i.test(ua)) return "Safari";
  return "Unknown";
}

// تجزئة بسيطة ثابتة (djb2) لتحويل مكوّنات البصمة لسلسلة قصيرة
function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function collectFingerprint(): Fingerprint {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const deviceType = detectDeviceType(ua);
  const browser = detectBrowser(ua);

  const screenStr =
    typeof window !== "undefined" && window.screen
      ? `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`
      : "";

  let timezone = "";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    timezone = "";
  }

  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { deviceMemory?: number }) : undefined;
  const hardware = nav
    ? [
        `cores:${nav.hardwareConcurrency ?? "?"}`,
        `mem:${nav.deviceMemory ?? "?"}`,
        `platform:${nav.platform ?? "?"}`,
        `lang:${nav.language ?? "?"}`,
      ].join("|")
    : "";

  const raw = [deviceType, browser, screenStr, timezone, hardware, ua].join("::");
  const fingerprint = hashString(raw);

  return { fingerprint, deviceType, browser, screen: screenStr, timezone, hardware, userAgent: ua };
}
