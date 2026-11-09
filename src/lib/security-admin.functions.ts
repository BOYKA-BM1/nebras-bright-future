import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { maskIp } from "@/lib/mask";

async function adminLevel(userId: string): Promise<"full" | "secondary" | null> {
  const [{ data: full }, { data: secondary }] = await Promise.all([
    supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin_secondary" }),
  ]);
  if (full) return "full";
  if (secondary) return "secondary";
  return null;
}

export type SafeAuditLogRow = {
  id: string;
  user_id: string | null;
  action: string;
  entity: string | null;
  /** Always safe for the caller's role — never raw IP for secondary */
  ip: string | null;
  created_at: string;
  full_name: string | null;
};

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        actionFilter: z.string().max(80).optional().nullable(),
        limit: z.number().int().min(1).max(300).optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<SafeAuditLogRow[]> => {
    const level = await adminLevel(context.userId);
    if (!level) throw new Error("غير مصرّح.");

    const limit = data?.limit ?? 300;
    let q = supabaseAdmin
      .from("audit_logs")
      .select("id, user_id, action, entity, ip, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (data?.actionFilter) q = q.eq("action", data.actionFilter);

    const { data: rows, error } = await q;
    if (error) throw new Error("تعذّر جلب السجلات.");

    const userIds = [...new Set((rows ?? []).map((r) => r.user_id).filter(Boolean))] as string[];
    const nameMap = new Map<string, string | null>();
    if (userIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      for (const p of profiles ?? []) nameMap.set(p.id, p.full_name);
    }

    return (rows ?? []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      action: r.action,
      entity: r.entity,
      ip: level === "full" ? r.ip : maskIp(r.ip),
      created_at: r.created_at,
      full_name: r.user_id ? nameMap.get(r.user_id) ?? null : null,
    }));
  });
