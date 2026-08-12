import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StaffComplaint = {
  id: string;
  subject: string;
  message: string;
  status: string;
  response: string | null;
  created_at: string;
  senderName: string | null;
  senderRole: string;
};

const STAFF_ROLES = ["teacher", "montage", "psychologist", "customer_service"] as const;

export const ROLE_LABELS: Record<string, string> = {
  teacher: "مدرّس",
  montage: "مونتاج",
  psychologist: "الغرفة النفسية",
  customer_service: "خدمة العملاء",
};

/** شكاوى الطاقم (مدرّسين/مونتاج/نفسي/خدمة عملاء) — للسكرتارية والأدمن فقط */
export const getStaffComplaints = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffComplaint[]> => {
    const { data: myRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (myRoles ?? []).map((r) => r.role as string);
    const allowed = roles.some((r) => r === "secretary" || r === "admin" || r === "admin_secondary");
    if (!allowed) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: staffRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", [...STAFF_ROLES]);

    const roleMap = new Map<string, string>();
    for (const r of staffRoles ?? []) if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, r.role as string);
    const ids = [...roleMap.keys()];
    if (!ids.length) return [];

    const [{ data: tickets }, { data: profiles }] = await Promise.all([
      supabaseAdmin
        .from("support_tickets")
        .select("id, user_id, subject, message, status, response, created_at")
        .in("user_id", ids)
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, full_name").in("id", ids),
    ]);

    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    return (tickets ?? []).map((t) => ({
      id: t.id,
      subject: t.subject,
      message: t.message,
      status: t.status,
      response: t.response,
      created_at: t.created_at,
      senderName: nameMap.get(t.user_id) ?? null,
      senderRole: roleMap.get(t.user_id) ?? "staff",
    }));
  });
