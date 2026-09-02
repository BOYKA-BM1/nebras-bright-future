import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getMontageQueue, type MontageQueueRow } from "@/lib/montage.functions";

/* ============ المونتاج: مسار الفيديو الكامل ============
   pending (يحتاج مونتاج) -> claimed (تم الاستلام) -> in_review (قيد المراجعة)
   -> approved (تم الاعتماد + نشر) ، مع مسار needs_changes يرجع لنفس المونتير
*/

export type MontageStatus = "pending" | "claimed" | "in_review" | "needs_changes" | "approved";
export type MontageLesson = MontageQueueRow;

export function useMontageQueue(statuses: MontageStatus[] = ["pending"]) {
  const call = useServerFn(getMontageQueue);
  return useQuery({
    queryKey: ["montage-queue", statuses],
    queryFn: () => call({ data: { statuses } }),
    staleTime: 10_000,
  });
}

export function useMontageActions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["montage-queue"] });
    qc.invalidateQueries({ queryKey: ["lessons"] });
  };

  /** استلام فيديو للمونتاج — عملية ذرّية: لو مونتير تاني سبقه، النتيجة تفشل بدل ما يتشارك الفيديو بين اتنين */
  const claim = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("يجب تسجيل الدخول.");
      const { data, error } = await supabase
        .from("lessons")
        .update({ review_status: "claimed", editor_id: user.id, claimed_at: new Date().toISOString() })
        .eq("id", id)
        .eq("review_status", "pending")
        .is("editor_id", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("تم استلام هذا الفيديو من مونتير آخر للتو 🔒");
    },
    onSuccess: invalidate,
  });

  /** يسجّل نسخة جديدة في سجل تاريخ الفيديو (V1, V2, ...) بدون استبدال النسخ السابقة */
  const recordVersion = async (lessonId: string, video_url: string, status: "uploaded" | "submitted", notes?: string | null) => {
    if (!user || !video_url) return;
    const { data: last } = await supabase
      .from("lesson_video_versions")
      .select("version_number")
      .eq("lesson_id", lessonId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (last?.version_number ?? 0) + 1;
    await supabase.from("lesson_video_versions").insert({
      lesson_id: lessonId,
      version_number: nextVersion,
      uploader: user.id,
      video_url,
      status,
      notes: notes ?? null,
    });
  };

  /** إرسال الفيديو المُعدَّل للمراجعة */
  const submitForReview = useMutation({
    mutationFn: async ({ id, video_url }: { id: string; video_url?: string | null }) => {
      const { error } = await supabase
        .from("lessons")
        .update({
          review_status: "in_review",
          submitted_for_review_at: new Date().toISOString(),
          review_notes: null,
          ...(video_url !== undefined ? { video_url } : {}),
        })
        .eq("id", id);
      if (error) throw error;
      if (video_url) await recordVersion(id, video_url, "submitted");
    },
    onSuccess: invalidate,
  });

  /** طلب تعديلات — يرجع الفيديو لنفس المونتير مع ملاحظات المراجعة */
  const requestChanges = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase.from("lessons").update({ review_status: "needs_changes", review_notes: notes }).eq("id", id);
      if (error) throw error;
      await supabase
        .from("lesson_video_versions")
        .update({ status: "rejected", notes })
        .eq("lesson_id", id)
        .eq("status", "submitted");
    },
    onSuccess: invalidate,
  });

  /** استئناف التعديل بعد "يحتاج تعديلات" */
  const resumeEditing = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lessons").update({ review_status: "claimed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** اعتماد ونشر الفيديو على المنصة */
  const publish = useMutation({
    mutationFn: async ({ id, video_url }: { id: string; video_url?: string | null }) => {
      const { error } = await supabase
        .from("lessons")
        .update({ review_status: "approved", review_notes: null, ...(video_url !== undefined ? { video_url } : {}) })
        .eq("id", id);
      if (error) throw error;
      await supabase.from("lesson_video_versions").update({ status: "approved" }).eq("lesson_id", id).eq("status", "submitted");
    },
    onSuccess: invalidate,
  });

  const updateVideo = useMutation({
    mutationFn: async ({ id, video_url }: { id: string; video_url: string | null }) => {
      const { error } = await supabase.from("lessons").update({ video_url }).eq("id", id);
      if (error) throw error;
      if (video_url) await recordVersion(id, video_url, "uploaded");
    },
    onSuccess: invalidate,
  });

  return { claim, submitForReview, requestChanges, resumeEditing, publish, updateVideo };
}

