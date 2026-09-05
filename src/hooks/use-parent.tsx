import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type LinkedChild = {
  linkId: string;
  studentId: string;
  fullName: string;
  grade: string | null;
};

/** أبناء ولي الأمر المرتبطون حاليًا — عبر RLS، ولي الأمر لا يقدر يشوف غير المرتبطين بيه فقط */
export function useMyChildren() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["parent-children", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<LinkedChild[]> => {
      const { data: links, error } = await supabase
        .from("parent_children")
        .select("id, student_user_id")
        .eq("status", "active");
      if (error) throw error;
      const rows = links ?? [];
      if (rows.length === 0) return [];
      const ids = rows.map((r) => r.student_user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, grade").in("id", ids);
      const map = new Map((profiles ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({
        linkId: r.id,
        studentId: r.student_user_id,
        fullName: map.get(r.student_user_id)?.full_name ?? "الطالب",
        grade: map.get(r.student_user_id)?.grade ?? null,
      }));
    },
  });
}

/** ربط حساب ولي الأمر بابنه عبر الكود اللي الطالب يشاركه — التحقق بالكامل من طرف الخادم */
export function useLinkChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc("link_child_by_code", { _code: code });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parent-children"] }),
  });
}

export type ChildCourseSummary = { courseId: string; title: string; lessonsTracked: number; completed: number; lastActiveAt: string | null };
export type ChildExamAttempt = { id: string; score: number; total: number; submittedAt: string; quizTitle: string };

/** ملخّص تقدّم طالب واحد — لولي الأمر فقط، عبر سياسات RLS المضافة لهذا الغرض */
export function useChildProgress(studentId: string | null) {
  return useQuery({
    queryKey: ["parent-child-progress", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("user_id", studentId!)
        .eq("status", "active");
      const courseIds = [...new Set((enrollments ?? []).map((e) => e.course_id))];

      const [{ data: courses }, { data: progress }, { data: attempts }] = await Promise.all([
        courseIds.length
          ? supabase.from("courses").select("id, title").in("id", courseIds)
          : Promise.resolve({ data: [] as { id: string; title: string }[] }),
        courseIds.length
          ? supabase.from("lesson_progress").select("course_id, completed, last_watched_at").eq("user_id", studentId!).in("course_id", courseIds)
          : Promise.resolve({ data: [] as { course_id: string; completed: boolean; last_watched_at: string | null }[] }),
        supabase
          .from("quiz_attempts")
          .select("id, score, total, submitted_at, quiz_id")
          .eq("user_id", studentId!)
          .order("submitted_at", { ascending: false })
          .limit(10),
      ]);

      const courseMap = new Map((courses ?? []).map((c) => [c.id, c.title]));
      const courseSummaries: ChildCourseSummary[] = courseIds.map((id) => {
        const rows = (progress ?? []).filter((p) => p.course_id === id);
        const lastActiveAt = rows.reduce<string | null>((max, r) => {
          if (!r.last_watched_at) return max;
          if (!max || new Date(r.last_watched_at) > new Date(max)) return r.last_watched_at;
          return max;
        }, null);
        return {
          courseId: id,
          title: courseMap.get(id) ?? "دورة",
          lessonsTracked: rows.length,
          completed: rows.filter((r) => r.completed).length,
          lastActiveAt,
        };
      });

      const quizIds = [...new Set((attempts ?? []).map((a) => a.quiz_id))];
      const { data: quizzes } = quizIds.length
        ? await supabase.from("quizzes").select("id, title").in("id", quizIds)
        : { data: [] as { id: string; title: string }[] };
      const quizMap = new Map((quizzes ?? []).map((q) => [q.id, q.title]));

      const examAttempts: ChildExamAttempt[] = (attempts ?? []).map((a) => ({
        id: a.id,
        score: a.score,
        total: a.total,
        submittedAt: a.submitted_at,
        quizTitle: quizMap.get(a.quiz_id) ?? "امتحان",
      }));

      return { courses: courseSummaries, examAttempts };
    },
  });
}

export type ChildNotification = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  createdAt: string;
};

/** إشعارات الطالب — ولي الأمر يشوفها للأبناء المرتبطين بيه فقط عبر RLS */
export function useChildNotifications(studentId: string | null) {
  return useQuery({
    queryKey: ["parent-child-notifications", studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<ChildNotification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, type, created_at")
        .eq("user_id", studentId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.type,
        createdAt: n.created_at,
      }));
    },
  });
}

export type LinkedParent = { linkId: string; parentUserId: string; fullName: string };

/** أولياء الأمور المرتبطين بحسابي — الطالب بيشوفهم عشان يقدر يلغي الربط لو حابب */
export function useLinkedParents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["linked-parents", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<LinkedParent[]> => {
      const { data: links, error } = await supabase.from("parent_children").select("id, parent_user_id").eq("status", "active");
      if (error) throw error;
      const rows = links ?? [];
      if (rows.length === 0) return [];
      const ids = rows.map((r) => r.parent_user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      return rows.map((r) => ({ linkId: r.id, parentUserId: r.parent_user_id, fullName: map.get(r.parent_user_id) ?? "ولي أمر" }));
    },
  });
}

export function useRevokeParentLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("parent_children").update({ status: "revoked" }).eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["linked-parents"] }),
  });
}
