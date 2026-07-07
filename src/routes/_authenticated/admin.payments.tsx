import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Check, X, Wallet, Save, ExternalLink, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  useAllPaymentRequests,
  useReviewPaymentRequest,
  usePaymentMethods,
  useUpdatePaymentMethod,
  type PaymentMethod,
} from "@/hooks/use-payments";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: AdminPaymentsPage,
});

const METHOD_LABEL: Record<string, string> = {
  vodafone_cash: "فودافون كاش",
  etisalat_cash: "اتصالات كاش",
  fawry: "فوري",
  manual: "يدوي",
};

const STATUS_META: Record<string, { text: string; cls: string }> = {
  pending: { text: "قيد المراجعة", cls: "bg-amber-500/15 text-amber-500" },
  approved: { text: "مقبول", cls: "bg-green-500/15 text-green-500" },
  rejected: { text: "مرفوض", cls: "bg-destructive/15 text-destructive" },
};

function AdminPaymentsPage() {
  const { data: requests = [], isLoading } = useAllPaymentRequests();
  const review = useReviewPaymentRequest();
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const shown = filter === "pending" ? requests.filter((r) => r.status === "pending") : requests;

  const handleReview = (id: string, approve: boolean) => {
    if (!approve && !confirm("رفض طلب الدفع ده؟")) return;
    review.mutate(
      { id, approve },
      {
        onSuccess: () => toast.success(approve ? "تم قبول الدفع وتفعيل الاشتراك ✅" : "تم رفض الطلب."),
        onError: () => toast.error("تعذّر تنفيذ العملية."),
      },
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold sm:text-3xl">
        الدفع <span className="text-gradient-gold">والاشتراكات</span>
      </h1>
      <p className="mt-2 text-muted-foreground">راجع طلبات الدفع اليدوي وفعّل اشتراكات الطلاب.</p>

      {/* طرق الدفع */}
      <PaymentMethodsEditor />

      {/* طلبات الدفع */}
      <div className="mt-10 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-extrabold">
          <Clock className="h-5 w-5 text-primary" /> طلبات الدفع
        </h2>
        <div className="flex gap-2">
          {(["pending", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                filter === f ? "bg-gradient-gold text-primary-foreground shadow-gold" : "border border-border hover:bg-accent"
              }`}
            >
              {f === "pending" ? "قيد المراجعة" : "الكل"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : shown.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">لا توجد طلبات دفع {filter === "pending" ? "قيد المراجعة" : ""}.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {shown.map((r) => {
            const st = STATUS_META[r.status] ?? STATUS_META.pending;
            return (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{r.profiles?.full_name ?? "طالب"}</p>
                    <p className="text-xs text-muted-foreground">{r.profiles?.phone ?? "—"}</p>
                    <p className="mt-1 text-sm">
                      الدورة: <span className="font-semibold">{r.courses?.title ?? "—"}</span>
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}>{st.text}</span>
                </div>

                <div className="mt-3 grid gap-2 rounded-xl bg-background/50 p-3 text-sm sm:grid-cols-2">
                  <div><span className="text-muted-foreground">المبلغ: </span><span className="font-bold text-gradient-gold">{r.amount} ج.م</span></div>
                  <div><span className="text-muted-foreground">الطريقة: </span><span className="font-semibold">{METHOD_LABEL[r.method] ?? r.method}</span></div>
                  <div className="sm:col-span-2"><span className="text-muted-foreground">رقم/عملية التحويل: </span><span className="font-mono font-semibold" dir="ltr">{r.sender_reference}</span></div>
                  <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-EG")}</div>
                  {r.receipt_url && (
                    <a href={r.receipt_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                      <ExternalLink className="h-3.5 w-3.5" /> عرض الإيصال
                    </a>
                  )}
                </div>

                {r.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleReview(r.id, true)}
                      disabled={review.isPending}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-gold px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-gold disabled:opacity-70"
                    >
                      <Check className="h-4 w-4" /> قبول وتفعيل
                    </button>
                    <button
                      onClick={() => handleReview(r.id, false)}
                      disabled={review.isPending}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-destructive/40 px-4 py-2.5 text-sm font-bold text-destructive hover:bg-destructive/10 disabled:opacity-70"
                    >
                      <X className="h-4 w-4" /> رفض
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PaymentMethodsEditor() {
  const { data: methods = [], isLoading } = usePaymentMethods(false);

  return (
    <section className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <Wallet className="h-5 w-5 text-primary" /> أرقام طرق الدفع
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">حدّث أرقام المحافظ وكود فوري اللي هيدفع عليها الطلاب.</p>

      {isLoading ? (
        <div className="mt-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {methods.map((m) => <MethodCard key={m.id} method={m} />)}
        </div>
      )}
    </section>
  );
}

function MethodCard({ method }: { method: PaymentMethod }) {
  const update = useUpdatePaymentMethod();
  const [number, setNumber] = useState(method.number ?? "");
  const [instructions, setInstructions] = useState(method.instructions ?? "");
  const [active, setActive] = useState(method.is_active);

  const dirty = number !== (method.number ?? "") || instructions !== (method.instructions ?? "") || active !== method.is_active;

  const save = () => {
    update.mutate(
      { id: method.id, number, instructions, is_active: active },
      { onSuccess: () => toast.success(`تم تحديث ${method.label} ✅`), onError: () => toast.error("تعذّر الحفظ.") },
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="font-bold">{method.label}</p>
        <label className="flex items-center gap-1.5 text-xs font-bold">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-primary" />
          مفعّل
        </label>
      </div>
      <input
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder="الرقم / الكود"
        dir="ltr"
        className="mt-3 w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <textarea
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        rows={2}
        placeholder="تعليمات الدفع"
        className="mt-2 w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-xs outline-none focus:border-primary"
      />
      <button
        onClick={save}
        disabled={!dirty || update.isPending}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-gold px-4 py-2 text-sm font-bold text-primary-foreground shadow-gold disabled:opacity-50"
      >
        {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ
      </button>
    </div>
  );
}