export type LessonVideoVersion = {
  id: string;
  version_number: number;
  status: string;
  notes: string | null;
  created_at: string;
};

/** سجل نسخ الفيديو (V1, V2, ...) لدرس معيّن — بدون استبدال التاريخ السابق */
export function useLessonVideoVersions(lessonId: string | null) {
  return useQuery({
    queryKey: ["lesson-video-versions", lessonId],
    enabled: !!lessonId,
    queryFn: async (): Promise<LessonVideoVersion[]> => {
      const { data, error } = await supabase
        .from("lesson_video_versions")
        .select("id, version_number, status, notes, created_at")
        .eq("lesson_id", lessonId!)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** رفع الفيديو المعدّل إلى التخزين بنفس الجودة (بدون إعادة ضغط) وإرجاع رابط موقّع طويل المدى */
export function useUploadMontageVideo() {
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const path = `edited/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      // يُرفع الملف كما هو بايت ببايت — لا يحدث أي إعادة ترميز فتظل الجودة الأصلية كاملة
      const { error: upErr } = await supabase.storage
        .from("lesson-videos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data, error: signErr } = await supabase.storage
        .from("lesson-videos")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr) throw signErr;
      return data.signedUrl;
    },
  });
}

/** رفع ملف PDF من الجهاز إلى التخزين وإرجاع رابط موقّع طويل المدى */
export function useUploadLessonPdf() {
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const path = `pdfs/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("lesson-pdfs")
        .upload(path, file, { upsert: true, contentType: file.type || "application/pdf" });
      if (upErr) throw upErr;
      const { data, error: signErr } = await supabase.storage
        .from("lesson-pdfs")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr) throw signErr;
      return data.signedUrl;
    },
  });
}

/* ============ بيانات الطلاب (خدمة العملاء + السكرتيرة) ============ */

export type StudentRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  parent_phone: string | null;
  level: string | null;
  grade: string | null;
  birthdate: string | null;
  avatar_url: string | null;
  created_at: string;
  enrollments: number;
};

export function useStudents() {
  return useQuery({
    queryKey: ["staff-students"],
    queryFn: async (): Promise<StudentRow[]> => {
      const [{ data: profiles }, { data: roles }, { data: enrollments }] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("enrollments").select("user_id, status"),
      ]);
      // استبعاد أي حساب له دور غير الطالب (أدمن/مدرّس/طاقم)
      const nonStudent = new Set(
        (roles ?? []).filter((r) => r.role !== "student").map((r) => r.user_id),
      );
      const enrollCount = new Map<string, number>();
      for (const e of enrollments ?? []) {
        if (e.status === "active")
          enrollCount.set(e.user_id, (enrollCount.get(e.user_id) ?? 0) + 1);
      }
      return (profiles ?? [])
        .filter((p) => !nonStudent.has(p.id))
        .map((p) => ({
          id: p.id,
          full_name: p.full_name,
          phone: p.phone,
          whatsapp: p.whatsapp,
          parent_phone: p.parent_phone,
          level: p.level,
          grade: p.grade,
          birthdate: p.birthdate,
          avatar_url: p.avatar_url,
          created_at: p.created_at,
          enrollments: enrollCount.get(p.id) ?? 0,
        }))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    },
    staleTime: 20_000,
  });
}

export type StudentDetail = {
  courses: {
    courseId: string;
    title: string;
    teacherName: string | null;
    lessonsTotal: number;
    lessonsCompleted: number;
    enrolledAt: string;
    code: string | null;
  }[];
  attempts: {
    id: string;
    quizTitle: string;
    courseTitle: string;
    score: number;
    total: number;
    submittedAt: string;
  }[];
};

