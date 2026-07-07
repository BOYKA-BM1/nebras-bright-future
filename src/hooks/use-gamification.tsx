import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type LeaderRow = { rank: number; user_id: string; name: string; xp: number };

/** إجمالي نقاط الطالب الحالي. */
export function useMyXp() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-xp", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<number> => {
      const { data, error } = await (supabase.rpc as any)("my_xp");
      if (error) throw error;
      return Number(data ?? 0);
    },
    staleTime: 20_000,
  });
}

/** لوحة المتصدّرين (الاسم والنقاط فقط). */
export function useLeaderboard(limit = 20) {
  return useQuery({
    queryKey: ["leaderboard", limit],
    queryFn: async (): Promise<LeaderRow[]> => {
      const { data, error } = await (supabase.rpc as any)("leaderboard", { _limit: limit });
      if (error) throw error;
      return (data ?? []) as LeaderRow[];
    },
    staleTime: 20_000,
  });
}
