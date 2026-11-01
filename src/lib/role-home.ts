import type { AppRole } from "@/hooks/use-roles";

/** الصفحة الرئيسية حسب أدوار المستخدم بعد تسجيل الدخول */
export function resolveRoleHome(roles: AppRole[]): string {
  if (roles.includes("admin") || roles.includes("admin_secondary")) return "/admin";
  if (roles.includes("teacher")) return "/teacher";
  if (roles.includes("psychologist")) return "/psych";
  if (roles.includes("montage")) return "/staff/montage";
  if (roles.includes("photographer")) return "/staff/photographer";
  if (roles.includes("customer_service")) return "/staff/support";
  if (roles.includes("secretary")) return "/staff/students";
  if (roles.includes("parent")) return "/parent";
  return "/dashboard";
}

export async function fetchUserRoles(userId: string): Promise<AppRole[]> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) {
    console.warn("roles fetch", error);
    return [];
  }
  return (data ?? []).map((r) => r.role as AppRole);
}
