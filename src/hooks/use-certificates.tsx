import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Database } from "@/integrations/supabase/types";

export type Certificate = Database["public"]["Tables"]["certificates"]["Row"];

/** شهادات الطالب الحالي، مع اسم الدورة */
export function useMyCertificates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-certificates", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<(Certificate & { courseTitle: string })[]> => {
      const { data, error } = await supabase.from("certificates").select("*").order("issued_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const courseIds = [...new Set(rows.map((r) => r.course_id))];
      const { data: courses } = courseIds.length
        ? await supabase.from("courses").select("id, title").in("id", courseIds)
        : { data: [] as { id: string; title: string }[] };
      const courseMap = new Map((courses ?? []).map((c) => [c.id, c.title]));
      return rows.map((r) => ({ ...r, courseTitle: courseMap.get(r.course_id) ?? "دورة" }));
    },
  });
}

/**
 * يطلب شهادة الطالب لدورة معيّنة — الدالة على الخادم (claim_certificate) هي اللي
 * تتحقق فعليًا من نسبة الإكمال في lesson_progress قبل ما تصدر أي شهادة؛ الطالب
 * مايقدرش يزوّر بيانات الشهادة لأنه مش بيبعت غير course_id.
 */
export function useClaimCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (courseId: string) => {
      const { data, error } = await supabase.rpc("claim_certificate", { _course_id: courseId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-certificates"] }),
  });
}

export type VerifiedCertificate = {
  certificate_number: string;
  status: string;
  issued_at: string;
  student_name: string;
  course_title: string;
};

/** تحقّق عام من رقم شهادة — بدون تسجيل دخول، يكشف حقولًا محدودة فقط */
export function useVerifyCertificate(number: string | undefined) {
  return useQuery({
    queryKey: ["verify-certificate", number],
    enabled: !!number,
    queryFn: async (): Promise<VerifiedCertificate | null> => {
      const { data, error } = await supabase.rpc("verify_certificate", { _number: number! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}
