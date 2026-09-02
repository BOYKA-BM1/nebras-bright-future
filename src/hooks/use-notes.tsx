import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Database } from "@/integrations/supabase/types";

export type LessonNote = Database["public"]["Tables"]["lesson_notes"]["Row"];

export function useLessonNotes(lessonId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["lesson-notes", lessonId, user?.id],
    enabled: !!lessonId && !!user,
    queryFn: async (): Promise<LessonNote[]> => {
      const { data, error } = await supabase.from("lesson_notes").select("*").eq("lesson_id", lessonId!).order("position_seconds", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** كل ملاحظاتي عبر كل الدورات — لصفحة "ملاحظاتي" */
export function useAllMyNotes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-notes", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<(LessonNote & { lessonTitle: string; courseTitle: string })[]> => {
      const { data, error } = await supabase.from("lesson_notes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const lessonIds = [...new Set(rows.map((r) => r.lesson_id))];
      const courseIds = [...new Set(rows.map((r) => r.course_id))];
      const [{ data: lessons }, { data: courses }] = await Promise.all([
        lessonIds.length ? supabase.from("lessons").select("id, title").in("id", lessonIds) : Promise.resolve({ data: [] as { id: string; title: string }[] }),
        courseIds.length ? supabase.from("courses").select("id, title").in("id", courseIds) : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      ]);
      const lessonMap = new Map((lessons ?? []).map((l) => [l.id, l.title]));
      const courseMap = new Map((courses ?? []).map((c) => [c.id, c.title]));
      return rows.map((r) => ({ ...r, lessonTitle: lessonMap.get(r.lesson_id) ?? "درس", courseTitle: courseMap.get(r.course_id) ?? "دورة" }));
    },
  });
}

export function useNoteActions(lessonId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["lesson-notes", lessonId] });
    qc.invalidateQueries({ queryKey: ["my-notes", user?.id] });
  };

  const add = useMutation({
    mutationFn: async ({ courseId, content, positionSeconds }: { courseId: string; content: string; positionSeconds?: number | null }) => {
      if (!user || !lessonId) throw new Error("missing");
      const { error } = await supabase.from("lesson_notes").insert({ user_id: user.id, lesson_id: lessonId, course_id: courseId, content, position_seconds: positionSeconds ?? null });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lesson_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, remove };
}
