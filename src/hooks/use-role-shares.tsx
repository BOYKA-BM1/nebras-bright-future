import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type RoleShare = Database["public"]["Tables"]["role_shares"]["Row"];

/** الوظائف اللي بنحدد لها نسبة مكسب من المنصة */
export const SHARE_ROLES: { role: AppRole; label: string }[] = [
  { role: "teacher", label: "المدرّس" },
  { role: "customer_service", label: "خدمة العملاء" },
  { role: "secretary", label: "السكرتيرة" },
  { role: "montage", label: "المونتاج" },
];

export function useRoleShares() {
  return useQuery({
    queryKey: ["role-shares"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from("role_shares").select("role,percentage");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) map[r.role] = Number(r.percentage);
      return map;
    },
    staleTime: 30_000,
  });
}

export function useUpdateRoleShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ role, percentage }: { role: AppRole; percentage: number }) => {
      const pct = Math.min(100, Math.max(0, Math.round(percentage)));
      const { error } = await supabase
        .from("role_shares")
        .upsert({ role, percentage: pct }, { onConflict: "role" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-shares"] });
      qc.invalidateQueries({ queryKey: ["admin-finance"] });
    },
  });
}
