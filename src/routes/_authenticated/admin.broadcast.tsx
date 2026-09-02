import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Megaphone, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSendAdminBroadcast } from "@/hooks/use-notifications";

export const Route = createFileRoute("/_authenticated/admin/broadcast")({
  component: AdminBroadcast,
});

const TARGETS = [
  { value: "", label: "الجميع" },
  { value: "student", label: "الطلاب" },
  { value: "teacher", label: "المدرّسون" },
  { value: "parent", label: "أولياء الأمور" },
  { value: "montage", label: "فريق المونتاج" },
  { value: "admin", label: "الإدارة" },
];

function AdminBroadcast() {
  const [target, setTarget] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const send = useSendAdminBroadcast();

  const submit = () => {
    if (!title.trim() || !body.trim()) { toast.error("اكتب العنوان والنص."); return; }
    send.mutate(
      { targetRole: target || null, title: title.trim(), body: body.trim() },
      {
        onSuccess: (count) => {
          toast.success(`تم إرسال الإشعار إلى ${count} مستخدم ✅`);
          setTitle(""); setBody("");
        },
        onError: () => toast.error("تعذّر الإرسال."),
      },
    );
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Megaphone className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">إشعار إداري عام</h1>
          <p className="text-sm text-muted-foreground">ابعت تحديث أو إعلان مهم لفئة معيّنة من المستخدمين أو للجميع.</p>
        </div>
      </div>

      <div className="mt-6 max-w-lg space-y-4 rounded-2xl border border-border bg-card p-5">
        <div>
          <Label>الفئة المستهدفة</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {TARGETS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTarget(t.value)}
                className={`rounded-xl px-3 py-1.5 text-sm font-bold transition-colors ${target === t.value ? "bg-gradient-gold text-primary-foreground shadow-gold" : "border border-border hover:bg-accent"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>العنوان</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: صيانة مجدولة الليلة" />
        </div>
        <div>
          <Label>النص</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="تفاصيل الإعلان..." />
        </div>
        <Button onClick={submit} disabled={send.isPending} className="w-full gap-2 bg-gradient-gold text-primary-foreground shadow-gold">
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} إرسال
        </Button>
      </div>
    </div>
  );
}
