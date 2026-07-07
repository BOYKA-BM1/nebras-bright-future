import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("تعذّر التحقق من الصلاحيات.");
  if (!data) throw new Error("غير مصرّح: هذه العملية للإدارة فقط.");
}

export type AccountRow = {
  id: string;
  email: string;
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
    await assertAdmin(context);
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
    const bannedSet = new Set((banned ?? []).map((b: any) => b.email.toLowerCase()));

    return usersData.users.map((u) => {
      const p = profileMap.get(u.id) as any;
      return {
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        full_name: p?.full_name ?? (u.user_metadata?.full_name as string) ?? null,
        phone: p?.phone ?? null,
        roles: roleMap.get(u.id) ?? ["student"],
        banned: bannedSet.has((u.email ?? "").toLowerCase()),
        device_label: p?.device_label ?? null,
        device_registered_at: p?.device_registered_at ?? null,
      };
    });
  });

export const banAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), email: z.string().email(), reason: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("banned_emails")
      .upsert({ email: data.email.toLowerCase(), reason: data.reason ?? null });
    // إنهاء جلسات الحساب فورًا
    await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: "876000h" });
    return { ok: true };
  });

export const unbanAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), email: z.string().email() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("banned_emails").delete().eq("email", data.email.toLowerCase());
    await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: "none" });
    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), email: z.string().email(), alsoBan: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.alsoBan) {
      await supabaseAdmin
        .from("banned_emails")
        .upsert({ email: data.email.toLowerCase(), reason: "تم حذف الحساب بواسطة الإدارة" });
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error("تعذّر حذف الحساب.");
    return { ok: true };
  });

export const ASSIGNABLE_ROLES = [
  "admin",
  "teacher",
  "student",
  "customer_service",
  "secretary",
  "montage",
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
    await assertAdmin(context);
    if (data.userId === context.userId && data.role !== "admin") {
      throw new Error("لا يمكنك تغيير صلاحيتك بنفسك.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // "تعيين" يستبدل صلاحيات الحساب بالصلاحية المختارة
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    if (data.role !== "student") {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (error) throw new Error("تعذّر تعيين الصلاحية.");
    }
    return { ok: true };
  });

export const resetAccountDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ device_id: null, device_label: null, device_registered_at: null })
      .eq("id", data.userId);
    if (error) throw new Error("تعذّر إعادة تعيين الجهاز.");
    return { ok: true };
  });


