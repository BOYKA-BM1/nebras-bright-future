import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export function useRoles() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AppRole[]> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role);
    },
  });

  const roles = query.data ?? [];
  return {
    roles,
    isAdmin: roles.includes("admin"),
    isTeacher: roles.includes("teacher"),
    isCustomerService: roles.includes("customer_service"),
    isSecretary: roles.includes("secretary"),
    isMontage: roles.includes("montage"),
    isStaff:
      roles.includes("customer_service") ||
      roles.includes("secretary") ||
      roles.includes("montage"),
    isLoading: query.isLoading,
  };
}
