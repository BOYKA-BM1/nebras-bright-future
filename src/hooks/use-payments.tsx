import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Database } from "@/integrations/supabase/types";

export type PaymentMethod = Database["public"]["Tables"]["payment_methods"]["Row"];
export type PaymentRequest = Database["public"]["Tables"]["payment_requests"]["Row"];

/* ============ طرق الدفع المتاحة ============ */
export function usePaymentMethods(activeOnly = true) {
  return useQuery({
    queryKey: ["payment-methods", activeOnly],
    queryFn: async (): Promise<PaymentMethod[]> => {
      let query = supabase.from("payment_methods").select("*").order("sort_order", { ascending: true });
      if (activeOnly) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ============ طلبات الدفع الخاصة بالطالب ============ */
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
  return useMutation({
    mutationFn: async (input: {
      courseId: string;
      amount: number;
      method: string;
      senderReference: string;
      couponId?: string | null;
      receipt?: File | null;
    }) => {
      if (!user) throw new Error("not_authenticated");

      let receiptUrl: string | null = null;
      if (input.receipt) {
        const ext = input.receipt.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${input.courseId}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("payment-receipts")
          .upload(path, input.receipt, { upsert: true, contentType: input.receipt.type });
        if (upErr) throw upErr;
        const { data, error: signErr } = await supabase.storage
          .from("payment-receipts")
          .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
        if (signErr) throw signErr;
        receiptUrl = data.signedUrl;
      }

      const { error } = await supabase.from("payment_requests").insert({
        user_id: user.id,
        course_id: input.courseId,
        amount: input.amount,
        method: input.method,
        sender_reference: input.senderReference,
        coupon_id: input.couponId ?? null,
        receipt_url: receiptUrl,
        status: "pending",
      });
      if (error) throw error;
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
