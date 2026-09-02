import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { auditEvent } from "@/lib/audit";
import type { Database } from "@/integrations/supabase/types";
import type {
  Section,
  Lesson,
  Enrollment,
  LessonProgress,
  SectionWithLessons,
  CourseWithRelations,
} from "@/lib/catalog";

type SectionInput = Database["public"]["Tables"]["sections"]["Insert"];
type LessonInput = Database["public"]["Tables"]["lessons"]["Insert"];

// أعمدة المدرّس العامة فقط (بدون نسبة الربح) — لأن جدول المدرّسين محمي على مستوى الأعمدة.
const TEACHER_PUBLIC_COLUMNS =
  "id,name,subject,bio,experience_years,image_url,rating,students_label,sort_order,created_at,updated_at,stage,grade";

/* ===================== دورة واحدة ===================== */

export function useCourse(courseId: string | undefined) {
  return useQuery({
    queryKey: ["course", courseId],
    enabled: !!courseId,
    queryFn: async (): Promise<CourseWithRelations | null> => {
      const { data, error } = await supabase
        .from("courses")
        .select(`*, teacher:teachers(${TEACHER_PUBLIC_COLUMNS}), stage:stages(*)`)
        .eq("id", courseId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as CourseWithRelations) ?? null;
    },
  });
}

/* ===================== المحتوى (وحدات + دروس) ===================== */

export function useSections(courseId: string | undefined) {
  return useQuery({
    queryKey: ["sections", courseId],
    enabled: !!courseId,
    queryFn: async (): Promise<Section[]> => {
      const { data, error } = await supabase
        .from("sections")
        .select("*")
        .eq("course_id", courseId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLessons(courseId: string | undefined) {
  return useQuery({
    queryKey: ["lessons", courseId],
    enabled: !!courseId,
    queryFn: async (): Promise<Lesson[]> => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*")
        .eq("course_id", courseId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** يجمّع الوحدات مع دروسها (والدروس غير المرتبطة بوحدة تحت "بدون وحدة")
 *  includePending: تُظهر الدروس التي لم يعتمدها المونتاج بعد (لوحة الإدارة/المدرّس فقط) */
export function useCourseContent(
  courseId: string | undefined,
  opts?: { includePending?: boolean },
) {
  const includePending = opts?.includePending ?? false;
  const sectionsQ = useSections(courseId);
  const lessonsQ = useLessons(courseId);

  const visibleLessons = useMemo<Lesson[]>(() => {
    const lessons = lessonsQ.data ?? [];
    if (includePending) return lessons;
    return lessons.filter((l) => (l.review_status ?? "approved") !== "pending");
  }, [lessonsQ.data, includePending]);

  const grouped = useMemo<SectionWithLessons[]>(() => {
    const sections = sectionsQ.data ?? [];
    const lessons = visibleLessons;
    const result: SectionWithLessons[] = sections.map((s) => ({
      ...s,
      lessons: lessons.filter((l) => l.section_id === s.id),
    }));
    const orphan = lessons.filter((l) => !l.section_id);
    if (orphan.length) {
      result.push({
        id: "__orphan__",
        course_id: courseId ?? "",
        title: "دروس عامة",
        sort_order: 9999,
        created_at: "",
        updated_at: "",
        lessons: orphan,
      } as SectionWithLessons);
    }
    return result;
  }, [sectionsQ.data, visibleLessons, courseId]);


  return {
    sections: grouped,
    lessons: visibleLessons,
    isLoading: sectionsQ.isLoading || lessonsQ.isLoading,
  };
}


/* ===================== الاشتراك ===================== */

export function useMyEnrollments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["enrollments", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Enrollment[]> => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEnrollment(courseId: string | undefined) {
  const { data: enrollments = [], isLoading } = useMyEnrollments();
  const enrollment = enrollments.find((e) => e.course_id === courseId) ?? null;
  return { enrollment, isEnrolled: !!enrollment && enrollment.status === "active", isLoading };
}

export function useEnroll() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ courseId, price, couponId }: { courseId: string; price: number; couponId?: string | null }) => {
      if (!user) throw new Error("not_authenticated");
      // سجّل عملية الدفع (لو فيه سعر) — مؤكّدة مباشرة في الوضع الحالي
      if (price > 0) {
        await supabase.from("payments").insert({
          user_id: user.id,
          course_id: courseId,
          amount: price,
          status: "paid",
          provider: "manual",
          coupon_id: couponId ?? null,
        });
      }
      const { error } = await supabase
        .from("enrollments")
        .insert({ user_id: user.id, course_id: courseId, status: "active" });
      if (error && !/duplicate|unique/i.test(error.message)) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enrollments"] });
    },
  });
}

export function useUnenroll() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (courseId: string) => {
      if (!user) throw new Error("not_authenticated");
      const { error } = await supabase
        .from("enrollments")
        .delete()
        .eq("user_id", user.id)
        .eq("course_id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enrollments"] });
    },
  });
}


/* ===================== التقدّم ===================== */

