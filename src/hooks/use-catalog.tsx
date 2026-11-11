import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { adminDeleteCourse, adminDeleteTeacher, adminCreateStage, adminUpdateStage, adminCreateTeacher, adminUpdateTeacher, adminCreateCourse, adminUpdateCourse } from "@/lib/catalog-admin.functions";
import { auditEvent } from "@/lib/audit";
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


// أعمدة المدرّس الآمنة للعرض العام (بدون نسبة الربح والبيانات الحساسة)
const TEACHER_PUBLIC_COLUMNS =
  "id,name,subject,bio,experience_years,image_url,rating,students_label,sort_order,created_at,updated_at,stage,grade";

async function mergeTeacherStudents(teachers: Teacher[]): Promise<Teacher[]> {
  const { data: stats } = await (supabase.rpc as any)("teacher_stats");
  const map = new Map<string, number>();
  for (const row of (stats ?? []) as { teacher_id: string; students: number }[]) {
    map.set(row.teacher_id, Number(row.students) || 0);
  }
  return teachers.map((t) => ({
    ...t,
    students_label: map.has(t.id) ? String(map.get(t.id)) : t.students_label,
  }));
}

export function useTeachers() {
  return useQuery({
    queryKey: ["teachers"],
    queryFn: async (): Promise<Teacher[]> => {
      const { data, error } = await supabase
        .from("teachers")
        .select(TEACHER_PUBLIC_COLUMNS)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const teachers = (data ?? []) as unknown as Teacher[];

      // عدد الطلاب الحقيقي لكل مدرّس
      return mergeTeacherStudents(teachers);
    },
  });
}

/** قراءة كاملة لبيانات المدرّسين (تشمل نسبة الربح) — للأدمن فقط عبر دالة محمية */
export function useAdminTeachers() {
  return useQuery({
    queryKey: ["admin-teachers"],
    queryFn: async (): Promise<Teacher[]> => {
      const { data, error } = await (supabase.rpc as any)("admin_teachers");
      if (error) throw error;
      const teachers = (data ?? []) as unknown as Teacher[];
      return mergeTeacherStudents(teachers);
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
        .select(`*, teacher:teachers(${TEACHER_PUBLIC_COLUMNS}), stage:stages(*)`)
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
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["stages"] });
    void qc.refetchQueries({ queryKey: ["stages"] });
  };
  const createFn = useServerFn(adminCreateStage);
  const updateFn = useServerFn(adminUpdateStage);

  const create = useMutation({
    mutationFn: async (input: any) => {
      await createFn({ data: input });
    },
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...input }: any) => {
      await updateFn({ data: { id, ...input } });
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

  const createTeacherFn = useServerFn(adminCreateTeacher);
  const updateTeacherFn = useServerFn(adminUpdateTeacher);
  const create = useMutation({
    mutationFn: async (input: TeacherInput) => {
      await createTeacherFn({ data: input as any });
    },
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...input }: TeacherInput & { id: string }) => {
      await updateTeacherFn({ data: { id, ...input } as any });
    },
    onSuccess: invalidate,
  });
  const delTeacher = useServerFn(adminDeleteTeacher);
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await delTeacher({ data: { teacherId: id } });
      auditEvent("delete", "teacher", { id });
      return id;
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["teachers"] });
      const prev = qc.getQueryData<any[]>(["teachers"]);
      if (prev) qc.setQueryData(["teachers"], prev.filter((t) => t.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["teachers"], ctx.prev);
    },
    onSuccess: () => {
      invalidate();
      void qc.refetchQueries({ queryKey: ["teachers"] });
      void qc.refetchQueries({ queryKey: ["photo-teachers"] });
      void qc.refetchQueries({ queryKey: ["courses"] });
    },
  });
  return { create, update, remove };
}

export function useCourseAdmin() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["courses"] });

  const createCourseFn = useServerFn(adminCreateCourse);
  const updateCourseFn = useServerFn(adminUpdateCourse);
  const create = useMutation({
    mutationFn: async (input: CourseInput) => {
      await createCourseFn({ data: input as any });
    },
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...input }: Partial<CourseInput> & { id: string }) => {
      await updateCourseFn({ data: { id, ...input } as any });
    },
    onSuccess: invalidate,
  });
  const delCourse = useServerFn(adminDeleteCourse);
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await delCourse({ data: { courseId: id } });
      auditEvent("delete", "course", { id });
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["photo-courses"] });
    },
  });
  return { create, update, remove };
}

/** رفع صورة (دورة/مدرّس) من الجهاز إلى التخزين وإرجاع رابط موقّع طويل المدى */
export function useUploadImage() {
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not_authenticated");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data, error: signErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr) throw signErr;
      return data.signedUrl;
    },
  });
}

export type { Stage, Teacher, Course, CourseWithRelations };

