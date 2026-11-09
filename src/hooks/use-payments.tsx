import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { auditEvent } from "@/lib/audit";
import { useServerFn } from "@tanstack/react-start";
import { createManualPaymentRequest } from "@/lib/payment.functions";
import type { Database } from "@/integrations/supabase/types";

export type PaymentMethod = Database["public"]["Tables"]["payment_methods"]["Row"];
export type PaymentRequest = Database["public"]["Tables"]["payment_requests"]["Row"];

/* ============ طرق الدفع المتاحة ============ */
function isMethodReady(m: PaymentMethod): boolean {
  if (!m.is_active) return false;
  const num = (m.number ?? "").trim();
  const instr = (m.instructions ?? "").trim();
  return num.length >= 3 || instr.length >= 8;
}

/** activeOnly=true ⇒ مفعّلة ومكتملة الإعداد فقط (لا placeholders) */
export function usePaymentMethods(activeOnly = true) {
  return useQuery({
    queryKey: ["payment-methods", activeOnly],
    queryFn: async (): Promise<PaymentMethod[]> => {
      let query = supabase.from("payment_methods").select("*").order("sort_order", { ascending: true });
      if (activeOnly) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw error;
      const rows = data ?? [];
      return activeOnly ? rows.filter(isMethodReady) : rows;
    },
  });
}

/* ============ طلبات الدفع الخاصة بالطالب ============ */

const DEFAULT_PAYMENT_METHODS = [
  { key: "instapay", label: "InstaPay", sort_order: 1 },
  { key: "vodafone_cash", label: "فودافون كاش", sort_order: 2 },
  { key: "etisalat_cash", label: "اتصالات كاش", sort_order: 3 },
  { key: "fawry", label: "فوري", sort_order: 4 },
] as const;

/** يضمن وجود الطرق الأربع في لوحة الإدارة (بدون تفعيل حتى تُضبط الأرقام) */
export function useEnsurePaymentMethods() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { adminEnsurePaymentMethods } = await import("@/lib/catalog-admin.functions");
      // تُستدعى من الصفحة كـ server fn عبر dynamic path أدناه في المكوّن إن لزم
      const { data: existing } = await supabase.from("payment_methods").select("key");
      const keys = new Set((existing ?? []).map((r: any) => r.key));
      const missing = DEFAULT_PAYMENT_METHODS.filter((m) => !keys.has(m.key));
      if (!missing.length) {
        // حتى لو موجود، تأكد من ظهور InstaPay في الواجهة بإعادة الجلب
        return;
      }
      // محاولة إدراج من العميل؛ إن فشل RLS يبقى مسار السيرفر في الصفحة
      const { error } = await supabase.from("payment_methods").insert(
        missing.map((m) => ({
          key: m.key,
          label: m.label,
          sort_order: m.sort_order,
          is_active: m.key === "instapay",
          number: null,
          instructions: m.key === "instapay" ? "حوّل عبر InstaPay ثم ارفق الإيصال." : null,
        })),
      );
      if (error && !/duplicate|unique/i.test(error.message || "")) {
        // لا نرمي هنا — الصفحة هتستدعي server fn
        console.warn("ensure methods client insert failed", error.message);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payment-methods"] });
      void qc.refetchQueries({ queryKey: ["payment-methods"] });
    },
  });
}

export function useMyPaymentRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-payment-requests", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<PaymentRequest[]> => {
      const { data, error } = await supabase
        .from("payment_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ============ إرسال طلب دفع يدوي ============ */
export function useSubmitPaymentRequest() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const createReq = useServerFn(createManualPaymentRequest);
  return useMutation({
    mutationFn: async (input: {
      courseId: string;
      amount: number; // ignored server-side; kept for call-site compatibility
      method: string;
      senderReference: string;
      couponId?: string | null;
      receipt?: File | null;
    }) => {
      if (!user) throw new Error("not_authenticated");

      let receiptPath: string | null = null;
      if (input.receipt) {
        const ext = input.receipt.name.split(".").pop()?.toLowerCase() || "jpg";
        if (!["jpg", "jpeg", "png", "webp", "pdf"].includes(ext)) {
          throw new Error("نوع ملف الإيصال غير مدعوم.");
        }
        if (input.receipt.size > 5 * 1024 * 1024) {
          throw new Error("حجم الإيصال كبير (الحد 5 ميجا).");
        }
        const path = `${user.id}/${input.courseId}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("payment-receipts")
          .upload(path, input.receipt, { upsert: true, contentType: input.receipt.type });
        if (upErr) throw upErr;
        receiptPath = path;
      }

      const result = await createReq({
        data: {
          courseId: input.courseId,
          methodKey: input.method,
          senderReference: input.senderReference,
          couponCode: null,
          receiptPath,
        },
      });
      auditEvent("course_purchase_request", "course", {
        courseId: input.courseId,
        amount: result.amount,
        method: input.method,
      });
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-payment-requests"] }),
  });
}

/* ============ إدارة (أدمن) ============ */
export type AdminPaymentRequest = PaymentRequest & {
  courses?: { title: string | null } | null;
  profiles?: { full_name: string | null; phone: string | null } | null;
};

export function useAllPaymentRequests() {
  return useQuery({
    queryKey: ["admin-payment-requests"],
    queryFn: async (): Promise<AdminPaymentRequest[]> => {
      const { data, error } = await supabase
        .from("payment_requests")
        .select("*, courses(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as AdminPaymentRequest[];
      // اجلب أسماء الطلاب
      const ids = [...new Set(rows.map((r) => r.user_id))];
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("id", ids);
        const map = new Map((profs ?? []).map((p) => [p.id, p]));
        for (const r of rows) {
          const p = map.get(r.user_id);
          r.profiles = p ? { full_name: p.full_name, phone: p.phone } : null;
        }
      }
      return rows;
    },
  });
}

export function useReviewPaymentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; approve: boolean; note?: string | null }) => {
      const { error } = await supabase.rpc("review_payment_request", {
        _id: input.id,
        _approve: input.approve,
        _note: input.note ?? undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payment-requests"] });
      qc.invalidateQueries({ queryKey: ["enrollments"] });
    },
  });
}

export function useUpdatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; number?: string; instructions?: string; is_active?: boolean }) => {
      const { id, ...rest } = input;
      const { error } = await supabase
        .from("payment_methods")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment-methods"] }),
  });
}
