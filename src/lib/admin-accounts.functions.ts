import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeAudit, getClientIp, getUserAgent } from "@/lib/security.server";
import { maskEmail } from "@/lib/mask";

type Ctx = { supabase: any; userId: string };

async function requireFullAdmin(context: Ctx): Promise<void> {
  const { data: full, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("تعذّر التحقق من الصلاحيات.");
  if (!full) throw new Error("غير مصرّح: هذه العملية للأدمن الكامل فقط.");
}

async function requireAnyAdmin(context: Ctx): Promise<{ full: boolean }> {
  const [{ data: full, error: e1 }, { data: secondary, error: e2 }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin_secondary" }),
  ]);
  if (e1 || e2) throw new Error("تعذّر التحقق من الصلاحيات.");
  if (!full && !secondary) throw new Error("غير مصرّح: هذه العملية للإدارة فقط.");
  return { full: !!full };
}

export type AccountRow = {
  id: string;
  email: string;
  real_email: string | null;
  created_at: string;
  full_name: string | null;
  phone: string | null;
  roles: string[];
  banned: boolean;
  device_label: string | null;
  device_registered_at: string | null;
};

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountRow[]> => {
    const { full } = await requireAnyAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (usersErr) throw new Error("تعذّر جلب الحسابات.");

    const [{ data: roles }, { data: profiles }, { data: banned }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("profiles").select("id, full_name, phone, device_label, device_registered_at"),
      supabaseAdmin.from("banned_emails").select("email"),
    ]);

    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    }
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const bannedSet = new Set((banned ?? []).map((b: any) => String(b.email).toLowerCase()));

    return usersData.users.map((u) => {
      const p = profileMap.get(u.id) as any;
      const rawEmail = u.email ?? "";
      return {
        id: u.id,
        real_email: full ? rawEmail : null,
        email: full ? rawEmail : maskEmail(rawEmail),
        created_at: u.created_at,
        full_name: p?.full_name ?? (u.user_metadata?.full_name as string) ?? null,
        phone: full ? (p?.phone ?? null) : p?.phone ? "***" : null,
        roles: roleMap.get(u.id) ?? ["student"],
        banned: bannedSet.has(rawEmail.toLowerCase()),
        device_label: p?.device_label ?? null,
        device_registered_at: p?.device_registered_at ?? null,
      };
    });
  });

async function trustedEmail(userId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) throw new Error("الحساب غير موجود.");
  return data.user.email;
}

async function targetRoles(userId: string): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role);
}

function isAdminRole(roles: string[]): boolean {
  return roles.includes("admin") || roles.includes("admin_secondary");
}

async function countFullAdmins(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
  return new Set((data ?? []).map((r) => r.user_id)).size;
}

/** عمليات يومية: أي أدمن — مع منع المساس بالحسابات الإدارية من الثانوي */
async function assertCanManageTarget(context: Ctx, full: boolean, targetUserId: string) {
  if (targetUserId === context.userId) throw new Error("لا يمكنك تنفيذ هذه العملية على حسابك.");
  const roles = await targetRoles(targetUserId);
  if (isAdminRole(roles) && !full) {
    throw new Error("غير مصرّح: لا يمكن للأدمن الثانوي تعديل حسابات الإدارة.");
  }
  if (roles.includes("admin") && (await countFullAdmins()) <= 1 && full) {
    // still allow full admin to act on others, but not remove last — checked per op
  }
}

export const banAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { full } = await requireAnyAdmin(context);
    await assertCanManageTarget(context, full, data.userId);
    const roles = await targetRoles(data.userId);
    if (roles.includes("admin") && (await countFullAdmins()) <= 1) {
      throw new Error("لا يمكن حظر آخر أدمن كامل.");
    }
    const email = await trustedEmail(data.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("banned_emails")
      .upsert({ email: email.toLowerCase(), reason: data.reason ?? null });
    await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: "876000h" });
    await writeAudit({
      userId: context.userId,
      action: "ban_account",
      entity: data.userId,
      metadata: { reason: data.reason ?? null },
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });
    return { ok: true as const };
  });

export const unbanAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { full } = await requireAnyAdmin(context);
    await assertCanManageTarget(context, full, data.userId);
    const email = await trustedEmail(data.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("banned_emails").delete().eq("email", email.toLowerCase());
    await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: "none" });
    await writeAudit({
      userId: context.userId,
      action: "unban_account",
      entity: data.userId,
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });
    return { ok: true as const };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), alsoBan: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { full } = await requireAnyAdmin(context);
    await assertCanManageTarget(context, full, data.userId);
    const roles = await targetRoles(data.userId);
    if (roles.includes("admin") && (await countFullAdmins()) <= 1) {
      throw new Error("لا يمكن حذف آخر أدمن كامل.");
    }
    const email = await trustedEmail(data.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.alsoBan) {
      await supabaseAdmin
        .from("banned_emails")
        .upsert({ email: email.toLowerCase(), reason: "تم حذف الحساب بواسطة الإدارة" });
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error("تعذّر حذف الحساب.");
    await writeAudit({
      userId: context.userId,
      action: "delete_account",
      entity: data.userId,
      metadata: { alsoBan: !!data.alsoBan },
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });
    return { ok: true as const };
  });