export function useStudentDetail(userId: string | null) {
  return useQuery({
    queryKey: ["staff-student-detail", userId],
    enabled: !!userId,
    queryFn: async (): Promise<StudentDetail> => {
      const uid = userId!;
      const [{ data: enrollments }, { data: progress }, { data: attempts }] = await Promise.all([
        supabase.from("enrollments").select("course_id,status,enrolled_at,code").eq("user_id", uid),
        supabase.from("lesson_progress").select("course_id,completed").eq("user_id", uid),
        supabase.from("quiz_attempts").select("id,quiz_id,course_id,score,total,submitted_at").eq("user_id", uid),
      ]);
      const activeEnr = (enrollments ?? []).filter((e) => e.status === "active");
      const courseIds = [...new Set(activeEnr.map((e) => e.course_id))];
      const attemptCourseIds = [...new Set((attempts ?? []).map((a) => a.course_id))];
      const allCourseIds = [...new Set([...courseIds, ...attemptCourseIds])];
      const [{ data: courses }, { data: lessons }, { data: quizzes }] = await Promise.all([
        supabase.from("courses").select("id,title,teacher_id").in("id", allCourseIds.length ? allCourseIds : ["x"]),
        supabase.from("lessons").select("id,course_id").in("course_id", courseIds.length ? courseIds : ["x"]),
        supabase.from("quizzes").select("id,title").in("id", (attempts ?? []).map((a) => a.quiz_id).length ? (attempts ?? []).map((a) => a.quiz_id) : ["x"]),
      ]);
      const teacherIds = [...new Set((courses ?? []).map((c) => c.teacher_id).filter(Boolean))] as string[];
      const { data: teachers } = await supabase.from("teachers").select("id,name").in("id", teacherIds.length ? teacherIds : ["x"]);
      const teacherMap = new Map((teachers ?? []).map((t) => [t.id, t.name]));
      const courseMap = new Map((courses ?? []).map((c) => [c.id, c]));
      const lessonsByCourse = new Map<string, number>();
      for (const l of lessons ?? []) lessonsByCourse.set(l.course_id, (lessonsByCourse.get(l.course_id) ?? 0) + 1);
      const completedByCourse = new Map<string, number>();
      for (const p of progress ?? []) if (p.completed) completedByCourse.set(p.course_id, (completedByCourse.get(p.course_id) ?? 0) + 1);
      const quizMap = new Map((quizzes ?? []).map((q) => [q.id, q.title]));

      return {
        courses: activeEnr.map((e) => {
          const c = courseMap.get(e.course_id);
          return {
            courseId: e.course_id,
            title: c?.title ?? "دورة",
            teacherName: c?.teacher_id ? teacherMap.get(c.teacher_id) ?? null : null,
            lessonsTotal: lessonsByCourse.get(e.course_id) ?? 0,
            lessonsCompleted: completedByCourse.get(e.course_id) ?? 0,
            enrolledAt: e.enrolled_at,
            code: e.code,
          };
        }),
        attempts: (attempts ?? []).map((a) => ({
          id: a.id,
          quizTitle: quizMap.get(a.quiz_id) ?? "اختبار",
          courseTitle: courseMap.get(a.course_id)?.title ?? "دورة",
          score: a.score,
          total: a.total,
          submittedAt: a.submitted_at,
        })),
      };
    },
  });
}

/* ============ استفسارات الدعم ============ */

export type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: string;
  response: string | null;
  responded_at: string | null;
  created_at: string;
  studentName?: string | null;
};

export function useSupportTickets() {
  return useQuery({
    queryKey: ["support-tickets"],
    queryFn: async (): Promise<Ticket[]> => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const ids = [...new Set(rows.map((t) => t.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", ids.length ? ids : ["x"]);
      const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      return rows.map((t) => ({ ...t, studentName: nameMap.get(t.user_id) ?? null }));
    },
    staleTime: 10_000,
  });
}

export function useRespondTicket() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, response }: { id: string; response: string }) => {
      const { error } = await supabase
        .from("support_tickets")
        .update({
          response,
          status: "answered",
          responded_by: user?.id ?? null,
          responded_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["support-tickets"] }),
  });
}

/* ============ استفسارات الطالب ============ */

export function useMyTickets() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-tickets", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Ticket[]> => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateTicket() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ subject, message }: { subject: string; message: string }) => {
      if (!user) throw new Error("not_authenticated");
      const { error } = await supabase
        .from("support_tickets")
        .insert({ user_id: user.id, subject, message });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-tickets"] }),
  });
}
