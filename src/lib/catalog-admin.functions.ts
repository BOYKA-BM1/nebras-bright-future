import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { writeAudit, getClientIp, getUserAgent } from "@/lib/security.server";

async function assertAnyAdmin(userId: string) {
  const [{ data: full }, { data: secondary }] = await Promise.all([
    supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin_secondary" }),
  ]);
  if (!full && !secondary) throw new Error("غير مصرّح: للإدارة فقط.");
}

/** حذف دورة — يتجاوز قيود RLS القديمة التي تقتصر على admin فقط */
export const adminDeleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ courseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAnyAdmin(context.userId);
    // فك الارتباطات الخفيفة ثم الحذف
    await supabaseAdmin.from("lessons").delete().eq("course_id", data.courseId);
    await supabaseAdmin.from("sections").delete().eq("course_id", data.courseId);
    const { error } = await supabaseAdmin.from("courses").delete().eq("id", data.courseId);
    if (error) throw new Error("تعذّر حذف الدورة: " + (error.message || ""));
    await writeAudit({
      userId: context.userId,
      action: "delete_course",
      entity: data.courseId,
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });
    return { ok: true as const };
  });

/** حذف مدرّس — يختفي من قائمة المصور تلقائيًا */
export const adminDeleteTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ teacherId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAnyAdmin(context.userId);
    // الدورات تبقى بدون مدرّس
    await supabaseAdmin.from("courses").update({ teacher_id: null }).eq("teacher_id", data.teacherId);
    const { error } = await supabaseAdmin.from("teachers").delete().eq("id", data.teacherId);
    if (error) throw new Error("تعذّر حذف المدرّس: " + (error.message || ""));
    await writeAudit({
      userId: context.userId,
      action: "delete_teacher",
      entity: data.teacherId,
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });
    return { ok: true as const };
  });

export const adminDeleteAcademicYear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ yearId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAnyAdmin(context.userId);
    const { error } = await supabaseAdmin.from("academic_years").delete().eq("id", data.yearId);
    if (error) throw new Error("تعذّر حذف السنة: " + (error.message || ""));
    await writeAudit({
      userId: context.userId,
      action: "delete_academic_year",
      entity: data.yearId,
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });
    return { ok: true as const };
  });


export const adminCreateAcademicYear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().min(2).max(40),
      start_date: z.string().optional().nullable(),
      end_date: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAnyAdmin(context.userId);
    const { error } = await supabaseAdmin.from("academic_years").insert({
      name: data.name.trim(),
      start_date: data.start_date ?? null,
      end_date: data.end_date ?? null,
      is_active: false,
    });
    if (error) throw new Error(error.message || "تعذّرت إضافة السنة");
    await writeAudit({
      userId: context.userId,
      action: "create_academic_year",
      entity: data.name,
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });
    return { ok: true as const };
  });


export const adminActivateAcademicYear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ yearId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAnyAdmin(context.userId);
    await supabaseAdmin.from("academic_years").update({ is_active: false }).eq("is_active", true);
    const { error } = await supabaseAdmin
      .from("academic_years")
      .update({ is_active: true })
      .eq("id", data.yearId);
    if (error) throw new Error(error.message || "تعذّر تفعيل السنة");
    await writeAudit({
      userId: context.userId,
      action: "activate_academic_year",
      entity: data.yearId,
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });
    return { ok: true as const };
  });


export const adminCreateStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().min(2),
      short: z.string().optional().nullable(),
      level: z.string().min(1),
      description: z.string().optional().nullable(),
      icon: z.string().optional().nullable(),
      sort_order: z.number().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAnyAdmin(context.userId);
    const { error } = await supabaseAdmin.from("stages").insert({
      name: data.name.trim(),
      short: data.short ?? null,
      level: data.level,
      description: data.description ?? null,
      icon: data.icon ?? "GraduationCap",
      sort_order: data.sort_order ?? 0,
    });
    if (error) throw new Error(error.message || "تعذّرت إضافة المرحلة");
    return { ok: true as const };
  });

export const adminUpdateStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(2),
      short: z.string().optional().nullable(),
      level: z.string().min(1),
      description: z.string().optional().nullable(),
      icon: z.string().optional().nullable(),
      sort_order: z.number().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAnyAdmin(context.userId);
    const { id, ...rest } = data;
    const { error } = await supabaseAdmin.from("stages").update(rest).eq("id", id);
    if (error) throw new Error(error.message || "تعذّر تحديث المرحلة");
    return { ok: true as const };
  });

export const adminEnsurePaymentMethods = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAnyAdmin(context.userId);
    const defaults = [
      { key: "instapay", label: "InstaPay", sort_order: 1, instructions: "حوّل عبر InstaPay بالمبلغ المطلوب ثم ارفق رقم العملية أو صورة الإيصال.", is_active: true },
      { key: "vodafone_cash", label: "فودافون كاش", sort_order: 2, instructions: "حوّل عبر فودافون كاش ثم ارفق رقم العملية.", is_active: true },
      { key: "etisalat_cash", label: "اتصالات كاش", sort_order: 3, instructions: "حوّل عبر اتصالات كاش ثم ارفق رقم العملية.", is_active: true },
      { key: "fawry", label: "فوري", sort_order: 4, instructions: "ادفع عبر فوري ثم أدخل رقم العملية.", is_active: false },
    ];
    for (const m of defaults) {
      const { data: existing } = await supabaseAdmin
        .from("payment_methods")
        .select("id, key")
        .eq("key", m.key)
        .maybeSingle();
      if (!existing) {
        const { error } = await supabaseAdmin.from("payment_methods").insert({
          key: m.key,
          label: m.label,
          number: m.key === "instapay" ? "" : null,
          instructions: m.instructions,
          is_active: m.is_active,
          sort_order: m.sort_order,
        });
        if (error) throw new Error("تعذّر إضافة " + m.label + ": " + error.message);
      } else if (m.key === "instapay") {
        // تأكد إن InstaPay موجود ومفعّل
        await supabaseAdmin
          .from("payment_methods")
          .update({ is_active: true, label: "InstaPay", sort_order: 1 })
          .eq("key", "instapay");
      }
    }
    return { ok: true as const };
  });


