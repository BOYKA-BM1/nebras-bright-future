import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Database } from "@/integrations/supabase/types";

export type EducationSystem = Database["public"]["Tables"]["education_systems"]["Row"];
export type BaccalaureateTrack = Database["public"]["Tables"]["baccalaureate_tracks"]["Row"];
export type AcademicYear = Database["public"]["Tables"]["academic_years"]["Row"];
export type Subject = Database["public"]["Tables"]["subjects"]["Row"];
export type StudentEducationProfile = Database["public"]["Tables"]["student_education_profiles"]["Row"];
export type TrackChangeRequest = Database["public"]["Tables"]["track_change_requests"]["Row"];

export function useEducationSystems() {
  return useQuery({
    queryKey: ["education-systems"],
    queryFn: async (): Promise<EducationSystem[]> => {
      const { data, error } = await supabase.from("education_systems").select("*").eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

export function useBaccalaureateTracks() {
  return useQuery({
    queryKey: ["baccalaureate-tracks"],
    queryFn: async (): Promise<BaccalaureateTrack[]> => {
      const { data, error } = await supabase.from("baccalaureate_tracks").select("*").eq("active", true).order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

export function useActiveAcademicYear() {
  return useQuery({
    queryKey: ["active-academic-year"],
    queryFn: async (): Promise<AcademicYear | null> => {
      const { data, error } = await supabase.from("academic_years").select("*").eq("is_active", true).maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

/** بروفايل الطالب التعليمي (نظام/صف/مسار) — الطالب نفسه بس */
export function useMyEducationProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-education-profile", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<StudentEducationProfile | null> => {
      const { data, error } = await supabase.from("student_education_profiles").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** يُستخدم مرّة واحدة فقط أثناء الـonboarding — الكتابة اللاحقة ممنوعة على مستوى RLS عمدًا */
export function useCreateEducationProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { educationSystemId: string; grade: string; trackId?: string | null; academicYearId?: string | null }) => {
      if (!user) throw new Error("auth required");
      const { error } = await supabase.from("student_education_profiles").insert({
        user_id: user.id,
        education_system_id: input.educationSystemId,
        grade: input.grade,
        track_id: input.trackId ?? null,
        academic_year_id: input.academicYearId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-education-profile", user?.id] }),
  });
}

export function useRequestTrackChange() {
  return useMutation({
    mutationFn: async (requestedTrackId: string) => {
      const { data, error } = await supabase.rpc("request_track_change", { _requested_track_id: requestedTrackId });
      if (error) throw error;
      return data;
    },
  });
}

/** أحدث طلب تغيير مسار للطالب الحالي (لمعرفة هل عنده طلب pending) */
/** أدمن فقط — إدارة السنوات الدراسية */
export function useAcademicYearsAdmin() {
  return useQuery({
    queryKey: ["academic-years-admin"],
    queryFn: async (): Promise<AcademicYear[]> => {
      const { data, error } = await supabase.from("academic_years").select("*").order("name", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAcademicYearActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["academic-years-admin"] });
    qc.invalidateQueries({ queryKey: ["active-academic-year"] });
  };
  const create = useMutation({
    mutationFn: async (input: { name: string; start_date?: string | null; end_date?: string | null }) => {
      const { error } = await supabase.from("academic_years").insert(input);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const activate = useMutation({
    mutationFn: async (id: string) => {
      // نلغي أي سنة فعّالة تانية الأول (index unique بيمنع أكتر من سنة فعّالة واحدة في نفس الوقت)
      await supabase.from("academic_years").update({ is_active: false }).eq("is_active", true);
      const { error } = await supabase.from("academic_years").update({ is_active: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  return { create, activate };
}

/** أدمن فقط — إدارة المواد */
export function useSubjectsAdmin(filters?: { educationSystemId?: string; grade?: string; trackId?: string | null }) {
  return useQuery({
    queryKey: ["subjects-admin", filters],
    queryFn: async (): Promise<Subject[]> => {
      let q = supabase.from("subjects").select("*").order("name_ar");
      if (filters?.educationSystemId) q = q.eq("education_system_id", filters.educationSystemId);
      if (filters?.grade) q = q.eq("grade", filters.grade);
      if (filters?.trackId !== undefined) {
        q = filters.trackId === null ? q.is("track_id", null) : q.eq("track_id", filters.trackId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSubjectActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["subjects-admin"] });
  const create = useMutation({
    mutationFn: async (input: Database["public"]["Tables"]["subjects"]["Insert"]) => {
      const { error } = await supabase.from("subjects").insert(input);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Database["public"]["Tables"]["subjects"]["Update"]) => {
      const { error } = await supabase.from("subjects").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      // soft delete فقط — زي ما مطلوب، مفيش حذف فعلي لبيانات ممكن تبقى مستخدمة
      const { error } = await supabase.from("subjects").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  return { create, update, remove };
}

/** أدمن فقط — طلبات تغيير المسار */
export function useTrackChangeRequestsAdmin(status: "pending" | "approved" | "rejected" = "pending") {
  return useQuery({
    queryKey: ["track-change-requests-admin", status],
    queryFn: async (): Promise<(TrackChangeRequest & { studentName: string; currentTrackName: string | null; requestedTrackName: string })[]> => {
      const { data, error } = await supabase.from("track_change_requests").select("*").eq("status", status).order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const studentIds = [...new Set(rows.map((r) => r.student_user_id))];
      const trackIds = [...new Set([...rows.map((r) => r.current_track_id), ...rows.map((r) => r.requested_track_id)].filter(Boolean))] as string[];
      const [{ data: profiles }, { data: tracksData }] = await Promise.all([
        studentIds.length ? supabase.from("profiles").select("id, full_name").in("id", studentIds) : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
        trackIds.length ? supabase.from("baccalaureate_tracks").select("id, name_ar").in("id", trackIds) : Promise.resolve({ data: [] as { id: string; name_ar: string }[] }),
      ]);
      const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "طالب"]));
      const trackMap = new Map((tracksData ?? []).map((t) => [t.id, t.name_ar]));
      return rows.map((r) => ({
        ...r,
        studentName: nameMap.get(r.student_user_id) ?? "طالب",
        currentTrackName: r.current_track_id ? trackMap.get(r.current_track_id) ?? null : null,
        requestedTrackName: trackMap.get(r.requested_track_id) ?? "مسار",
      }));
    },
  });
}

export function useReviewTrackChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, approve }: { requestId: string; approve: boolean }) => {
      const { error } = await supabase.rpc("review_track_change", { _request_id: requestId, _approve: approve });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["track-change-requests-admin"] }),
  });
}

/** أحدث طلبات تغيير المسار للطالب الحالي (لمعرفة هل عنده طلب pending) */
export function useMyTrackChangeRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-track-change-requests", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<TrackChangeRequest[]> => {
      const { data, error } = await supabase.from("track_change_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** بروفايل ابن ولي الأمر التعليمي — عبر سياسة RLS الخاصة بولي الأمر */
export function useChildEducationProfile(studentId: string | null) {
  return useQuery({
    queryKey: ["child-education-profile", studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<StudentEducationProfile | null> => {
      const { data, error } = await supabase.from("student_education_profiles").select("*").eq("user_id", studentId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