export const ASSIGNABLE_ROLES = [
  "admin",
  "admin_secondary",
  "psychologist",
  "teacher",
  "student",
  "parent",
  "customer_service",
  "secretary",
  "montage",
  "photographer",
] as const;

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(ASSIGNABLE_ROLES),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { full } = await requireAnyAdmin(context);
    if (data.userId === context.userId) throw new Error("لا يمكنك تغيير صلاحيتك بنفسك.");

    // Secondary cannot assign or modify administrative roles
    if (!full && (data.role === "admin" || data.role === "admin_secondary")) {
      await writeAudit({
        userId: context.userId,
        action: "set_user_role_denied",
        entity: data.userId,
        metadata: { role: data.role, reason: "secondary_cannot_assign_admin" },
        ip: getClientIp(),
        userAgent: getUserAgent(),
      });
      throw new Error("غير مصرّح: تعيين الأدوار الإدارية للأدمن الكامل فقط.");
    }

    const existing = await targetRoles(data.userId);
    if (isAdminRole(existing) && !full) {
      await writeAudit({
        userId: context.userId,
        action: "set_user_role_denied",
        entity: data.userId,
        metadata: { role: data.role, reason: "secondary_cannot_modify_admin_account" },
        ip: getClientIp(),
        userAgent: getUserAgent(),
      });
      throw new Error("غير مصرّح: لا يمكن تعديل حساب إداري.");
    }

    if (existing.includes("admin") && data.role !== "admin" && (await countFullAdmins()) <= 1) {
      throw new Error("لا يمكن إزالة صلاحية آخر أدمن كامل.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) جرّب RPC الذري إن كان مطبّقًا على قاعدة البيانات
    const { error: rpcErr } = await context.supabase.rpc("admin_set_user_role", {
      _target: data.userId,
      _new_role: data.role,
    });

    if (!rpcErr) {
      await writeAudit({
        userId: context.userId,
        action: "set_user_role",
        entity: data.userId,
        metadata: { role: data.role, via: "rpc" },
        ip: getClientIp(),
        userAgent: getUserAgent(),
      });
      return { ok: true as const };
    }

    const rpcMsg = (rpcErr.message || "") + " " + ((rpcErr as any).code || "");
    // أخطاء صلاحية واضحة — لا نتجاوزها بمسار بديل
    if (/secondary_cannot/i.test(rpcMsg)) {
      throw new Error("غير مصرّح: لا يمكن تعديل أدوار الإدارة.");
    }
    if (/last_full_admin|cannot_remove_last/i.test(rpcMsg)) {
      throw new Error("لا يمكن إزالة صلاحية آخر أدمن كامل.");
    }
    if (/not_authorized|cannot_change_own/i.test(rpcMsg)) {
      throw new Error("غير مصرّح بتنفيذ هذه العملية.");
    }

    // 2) مسار احتياطي عبر service role (لما RPC مش متطبق أو مش موجود)
    // هذا يغطي: function does not exist / schema cache
    const { error: delErr } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    if (delErr) {
      throw new Error("تعذّر تحديث الصلاحيات: " + (delErr.message || "حذف الأدوار السابقة فشل"));
    }

    if (data.role !== "student") {
      const { error: insErr } = await supabaseAdmin.from("user_roles").insert({
        user_id: data.userId,
        role: data.role,
      });
      if (insErr) {
        // حاول استرجاع الدور السابق عند الفشل
        if (existing.length) {
          await supabaseAdmin.from("user_roles").insert(
            existing.map((role) => ({ user_id: data.userId, role })),
          );
        }
        const hint = /invalid input value for enum|app_role/i.test(insErr.message || "")
          ? " (قيمة الدور غير معرّفة في قاعدة البيانات — طبّق migrations الأدوار)"
          : "";
        throw new Error("تعذّر تعيين الصلاحية" + hint + ": " + (insErr.message || "insert failed"));
      }
    }

    await writeAudit({
      userId: context.userId,
      action: "set_user_role",
      entity: data.userId,
      metadata: { role: data.role, via: "service_role_fallback", rpcError: rpcErr.message },
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });
    return { ok: true as const };
  });

export const resetAccountDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { full } = await requireAnyAdmin(context);
    await assertCanManageTarget(context, full, data.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ device_id: null, device_label: null, device_registered_at: null })
      .eq("id", data.userId);
    if (error) throw new Error("تعذّر إعادة تعيين الجهاز.");
    await writeAudit({
      userId: context.userId,
      action: "reset_device",
      entity: data.userId,
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });
    return { ok: true as const };
  });
