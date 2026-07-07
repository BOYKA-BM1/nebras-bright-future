import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  enforceRateLimit,
  getClientIp,
  getUserAgent,
  lookupGeo,
  writeAudit,
} from "@/lib/security.server";

/* =========================================================
   حارس ما قبل المصادقة: حدود المعدل على الدخول/الاشتراك
   يُستدعى قبل supabase.auth مباشرة (عام، بلا توكن)
========================================================= */
export const preAuthGuard = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      action: z.enum(["login", "signup"]),
      email: z.string().email().max(255),
    }),
  )
  .handler(async ({ data }) => {
    const ip = getClientIp();
    const emailKey = data.email.trim().toLowerCase();

    // حد لكل بريد وحد لكل عنوان شبكة
    const perEmail = data.action === "signup" ? 5 : 8; // خلال 10 دقائق
    const perIp = data.action === "signup" ? 10 : 20;

    const okEmail = await enforceRateLimit(`${data.action}:email:${emailKey}`, perEmail, 600);
    const okIp = ip ? await enforceRateLimit(`${data.action}:ip:${ip}`, perIp, 600) : true;

    if (!okEmail || !okIp) {
      return {
        allowed: false as const,
        message: "محاولات كتير في وقت قصير. استنى شوية وحاول تاني.",
      };
    }
    return { allowed: true as const };
  });

/* =========================================================
   تسجيل الجلسة + كشف مشاركة الحساب
   يُستدعى بعد نجاح الدخول (للطلاب)
========================================================= */
export const recordSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      fingerprint: z.string().min(1).max(64),
      deviceType: z.string().max(32).optional(),
      browser: z.string().max(32).optional(),
      screen: z.string().max(48).optional(),
      timezone: z.string().max(64).optional(),
      hardware: z.string().max(256).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const ip = getClientIp();
    const userAgent = getUserAgent();
    const { country, city } = await lookupGeo(ip);

    // آخر الجلسات خلال 30 دقيقة (قبل تسجيل الحالية)
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("login_events")
      .select("fingerprint, country, ip, created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);

    // سجّل الجلسة الحالية
    await supabaseAdmin.from("login_events").insert({
      user_id: userId,
      fingerprint: data.fingerprint,
      device_type: data.deviceType ?? null,
      browser: data.browser ?? null,
      screen: data.screen ?? null,
      timezone: data.timezone ?? null,
      hardware: data.hardware ?? null,
      ip,
      country,
      city,
      user_agent: userAgent,
    });

    await writeAudit({ userId, action: "login", ip, userAgent, metadata: { country, city } });

    // كشف المشاركة: جهاز مختلف أو دولة مختلفة خلال آخر 30 دقيقة
    const rows = (recent ?? []) as Array<{ fingerprint: string | null; country: string | null }>;
    const differentDevice = rows.some(
      (r) => r.fingerprint && r.fingerprint !== data.fingerprint,
    );
    const differentCountry = rows.some(
      (r) => r.country && country && r.country !== country,
    );

    if (!differentDevice && !differentCountry) {
      return { block: false as const };
    }

    const reason = differentCountry
      ? `الحساب فُتح من دولة مختلفة (${rows.find((r) => r.country && r.country !== country)?.country} ثم ${country ?? "غير معروف"}) خلال وقت قصير.`
      : "الحساب فُتح من جهاز مختلف خلال وقت قصير.";

    // سجّل تنبيه أمني
    const { data: alertRow } = await supabaseAdmin
      .from("security_alerts")
      .insert({
        user_id: userId,
        type: differentCountry ? "impossible_travel" : "multi_device",
        severity: "critical",
        message: reason,
        metadata: { ip, country, city, fingerprint: data.fingerprint } as never,
      })
      .select("id")
      .single();

    // بريد المستخدم للتنبيه
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    // تنبيه كل الأدمن في جرس الإشعارات
    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (admins && admins.length) {
      await supabaseAdmin.from("notifications").insert(
        admins.map((a: { user_id: string }) => ({
          user_id: a.user_id,
          title: "🚨 اشتباه في مشاركة حساب",
          body: `${profile?.full_name ?? "طالب"}: ${reason}`,
          type: "security",
          link: "/admin/security",
        })),
      );
    }

    await writeAudit({
      userId,
      action: "account_sharing_detected",
      ip,
      userAgent,
      metadata: { reason, alertId: alertRow?.id ?? null },
    });

    return { block: true as const, reason };
  });

/* =========================================================
   تسجيل حدث تدقيق عام (مصادق عليه)
========================================================= */
export const logAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      action: z.string().min(1).max(64),
      entity: z.string().max(128).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await writeAudit({
      userId: context.userId,
      action: data.action,
      entity: data.entity ?? null,
      metadata: data.metadata ?? {},
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });
    return { ok: true as const };
  });
