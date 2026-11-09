import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { writeAudit, getClientIp, getUserAgent } from "@/lib/security.server";

async function assertAnyAdmin(userId: string) {
  const [{ data: full }, { data: secondary }] = await Promise.all([
    supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin_secondary" }),
  ]);
  if (!full && !secondary) throw new Error("غير مصرّح: للإدارة فقط.");
}

/** حذف دورة — يتجاوز قيود RLS القديمة التي تقتصر على admin فقط */
export const adminDeleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ courseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAnyAdmin(context.userId);
    // فك الارتباطات الخفيفة ثم الحذف
    await supabaseAdmin.from("lessons").delete().eq("course_id", data.courseId);
    await supabaseAdmin.from("sections").delete().eq("course_id", data.courseId);
    const { error } = await supabaseAdmin.from("courses").delete().eq("id", data.courseId);
    if (error) throw new Error("تعذّر حذف الدورة: " + (error.message || ""));
    await writeAudit({
      userId: context.userId,
      action: "delete_course",
      entity: data.courseId,
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });
    return { ok: true as const };
  });

/** حذف مدرّس — يختفي من قائمة المصور تلقائيًا */
export const adminDeleteTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ teacherId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAnyAdmin(context.userId);
    // الدورات تبقى بدون مدرّس
    await supabaseAdmin.from("courses").update({ teacher_id: null }).eq("teacher_id", data.teacherId);
    const { error } = await supabaseAdmin.from("teachers").delete().eq("id", data.teacherId);
    if (error) throw new Error("تعذّر حذف المدرّس: " + (error.message || ""));
    await writeAudit({
      userId: context.userId,
      action: "delete_teacher",
      entity: data.teacherId,
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });
    return { ok: true as const };
  });

export const adminDeleteAcademicYear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ yearId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAnyAdmin(context.userId);
    const { error } = await supabaseAdmin.from("academic_years").delete().eq("id", data.yearId);
    if (error) throw new Error("تعذّر حذف السنة: " + (error.message || ""));
    await writeAudit({
      userId: context.userId,
      action: "delete_academic_year",
      entity: data.yearId,
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });
    return { ok: true as const };
  });
