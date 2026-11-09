import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceRateLimit, getClientIp, getUserAgent, writeAudit } from "@/lib/security.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BROWSER_SIGNALS = [
  "printscreen_key",
  "devtools_shortcut",
  "beforeprint",
  "visibilitychange",
  "window_blur",
  "context_menu_block",
] as const;

function classify(signal: (typeof BROWSER_SIGNALS)[number]): {
  event_type: "capture_attempt_suspected" | "protected_content_visibility_changed";
  detection_method: "browser_signal";
  confidence: "low" | "medium";
} {
  if (signal === "printscreen_key" || signal === "beforeprint") {
    return {
      event_type: "capture_attempt_suspected",
      detection_method: "browser_signal",
      confidence: "medium",
    };
  }
  if (signal === "visibilitychange" || signal === "window_blur") {
    return {
      event_type: "protected_content_visibility_changed",
      detection_method: "browser_signal",
      confidence: "low",
    };
  }
  return {
    event_type: "capture_attempt_suspected",
    detection_method: "browser_signal",
    confidence: "low",
  };
}

/**
 * تسجيل إشارة حماية محتوى من المتصفح فقط.
 * - لا يقبل confirmed_native
 * - user_id من الجلسة فقط
 * - rate-limit fail-closed عند فشل آلية الحد
 */
export const reportBrowserProtectionSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        signal: z.enum(BROWSER_SIGNALS),
        courseId: z.string().uuid().nullable().optional(),
        lessonId: z.string().uuid().nullable().optional(),
        note: z.string().max(200).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const uid = context.userId;

    // Fail-closed rate limit: 20 events / 5 minutes
    const { data: rateOk, error: rateErr } = await supabaseAdmin.rpc("check_rate_limit", {
      _bucket: `cpe:${uid}`,
      _max: 20,
      _window_seconds: 300,
    });
    if (rateErr || rateOk === false) {
      throw new Error("rate_limited");
    }

    if (data.courseId) {
      const { data: enr } = await supabaseAdmin
        .from("enrollments")
        .select("id")
        .eq("user_id", uid)
        .eq("course_id", data.courseId)
        .eq("status", "active")
        .limit(1);
      const enrolled = (enr ?? []).length > 0;
      if (!enrolled) {
        const { data: roles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", uid);
        const okRole = (roles ?? []).some((r) =>
          ["admin", "admin_secondary", "teacher"].includes(r.role),
        );
        if (!okRole) throw new Error("not_enrolled");
      }
    }

    if (data.lessonId && data.courseId) {
      const { data: lesson } = await supabaseAdmin
        .from("lessons")
        .select("id, course_id")
        .eq("id", data.lessonId)
        .maybeSingle();
      if (!lesson || lesson.course_id !== data.courseId) {
        throw new Error("lesson_course_mismatch");
      }
    } else if (data.lessonId && !data.courseId) {
      throw new Error("lesson_requires_course");
    }

    const cls = classify(data.signal);
    // Never allow confirmed_native from this path
    const { data: row, error } = await supabaseAdmin
      .from("content_protection_events")
      .insert({
        user_id: uid,
        course_id: data.courseId ?? null,
        lesson_id: data.lessonId ?? null,
        event_type: cls.event_type,
        detection_method: cls.detection_method,
        confidence: cls.confidence,
        platform: null,
        user_agent: (getUserAgent() ?? "").slice(0, 300) || null,
        session_note: data.note?.slice(0, 200) ?? null,
      } as never)
      .select("id")
      .select("id").limit(1);

    if (error) throw new Error("report_failed");

    await writeAudit({
      userId: uid,
      action: "content_protection_signal",
      entity: data.courseId ?? "lesson",
      metadata: { signal: data.signal, event_type: cls.event_type, confidence: cls.confidence },
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });

    return { id: (row as { id?: string } | null)?.id ?? null, classified: cls };
  });