export function useProgress(courseId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["progress", courseId, user?.id],
    enabled: !!user && !!courseId,
    queryFn: async (): Promise<LessonProgress[]> => {
      const { data, error } = await supabase
        .from("lesson_progress")
        .select("*")
        .eq("course_id", courseId!)
        .eq("user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** نسبة اكتمال الفيديو التي تُعتبر بعدها "مكتمل" — من إعدادات المنصة (Completion Threshold) */
export function useCompletionThreshold() {
  return useQuery({
    queryKey: ["settings", "video_completion_threshold_percent"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "video_completion_threshold_percent")
        .maybeSingle();
      if (error) throw error;
      return data ? Number(data.value) : 90;
    },
    staleTime: 5 * 60_000,
  });
}

export type VideoWatchEvent = "play" | "pause" | "heartbeat" | "seek" | "ended" | "resume" | "visibility_change";

/**
 * تتبّع مشاهدة الفيديو الفعلي — عبر RPC ذرّي على الخادم (record_video_watch_event).
 * كل الحساب (النسبة، وقت المشاهدة الفعلي، الاكتمال) يتم على قاعدة البيانات
 * وليس بالثقة في قيم يحسبها المتصفح، وهو ما يمنع فقدان تحديثات عند وجود
 * أكثر من تبويب/جهاز يشتغل على نفس الدرس في نفس الوقت.
 */
export function useRecordWatchEvent(courseId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      lessonId,
      event,
      position,
      duration,
    }: {
      lessonId: string;
      event: VideoWatchEvent;
      position: number;
      duration: number;
    }) => {
      if (!courseId) throw new Error("missing course");
      const { data, error } = await supabase.rpc("record_video_watch_event", {
        _lesson_id: lessonId,
        _course_id: courseId,
        _event: event,
        _position: position,
        _duration: duration,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["progress", courseId] }),
  });
}

export function useUpdateProgress(courseId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      lessonId,
      completed,
      position,
      watchPercent,
      addWatchedSeconds,
      incrementPlayCount,
    }: {
      lessonId: string;
      completed?: boolean;
      position?: number;
      /** أعلى نسبة مشاهدة وصل إليها الطالب من الفيديو (0-100) */
      watchPercent?: number;
      /** ثواني تُضاف لإجمالي وقت المشاهدة الفعلي (وليس فقط آخر نقطة وصول) */
      addWatchedSeconds?: number;
      /** يُستدعى عند بدء تشغيل الفيديو لزيادة عدد مرّات المشاهدة */
      incrementPlayCount?: boolean;
    }) => {
      if (!user || !courseId) throw new Error("missing");

      let nextWatched: number | undefined;
      let nextPlayCount: number | undefined;
      if (addWatchedSeconds || incrementPlayCount) {
        const { data: existing } = await supabase
          .from("lesson_progress")
          .select("total_watched_seconds, play_count")
          .eq("user_id", user.id)
          .eq("lesson_id", lessonId)
          .maybeSingle();
        nextWatched = (existing?.total_watched_seconds ?? 0) + (addWatchedSeconds ?? 0);
        nextPlayCount = (existing?.play_count ?? 0) + (incrementPlayCount ? 1 : 0);
      }

      const { error } = await supabase.from("lesson_progress").upsert(
        {
          user_id: user.id,
          course_id: courseId,
          lesson_id: lessonId,
          ...(completed !== undefined ? { completed } : {}),
          ...(position !== undefined ? { last_position_seconds: Math.round(position) } : {}),
          ...(watchPercent !== undefined ? { watch_percent: Math.min(100, Math.max(0, watchPercent)) } : {}),
          ...(nextWatched !== undefined ? { total_watched_seconds: Math.round(nextWatched) } : {}),
          ...(nextPlayCount !== undefined ? { play_count: nextPlayCount } : {}),
        },
        { onConflict: "user_id,lesson_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["progress", courseId] }),
  });
}

/* ===================== المفضّلة ===================== */

export function useFavorites() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from("favorites").select("course_id").eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((f) => f.course_id);
    },
  });

  const ids = new Set(query.data ?? []);

  const toggle = useMutation({
    mutationFn: async (courseId: string) => {
      if (!user) throw new Error("not_authenticated");
      if (ids.has(courseId)) {
        const { error } = await supabase.from("favorites").delete().eq("user_id", user.id).eq("course_id", courseId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("favorites").insert({ user_id: user.id, course_id: courseId });
        if (error && !/duplicate|unique/i.test(error.message)) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });

  return { favoriteIds: ids, toggle, isLoading: query.isLoading };
}

/* ===================== إدارة المحتوى (admin + teacher) ===================== */

export function useSectionAdmin(courseId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["sections", courseId] });

  const create = useMutation({
    mutationFn: async (input: SectionInput) => {
      const { error } = await supabase.from("sections").insert(input);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SectionInput> & { id: string }) => {
      const { error } = await supabase.from("sections").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  return { create, update, remove };
}

export function useLessonAdmin(courseId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["lessons", courseId] });

  const create = useMutation({
    mutationFn: async (input: LessonInput) => {
      const { error } = await supabase.from("lessons").insert(input);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...input }: Partial<LessonInput> & { id: string }) => {
      const { error } = await supabase.from("lessons").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lessons").delete().eq("id", id);
      if (error) throw error;
      auditEvent("delete", "lesson", { id });
    },
    onSuccess: invalidate,
  });
  return { create, update, remove };
}
