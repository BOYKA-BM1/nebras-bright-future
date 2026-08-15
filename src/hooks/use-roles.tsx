import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type AppRole =
  | "admin"
  | "admin_secondary"
  | "teacher"
  | "student"
  | "customer_service"
  | "secretary"
  | "montage"
  | "psychologist"
  | "photographer";


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
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });

  const roles = query.data ?? [];
  const isFullAdmin = roles.includes("admin");
  const isAdminSecondary = roles.includes("admin_secondary");
  return {
    roles,
    /** أدمن كامل الصلاحيات */
    isFullAdmin,
    isAdminSecondary,
    /** أي أدمن (كامل أو ثانوي) — يفتح لوحة الإدارة */
    isAdmin: isFullAdmin || isAdminSecondary,
    isTeacher: roles.includes("teacher"),
    isCustomerService: roles.includes("customer_service"),
    isSecretary: roles.includes("secretary"),
    isMontage: roles.includes("montage"),
    isPsychologist: roles.includes("psychologist"),
    isPhotographer: roles.includes("photographer"),
    isStaff:
      roles.includes("customer_service") ||
      roles.includes("secretary") ||
      roles.includes("montage") ||
      roles.includes("photographer"),
    isLoading: query.isLoading,
  };
}

