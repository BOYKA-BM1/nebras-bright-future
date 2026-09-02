import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";

export type CalendarEvent = {
  id: string;
  type: "assignment" | "live" | "exam" | "lesson";
  title: string;
  date: string;
  courseTitle: string;
  courseId: string;
  link: string;
};

/**
 * الأحداث دي بتتجمّع من جداول موجودة فعلًا (assignments, live_sessions,
 * quizzes, lessons) — كل جدول محمي بسياسات RLS الخاصة بيه أصلًا، فمفيش
 * حاجة هنا بتكشف بيانات الطالب/الكورس أكتر مما المستخدم مصرّح له يشوفه.
 * النطاق (أي كورسات) بيتحدد حسب الدور: طالب → كورساته المشترك فيها،
 * مدرّس → كورساته اللي بيملكها، ولي أمر → كورسات أبنائه المرتبطين.
 */
export function useCalendarEvents() {
  const { user } = useAuth();
  const { isTeacher, isAdmin, isParent, isLoading: rolesLoading } = useRoles();

  return useQuery({
    queryKey: ["calendar-events", user?.id, isTeacher, isAdmin, isParent],
    enabled: !!user && !rolesLoading,
    queryFn: async (): Promise<CalendarEvent[]> => {
      let courseIds: string[] = [];

      if (isTeacher || isAdmin) {
        const { data: courses } = await supabase.from("courses").select("id");
        courseIds = (courses ?? []).map((c) => c.id);
      } else if (isParent) {
        const { data: links } = await supabase.from("parent_children").select("student_user_id").eq("status", "active");
        const studentIds = [...new Set((links ?? []).map((l) => l.student_user_id))];
        if (studentIds.length) {
          const { data: enr } = await supabase.from("enrollments").select("course_id").in("user_id", studentIds).eq("status", "active");
          courseIds = [...new Set((enr ?? []).map((e) => e.course_id))];
        }
      } else {
        const { data: enr } = await supabase.from("enrollments").select("course_id").eq("status", "active");
        courseIds = [...new Set((enr ?? []).map((e) => e.course_id))];
      }

      if (courseIds.length === 0) return [];

      const [{ data: courses }, { data: assignments }, { data: live }, { data: quizzes }, { data: lessons }] = await Promise.all([
        supabase.from("courses").select("id, title").in("id", courseIds),
        supabase.from("assignments").select("id, title, course_id, due_at").in("course_id", courseIds).not("due_at", "is", null),
        supabase.from("live_sessions").select("id, title, course_id, starts_at").in("course_id", courseIds).not("starts_at", "is", null),
        supabase.from("quizzes").select("id, title, course_id, scheduled_at").in("course_id", courseIds).not("scheduled_at", "is", null),
        supabase
          .from("lessons")
          .select("id, title, course_id, created_at")
          .in("course_id", courseIds)
          .eq("review_status", "approved")
          .gte("created_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const courseMap = new Map((courses ?? []).map((c) => [c.id, c.title]));
      const events: CalendarEvent[] = [];

      for (const a of assignments ?? []) {
        events.push({ id: `assignment-${a.id}`, type: "assignment", title: a.title, date: a.due_at!, courseTitle: courseMap.get(a.course_id) ?? "دورة", courseId: a.course_id, link: "/assignments" });
      }
      for (const l of live ?? []) {
        events.push({ id: `live-${l.id}`, type: "live", title: l.title, date: l.starts_at!, courseTitle: courseMap.get(l.course_id) ?? "دورة", courseId: l.course_id, link: `/learn/${l.course_id}` });
      }
      for (const q of quizzes ?? []) {
        events.push({ id: `exam-${q.id}`, type: "exam", title: q.title, date: q.scheduled_at!, courseTitle: courseMap.get(q.course_id) ?? "دورة", courseId: q.course_id, link: `/learn/${q.course_id}` });
      }
      for (const l of lessons ?? []) {
        events.push({ id: `lesson-${l.id}`, type: "lesson", title: l.title, date: l.created_at, courseTitle: courseMap.get(l.course_id) ?? "دورة", courseId: l.course_id, link: `/learn/${l.course_id}` });
      }

      return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    },
  });
}
