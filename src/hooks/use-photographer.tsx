import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PhotoTeacher = {
  id: string;
  name: string;
  subject: string;
  image_url: string | null;
  stage: string | null;
  grade: string | null;
};

export type PhotoCourse = {
  id: string;
  title: string;
  teacher_id: string | null;
  grade: string | null;
  subject: string | null;
  is_published: boolean;
};

/** كل المدرسين الموجودين في المنصة (أي مدرس جديد يظهر تلقائيًا) */
export function usePhotoTeachers() {
  return useQuery({
    queryKey: ["photo-teachers"],
    queryFn: async (): Promise<PhotoTeacher[]> => {
      const { data, error } = await supabase
        .from("teachers")
        .select("id, name, subject, image_url, stage, grade")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PhotoTeacher[];
    },
  });
}

/** دورات مدرّس معيّن */
export function usePhotoCourses(teacherId: string | null) {
  return useQuery({
    queryKey: ["photo-courses", teacherId],
    enabled: !!teacherId,
    queryFn: async (): Promise<PhotoCourse[]> => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, teacher_id, grade, subject, is_published")
        .eq("teacher_id", teacherId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PhotoCourse[];
    },
  });
}

/** دروس الدورة — للاطلاع فقط */
export function usePhotoLessons(courseId: string | null) {
  return useQuery({
    queryKey: ["photo-lessons", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("id, title, review_status, is_published, sort_order, created_at")
        .eq("course_id", courseId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** رفع الفيديو كما هو بدون أي إعادة ترميز (الجودة الأصلية كاملة) */
export function useUploadPhotoVideo() {
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const path = `raw/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
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

/** إضافة درس جديد — يروح لطابور المونتاج (pending) ومش بيتنشر مباشرة */
export function useAddPhotoLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      courseId: string;
      title: string;
      description: string;
      durationMinutes: number;
      videoUrl: string;
    }) => {
      const { count } = await supabase
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("course_id", input.courseId);
      const { error } = await supabase.from("lessons").insert({
        course_id: input.courseId,
        title: input.title,
        description: input.description || null,
        video_url: input.videoUrl,
        duration_minutes: input.durationMinutes,
        sort_order: (count ?? 0) + 1,
        is_published: false,
        review_status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["photo-lessons", v.courseId] });
    },
  });
}
