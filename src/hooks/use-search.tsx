import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";

export type SearchResult = {
  id: string;
  kind: "course" | "lesson" | "assignment" | "student";
  title: string;
  subtitle?: string;
  link: string;
};

/**
 * بحث موحّد — كل قسم بيستعلم الجدول بتاعه مباشرة معتمدًا على سياسات RLS
 * الموجودة أصلًا (نفس الأسلوب المستخدم في التقويم)، فمفيش أي كشف بيانات
 * زيادة عن اللي المستخدم مصرّح له يشوفه أصلًا. البحث في "الطلاب" متاح
 * فقط للمدرّس/الأدمن، ومحدود بالطلاب المسجَّلين فعليًا في كورساتهم.
 */
/**
 * بحث موحّد — كل قسم بيستعلم الجدول بتاعه مباشرة معتمدًا على سياسات RLS
 * الموجودة أصلًا (نفس الأسلوب المستخدم في التقويم)، فمفيش أي كشف بيانات
 * زيادة عن اللي المستخدم مصرّح له يشوفه أصلًا. البحث في "الطلاب" متاح
 * فقط للمدرّس/الأدمن، ومحدود بالطلاب المسجَّلين فعليًا في كورساتهم.
 * نتائج الدورات المطابقة لنظام/مسار الطالب التعليمي (لو مسجّل بكالوريا)
 * بتظهر الأول — من غير ما نخفي باقي النتائج، زي البحث الحالي بالظبط.
 */
export function useSearch(query: string) {
  const { user } = useAuth();
  const { isTeacher, isAdmin, isLoading: rolesLoading } = useRoles();
  const q = query.trim();

  return useQuery({
    queryKey: ["search", q, isTeacher, isAdmin],
    enabled: !!user && !rolesLoading && q.length >= 2,
    queryFn: async (): Promise<SearchResult[]> => {
      const like = `%${q}%`;
      const results: SearchResult[] = [];

      const [{ data: courses }, { data: lessons }, { data: assignments }, { data: myEduProfile }] = await Promise.all([
        supabase.from("courses").select("id, title, education_system_id, baccalaureate_track_id").ilike("title", like).limit(8),
        supabase.from("lessons").select("id, title, course_id").ilike("title", like).limit(8),
        supabase.from("assignments").select("id, title, course_id").ilike("title", like).limit(8),
        supabase.from("student_education_profiles").select("education_system_id, track_id").eq("user_id", user!.id).maybeSingle(),
      ]);

      const courseIds = [...new Set([...(lessons ?? []).map((l) => l.course_id), ...(assignments ?? []).map((a) => a.course_id)])];
      const { data: courseNames } = courseIds.length
        ? await supabase.from("courses").select("id, title").in("id", courseIds)
        : { data: [] as { id: string; title: string }[] };
      const courseMap = new Map((courseNames ?? []).map((c) => [c.id, c.title]));

      const sortedCourses = [...(courses ?? [])].sort((a, b) => {
        const score = (c: typeof a) => {
          if (!myEduProfile || c.education_system_id !== myEduProfile.education_system_id) return 0;
          if (!c.baccalaureate_track_id) return 1; // نفس النظام، متاح لكل المسارات
          return c.baccalaureate_track_id === myEduProfile.track_id ? 2 : 0; // مسار مختلف تمامًا = ينزل لآخر الترتيب
        };
        return score(b) - score(a);
      });

      for (const c of sortedCourses) {
        results.push({ id: c.id, kind: "course", title: c.title, link: `/courses/${c.id}` });
      }
      for (const l of lessons ?? []) {
        results.push({ id: l.id, kind: "lesson", title: l.title, subtitle: courseMap.get(l.course_id), link: `/learn/${l.course_id}` });
      }
      for (const a of assignments ?? []) {
        const link = isTeacher || isAdmin ? `/manage/${a.course_id}/assignments` : `/assignments`;
        results.push({ id: a.id, kind: "assignment", title: a.title, subtitle: courseMap.get(a.course_id), link });
      }

      if (isTeacher || isAdmin) {
        const { data: students } = await supabase.from("profiles").select("id, full_name, grade").ilike("full_name", like).limit(8);
        for (const s of students ?? []) {
          results.push({ id: s.id, kind: "student", title: s.full_name ?? "طالب", subtitle: s.grade ?? undefined, link: `/staff/students` });
        }
      }

      return results;
    },
  });
}
