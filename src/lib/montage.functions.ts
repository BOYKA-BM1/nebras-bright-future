import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MontageQueueRow = {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  pdf_url: string | null;
  duration_minutes: number;
  review_status: string;
  created_at: string;
  course_id: string;
  courseTitle: string;
  teacherName: string | null;
  editorId: string | null;
  editorName: string | null;
  claimedAt: string | null;
  submittedForReviewAt: string | null;
  reviewNotes: string | null;
};

/* =========================================================
   🎬 قائمة انتظار المونتاج — لأعضاء فريق المونتاج والأدمن فقط
   نجيب أسماء المحرّرين/المدرّسين عبر عميل الخادم لأن جدول
   profiles محمي على مستوى الصفوف ولا يسمح لدور "montage"
   بقراءة بروفايلات الآخرين مباشرة من العميل.
========================================================= */
export const getMontageQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ statuses: z.array(z.string()).min(1) }))
  .handler(async ({ data, context }): Promise<MontageQueueRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId);
    const allowed = (roles ?? []).some((r) => r.role === "montage" || r.role === "admin");
    if (!allowed) throw new Error("غير مصرّح لك.");

    const { data: lessons, error } = await supabaseAdmin
      .from("lessons")
      .select(
        "id,title,description,video_url,pdf_url,duration_minutes,review_status,created_at,course_id,editor_id,claimed_at,submitted_for_review_at,review_notes",
      )
      .in("review_status", data.statuses)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const rows = lessons ?? [];
    const courseIds = [...new Set(rows.map((l) => l.course_id))];
    const { data: courses } = await supabaseAdmin
      .from("courses")
      .select("id,title,teacher_id")
      .in("id", courseIds.length ? courseIds : ["00000000-0000-0000-0000-000000000000"]);
    const teacherIds = [...new Set((courses ?? []).map((c) => c.teacher_id).filter(Boolean))] as string[];
    const { data: teachers } = await supabaseAdmin
      .from("teachers")
      .select("id,name")
      .in("id", teacherIds.length ? teacherIds : ["00000000-0000-0000-0000-000000000000"]);
    const editorIds = [...new Set(rows.map((l) => l.editor_id).filter(Boolean))] as string[];
    const { data: editors } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name")
      .in("id", editorIds.length ? editorIds : ["00000000-0000-0000-0000-000000000000"]);

    const courseMap = new Map((courses ?? []).map((c) => [c.id, c]));
    const teacherMap = new Map((teachers ?? []).map((t) => [t.id, t.name]));
    const editorMap = new Map((editors ?? []).map((e) => [e.id, e.full_name]));

    return rows.map((l) => {
      const c = courseMap.get(l.course_id);
      return {
        id: l.id,
        title: l.title,
        description: l.description,
        video_url: l.video_url,
        pdf_url: l.pdf_url,
        duration_minutes: l.duration_minutes,
        review_status: l.review_status,
        created_at: l.created_at,
        course_id: l.course_id,
        courseTitle: c?.title ?? "دورة",
        teacherName: c?.teacher_id ? teacherMap.get(c.teacher_id) ?? null : null,
        editorId: l.editor_id,
        editorName: l.editor_id ? editorMap.get(l.editor_id) ?? "مونتير" : null,
        claimedAt: l.claimed_at,
        submittedForReviewAt: l.submitted_for_review_at,
        reviewNotes: l.review_notes,
      };
    });
  });

/**
 * عدّاد سريع لكل حالة في خط المونتاج — استعلام واحد بدل 5 استعلامات كاملة
 * (كانت الصفحة قبل كده بتنادي getMontageQueue خمس مرّات منفصلة بس عشان
 * تعرض الأرقام فوق، كل نداء بيعمل جوين على courses/teachers/profiles).
 */
export const getMontageStatusCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Record<string, number>> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId);
    const allowed = (roles ?? []).some((r) => r.role === "montage" || r.role === "admin");
    if (!allowed) throw new Error("غير مصرّح لك.");

    const { data, error } = await supabaseAdmin.from("lessons").select("review_status");
    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      counts[row.review_status] = (counts[row.review_status] ?? 0) + 1;
    }
    return counts;
  });
