// مساعدات أمان تعمل على الخادم فقط (IP، الموقع الجغرافي، حدود المعدل، سجلات التدقيق).
// هذا الملف *.server.ts محجوب عن حزمة المتصفح.
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function getClientIp(): string | null {
  const req = getRequest();
  const h = req?.headers;
  if (!h) return null;
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("cf-connecting-ip") || h.get("x-real-ip") || null;
}

export function getUserAgent(): string | null {
  const req = getRequest();
  return req?.headers?.get("user-agent") ?? null;
}

function isPrivateIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("fc") ||
    ip.startsWith("fd")
  );
}

export async function lookupGeo(
  ip: string | null,
): Promise<{ country: string | null; city: string | null }> {
  if (!ip || isPrivateIp(ip)) return { country: null, city: null };
  try {
    const res = await fetch(
      `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,city`,
      { signal: AbortSignal.timeout(3500) },
    );
    if (!res.ok) return { country: null, city: null };
    const j = (await res.json()) as { success?: boolean; country?: string; city?: string };
    if (!j.success) return { country: null, city: null };
    return { country: j.country ?? null, city: j.city ?? null };
  } catch {
    return { country: null, city: null };
  }
}

/** يرجّع true لو مسموح، false لو تعدّى الحد. يفشل بأمان (يسمح) لو حصل خطأ بنية تحتية. */
export async function enforceRateLimit(
  bucket: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
    _bucket: bucket,
    _max: max,
    _window_seconds: windowSeconds,
  });
  if (error) return true;
  return data !== false;
}

export async function writeAudit(entry: {
  userId?: string | null;
  action: string;
  entity?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      user_id: entry.userId ?? null,
      action: entry.action,
      entity: entry.entity ?? null,
      metadata: (entry.metadata ?? {}) as never,
      ip: entry.ip ?? null,
      user_agent: entry.userAgent ?? null,
    });
  } catch {
    /* التدقيق يجب ألا يكسر الطلب أبدًا */
  }
}
