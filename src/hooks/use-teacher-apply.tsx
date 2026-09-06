import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Database } from "@/integrations/supabase/types";

export type TeacherApplication =
  Database["public"]["Tables"]["teacher_applications"]["Row"];

export type TeacherApplicationInput = {
  full_name: string;
  phone: string;
  whatsapp: string;
  subject: string;
  bio: string;
};

/** طلب التقديم الخاص بالحساب الحالي */
export function useMyTeacherApplication() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["teacher-application", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<TeacherApplication | null> => {
      const { data, error } = await supabase
        .from("teacher_applications")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useSubmitTeacherApplication() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TeacherApplicationInput) => {
      if (!user) throw new Error("not_authenticated");
      const { error } = await supabase
        .from("teacher_applications")
        .upsert(
          { ...input, user_id: user.id, status: "pending" },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teacher-application"] }),
  });
}

/** كل الطلبات — للإدارة وخدمة العملاء */
export function useTeacherApplications() {
  return useQuery({
    queryKey: ["teacher-applications"],
    queryFn: async (): Promise<TeacherApplication[]> => {
      const { data, error } = await supabase
        .from("teacher_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useReviewTeacherApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      approve,
      notes,
    }: {
      id: string;
      approve: boolean;
      notes?: string;
    }) => {
      const { error } = await supabase.rpc("review_teacher_application", {
        _id: id,
        _approve: approve,
        _notes: notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-applications"] });
      qc.invalidateQueries({ queryKey: ["admin-teachers"] });
    },
  });
}
