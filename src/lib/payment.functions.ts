import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { writeAudit, getClientIp, getUserAgent } from "@/lib/security.server";

function isMethodReady(m: { is_active: boolean; number: string | null; instructions: string | null }) {
  if (!m.is_active) return false;
  const num = (m.number ?? "").trim();
  const instr = (m.instructions ?? "").trim();
  return num.length >= 3 || instr.length >= 8;
}

/**
 * إنشاء طلب دفع يدوي — السعر من قاعدة البيانات فقط.
 * لا يثق في amount من العميل.
 */
export const createManualPaymentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        courseId: z.string().uuid(),
        methodKey: z.string().min(1).max(40),
        senderReference: z.string().min(2).max(120),
        couponCode: z.string().max(40).optional().nullable(),
        receiptPath: z.string().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const uid = context.userId;

    const { data: course, error: cErr } = await supabaseAdmin
      .from("courses")
      .select("id, title, price, is_published")
      .eq("id", data.courseId)
      .maybeSingle();
    if (cErr || !course) throw new Error("الدورة غير موجودة.");
    if (course.is_published === false) throw new Error("الدورة غير متاحة.");

    const { data: method, error: mErr } = await supabaseAdmin
      .from("payment_methods")
      .select("*")
      .eq("key", data.methodKey)
      .maybeSingle();
    if (mErr || !method || !isMethodReady(method)) {
      throw new Error("وسيلة الدفع غير مفعّلة أو غير مضبوطة.");
    }

    // Already enrolled?
    const { data: existingEnr } = await supabaseAdmin
      .from("enrollments")
      .select("id")
      .eq("user_id", uid)
      .eq("course_id", data.courseId)
      .eq("status", "active")
      .limit(1);
    if ((existingEnr ?? []).length > 0) throw new Error("أنت مشترك بالفعل في هذه الدورة.");

    // Pending duplicate?
    const { data: pending } = await supabaseAdmin
      .from("payment_requests")
      .select("id")
      .eq("user_id", uid)
      .eq("course_id", data.courseId)
      .eq("status", "pending")
      .limit(1);
    if ((pending ?? []).length > 0) throw new Error("لديك طلب قيد المراجعة لنفس الدورة.");

    let amount = Number(course.price) || 0;
    let couponId: string | null = null;
    if (data.couponCode?.trim()) {
      const code = data.couponCode.trim();
      const { data: coupon } = await supabaseAdmin
        .from("coupons")
        .select("*")
        .eq("code", code)
        .eq("is_active", true)
        .maybeSingle();
      if (coupon) {
        const now = Date.now();
        const exp = coupon.expires_at ? new Date(coupon.expires_at).getTime() : null;
        if ((!exp || exp > now) && (coupon.max_uses == null || coupon.used_count < coupon.max_uses)) {
          if (coupon.discount_percent) amount = amount * (1 - Number(coupon.discount_percent) / 100);
          if (coupon.discount_amount) amount = Math.max(0, amount - Number(coupon.discount_amount));
          couponId = coupon.id;
        }
      }
    }
    amount = Math.round(amount * 100) / 100;

    const { data: row, error } = await supabaseAdmin
      .from("payment_requests")
      .insert({
        user_id: uid,
        course_id: data.courseId,
        amount,
        method: data.methodKey,
        sender_reference: data.senderReference.trim(),
        coupon_id: couponId,
        receipt_url: data.receiptPath ?? null,
        status: "pending",
      })
      .select("id, amount, status")
      .limit(1);

    if (error) throw new Error("تعذّر إنشاء طلب الدفع.");

    await writeAudit({
      userId: uid,
      action: "payment_request_created",
      entity: data.courseId,
      metadata: { method: data.methodKey, amount, requestId: row?.[0]?.id },
      ip: getClientIp(),
      userAgent: getUserAgent(),
    });

    return { id: row?.[0]?.id as string, amount, status: "pending" as const };
  });
