import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Database } from "@/integrations/supabase/types";

export type Assignment = Database["public"]["Tables"]["assignments"]["Row"];
export type AssignmentSubmission = Database["public"]["Tables"]["assignment_submissions"]["Row"];

/** واجبات كورس معيّن — للمدرّس (إدارة) وللطالب (المستهدَف فقط عبر RLS) */
export function useCourseAssignments(courseId: string | undefined) {
  return useQuery({
    queryKey: ["assignments", courseId],
    enabled: !!courseId,
    queryFn: async (): Promise<Assignment[]> => {
      const { data, error } = await supabase.from("assignments").select("*").eq("course_id", courseId!).order("due_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** كل الواجبات المستهدف بها الطالب الحالي، عبر كل الكورسات المشترك فيها */
export function useMyAssignments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-assignments", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<(Assignment & { courseTitle: string })[]> => {
      const { data: enrollments } = await supabase.from("enrollments").select("course_id").eq("status", "active");
      const courseIds = [...new Set((enrollments ?? []).map((e) => e.course_id))];
      if (courseIds.length === 0) return [];
      const { data: assignments, error } = await supabase
        .from("assignments")
        .select("*")
        .in("course_id", courseIds)
        .eq("status", "open")
        .order("due_at", { ascending: true });
      if (error) throw error;
      const rows = assignments ?? [];
      const { data: courses } = await supabase.from("courses").select("id, title").in("id", courseIds);
      const courseMap = new Map((courses ?? []).map((c) => [c.id, c.title]));
      return rows.map((a) => ({ ...a, courseTitle: courseMap.get(a.course_id) ?? "دورة" }));
    },
  });
}

export function useMySubmission(assignmentId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["assignment-submission", assignmentId, user?.id],
    enabled: !!assignmentId && !!user,
    queryFn: async (): Promise<AssignmentSubmission | null> => {
      const { data, error } = await supabase
        .from("assignment_submissions")
        .select("*")
        .eq("assignment_id", assignmentId!)
        .eq("student_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useAssignmentActions() {
  const qc = useQueryClient();
  const invalidate = (courseId?: string) => {
    qc.invalidateQueries({ queryKey: ["assignments", courseId] });
    qc.invalidateQueries({ queryKey: ["my-assignments"] });
  };

  const create = useMutation({
    mutationFn: async (input: { course_id: string; title: string; description?: string; due_at?: string | null; max_score?: number; lesson_id?: string | null }) => {
      const { error } = await supabase.from("assignments").insert(input);
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(v.course_id),
  });

  const update = useMutation({
    mutationFn: async ({ id, courseId, ...patch }: { id: string; courseId: string } & Partial<Pick<Assignment, "title" | "description" | "due_at" | "max_score" | "status">>) => {
      const { error } = await supabase.from("assignments").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(v.courseId),
  });

  const remove = useMutation({
    mutationFn: async ({ id }: { id: string; courseId: string }) => {
      const { error } = await supabase.from("assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(v.courseId),
  });

  return { create, update, remove };
}

export function useSubmitAssignment() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId, fileUrl, note }: { assignmentId: string; fileUrl?: string | null; note?: string | null }) => {
      if (!user) throw new Error("auth required");
      const { error } = await supabase.from("assignment_submissions").upsert(
        { assignment_id: assignmentId, student_id: user.id, file_url: fileUrl ?? null, note: note ?? null, submitted_at: new Date().toISOString() },
        { onConflict: "assignment_id,student_id" },
      );
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["assignment-submission", v.assignmentId] }),
  });
}

/** كل التسليمات لواجب معيّن — للمدرّس فقط عبر RLS */
export function useAssignmentSubmissions(assignmentId: string | null) {
  return useQuery({
    queryKey: ["assignment-submissions", assignmentId],
    enabled: !!assignmentId,
    queryFn: async (): Promise<(AssignmentSubmission & { studentName: string })[]> => {
      const { data, error } = await supabase.from("assignment_submissions").select("*").eq("assignment_id", assignmentId!).order("submitted_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const ids = [...new Set(rows.map((r) => r.student_id))];
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] as { id: string; full_name: string | null }[] };
      const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "طالب"]));
      return rows.map((r) => ({ ...r, studentName: nameMap.get(r.student_id) ?? "طالب" }));
    },
  });
}

export function useGradeSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, score, feedback }: { id: string; assignmentId: string; score: number; feedback?: string | null }) => {
      const { error } = await supabase.from("assignment_submissions").update({ score, feedback: feedback ?? null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["assignment-submissions", v.assignmentId] }),
  });
}