/** إنشاء/تحديث مدرّس عبر service role (يشتغل للأدمن الثانوي) */
export const adminCreateTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.record(z.string(), z.any()).parse(d))
  .handler(async ({ data, context }) => {
    await assertAnyAdmin(context.userId);
    const payload = { ...data } as Record<string, unknown>;
    delete payload.id;
    const { data: row, error } = await supabaseAdmin
      .from("teachers")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message || "تعذّرت إضافة المدرّس");
    await writeAudit({
      userId: context.userId,
      action: "create_teacher",
      entity: row.id,
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });
    return { ok: true as const, id: row.id };
  });

export const adminUpdateTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).passthrough().parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAnyAdmin(context.userId);
    const { id, ...rest } = data as { id: string } & Record<string, unknown>;
    const { error } = await supabaseAdmin.from("teachers").update(rest).eq("id", id);
    if (error) throw new Error(error.message || "تعذّر تحديث المدرّس");
    await writeAudit({
      userId: context.userId,
      action: "update_teacher",
      entity: id,
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });
    return { ok: true as const };
  });

export const adminCreateCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.record(z.string(), z.any()).parse(d))
  .handler(async ({ data, context }) => {
    await assertAnyAdmin(context.userId);
    const payload = { ...data } as Record<string, unknown>;
    delete payload.id;
    const { data: row, error } = await supabaseAdmin
      .from("courses")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message || "تعذّرت إضافة الدورة");
    await writeAudit({
      userId: context.userId,
      action: "create_course",
      entity: row.id,
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });
    return { ok: true as const, id: row.id };
  });

export const adminUpdateCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).passthrough().parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAnyAdmin(context.userId);
    const { id, ...rest } = data as { id: string } & Record<string, unknown>;
    const { error } = await supabaseAdmin.from("courses").update(rest).eq("id", id);
    if (error) throw new Error(error.message || "تعذّر تحديث الدورة");
    await writeAudit({
      userId: context.userId,
      action: "update_course",
      entity: id,
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });
    return { ok: true as const };
  });


async function assertCanManageCourse(userId: string, courseId: string) {
  try {
    await assertAnyAdmin(userId);
    return;
  } catch {
    /* ليس أدمن — تحقق ملكية المدرّس */
  }
  const { data: course } = await supabaseAdmin
    .from("courses")
    .select("id, teacher_id")
    .eq("id", courseId)
    .maybeSingle();
  if (!course?.teacher_id) throw new Error("غير مصرّح بإدارة هذه الدورة");
  const { data: teacher } = await supabaseAdmin
    .from("teachers")
    .select("user_id")
    .eq("id", course.teacher_id)
    .maybeSingle();
  if (teacher?.user_id !== userId) throw new Error("غير مصرّح بإدارة هذه الدورة");
}

export const adminCreateSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        course_id: z.string().uuid(),
        title: z.string().min(1).max(200),
        sort_order: z.number().int().optional(),
        price: z.number().int().min(0).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManageCourse(context.userId, data.course_id);
    const base = {
      course_id: data.course_id,
      title: data.title.trim(),
      sort_order: data.sort_order ?? 0,
    };
    // جرّب مع السعر؛ لو العمود مش موجود في القاعدة ارجع بدون سعر
    let { data: row, error } = await supabaseAdmin
      .from("sections")
      .insert({ ...base, price: data.price ?? 0 } as any)
      .select("id")
      .single();
    if (error && /price|column/i.test(error.message || "")) {
      ({ data: row, error } = await supabaseAdmin.from("sections").insert(base).select("id").single());
    }
    if (error) throw new Error(error.message || "تعذّرت إضافة الوحدة");
    return { ok: true as const, id: row!.id };
  });

export const adminUpdateSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        sort_order: z.number().int().optional(),
        price: z.number().int().min(0).optional(),
        course_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: sec } = await supabaseAdmin.from("sections").select("course_id").eq("id", data.id).maybeSingle();
    if (!sec) throw new Error("الوحدة غير موجودة");
    await assertCanManageCourse(context.userId, sec.course_id);
    const { id, course_id: _c, ...rest } = data;
    let { error } = await supabaseAdmin.from("sections").update(rest as any).eq("id", id);
    if (error && /price|column/i.test(error.message || "")) {
      const { price: _p, ...noPrice } = rest as any;
      ({ error } = await supabaseAdmin.from("sections").update(noPrice).eq("id", id));
    }
    if (error) throw new Error(error.message || "تعذّر تحديث الوحدة");
    return { ok: true as const };
  });
