import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Stage,
  Teacher,
  Course,
  CourseWithRelations,
} from "@/lib/catalog";

/* ===================== قراءات عامة ===================== */

export function useStages() {
  return useQuery({
    queryKey: ["stages"],
    queryFn: async (): Promise<Stage[]> => {
      const { data, error } = await supabase
        .from("stages")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type StageCount = { stage_id: string; teachers: number; students: number };

export function useStageCounts() {
  return useQuery({
    queryKey: ["stage-counts"],
    queryFn: async (): Promise<Record<string, StageCount>> => {
      const { data, error } = await (supabase.rpc as any)("stage_counts");
      if (error) throw error;
      const map: Record<string, StageCount> = {};
      for (const row of (data ?? []) as StageCount[]) {
        map[row.stage_id] = {
          stage_id: row.stage_id,
          teachers: Number(row.teachers) || 0,
          students: Number(row.students) || 0,
        };
      }
      return map;
    },
  });
}


export function useTeachers() {
  return useQuery({
    queryKey: ["teachers"],
    queryFn: async (): Promise<Teacher[]> => {
      const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const teachers = (data ?? []) as Teacher[];

      // عدد الطلاب الحقيقي لكل مدرّس
      const { data: stats } = await (supabase.rpc as any)("teacher_stats");
      const map = new Map<string, number>();
      for (const row of (stats ?? []) as { teacher_id: string; students: number }[]) {
        map.set(row.teacher_id, Number(row.students) || 0);
      }
      return teachers.map((t) => ({
        ...t,
        students_label: map.has(t.id) ? String(map.get(t.id)) : t.students_label,
      }));
    },
  });
}

type CourseStat = {
  course_id: string;
  lessons: number;
  videos: number;
  hours: number;
  live_sessions: number;
  students: number;
};

export function useCourses() {
  return useQuery({
    queryKey: ["courses"],
    queryFn: async (): Promise<CourseWithRelations[]> => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, teacher:teachers(*), stage:stages(*)")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const courses = (data ?? []) as unknown as CourseWithRelations[];

      // إحصاءات فعلية (دروس/فيديوهات/ساعات/حصص مباشرة) محسوبة من البيانات
      const { data: stats } = await (supabase.rpc as any)("course_stats");
      const map = new Map<string, CourseStat>();
      for (const row of (stats ?? []) as CourseStat[]) {
        map.set(row.course_id, row);
      }
      return courses.map((c) => {
        const s = map.get(c.id);
        if (!s) return c;
        return {
          ...c,
          lessons_count: Number(s.lessons) || 0,
          videos_count: Number(s.videos) || 0,
          hours: Number(s.hours) || 0,
          live_sessions: Number(s.live_sessions) || 0,
        };
      });
    },
  });
}


/* ===================== طفرات الأدمن ===================== */

type StageInput = Database["public"]["Tables"]["stages"]["Insert"];
type TeacherInput = Database["public"]["Tables"]["teachers"]["Insert"];
type CourseInput = Database["public"]["Tables"]["courses"]["Insert"];

import type { Database } from "@/integrations/supabase/types";

export function useStageAdmin() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["stages"] });

  const create = useMutation({
    mutationFn: async (input: StageInput) => {
      const { error } = await supabase.from("stages").insert(input);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...input }: StageInput & { id: string }) => {
      const { error } = await supabase.from("stages").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  return { create, update, remove };
}

export function useTeacherAdmin() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["teachers"] });
    qc.invalidateQueries({ queryKey: ["courses"] });
  };

  const create = useMutation({
    mutationFn: async (input: TeacherInput) => {
      const { error } = await supabase.from("teachers").insert(input);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...input }: TeacherInput & { id: string }) => {
      const { error } = await supabase.from("teachers").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teachers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  return { create, update, remove };
}

export function useCourseAdmin() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["courses"] });

  const create = useMutation({
    mutationFn: async (input: CourseInput) => {
      const { error } = await supabase.from("courses").insert(input);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...input }: Partial<CourseInput> & { id: string }) => {
      const { error } = await supabase.from("courses").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  return { create, update, remove };
}

export type { Stage, Teacher, Course, CourseWithRelations };
