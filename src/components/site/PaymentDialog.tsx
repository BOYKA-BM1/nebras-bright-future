import { useState } from "react";
import { X, Loader2, Copy, Check, Upload, Wallet } from "lucide-react";
import { toast } from "sonner";
import { usePaymentMethods, useSubmitPaymentRequest } from "@/hooks/use-payments";

type Props = {
  courseId: string;
  courseTitle: string;
  amount: number;
  couponId?: string | null;
  onClose: () => void;
  onSubmitted: () => void;
};

export function PaymentDialog({ courseId, courseTitle, amount, couponId, onClose, onSubmitted }: Props) {
  const { data: methods = [], isLoading } = usePaymentMethods();
  const submit = useSubmitPaymentRequest();
  const [selected, setSelected] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);

  const method = methods.find((m) => m.key === selected) ?? null;

  const copyNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSubmit = () => {
    if (!method) {
      toast.error("اختر طريقة الدفع الأول.");
      return;
    }
    if (reference.trim().length < 4) {
      toast.error("اكتب رقم التحويل أو رقم العملية.");
      return;
    }
    submit.mutate(
      {
        courseId,
        amount,
        method: method.key,
        senderReference: reference.trim(),
        couponId: couponId ?? null,
        receipt,
      },
      {
        onSuccess: () => {
          toast.success("تم استلام طلب الدفع! هيتم مراجعته وتفعيل اشتراكك قريبًا ✅");
          onSubmitted();
        },
        onError: () => toast.error("تعذّر إرسال الطلب، حاول تاني."),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-extrabold">إتمام الدفع</h2>
              <p className="text-xs text-muted-foreground line-clamp-1">{courseTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-5 flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3">
            <span className="text-sm font-bold">المبلغ المطلوب</span>
            <span className="text-xl font-extrabold text-gradient-gold">{amount} ج.م</span>
          </div>

          <p className="text-sm font-bold">اختر طريقة الدفع</p>
          {isLoading ? (
            <div className="mt-4 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="mt-3 grid gap-2">
              {methods.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelected(m.key)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-right text-sm font-bold transition-colors ${
                    selected === m.key ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
                  }`}
                >
                  <span>{m.label}</span>
                  {selected === m.key && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          )}

          {method && (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-border bg-background/50 p-4">
                <p className="text-xs text-muted-foreground">{method.instructions}</p>
                {method.number && (
                  <button
                    onClick={() => copyNumber(method.number!)}
                    className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg bg-primary/10 px-4 py-2.5 font-mono text-base font-extrabold text-primary hover:bg-primary/20"
                    dir="ltr"
                  >
                    <span>{method.number}</span>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                )}
              </div>

              <div>
                <label className="text-sm font-bold">رقم التحويل / رقم العملية</label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={method.key === "fawry" ? "رقم عملية فوري" : "الرقم اللي حوّلت منه"}
                  className="mt-2 w-full rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-sm font-bold">صورة إيصال التحويل (اختياري)</label>
                <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-background/40 px-4 py-3 text-sm text-muted-foreground hover:bg-accent">
                  <Upload className="h-4 w-4" />
                  {receipt ? receipt.name : "ارفع صورة الإيصال"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <button
                onClick={handleSubmit}
                disabled={submit.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3 text-sm font-bold text-primary-foreground shadow-gold disabled:opacity-70"
              >
                {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                تأكيد الدفع وإرسال الطلب
              </button>
              <p className="text-center text-xs text-muted-foreground">
                هيتم مراجعة الدفع وتفعيل اشتراكك من الإدارة خلال وقت قصير.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
