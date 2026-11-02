import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, GraduationCap, Send, CheckCircle2, XCircle, Clock, Phone, MessageCircle, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import {
  useMyTeacherApplication,
  useSubmitTeacherApplication,
} from "@/hooks/use-teacher-apply";

export const Route = createFileRoute("/_authenticated/teacher-apply")({
  component: TeacherApplyPage,
});

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 11);

function TeacherApplyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isLoading: rolesLoading, isAdmin } = useRoles();
  const { data: app, isLoading: appLoading } = useMyTeacherApplication();
  const submit = useSubmitTeacherApplication();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [subject, setSubject] = useState("");
  const [bio, setBio] = useState("");

  // الطلب اتقبّل — لوحة المدرّس متاحة، يدخل عليها على طول
  useEffect(() => {
    if (app?.status === "approved" && !rolesLoading) {
      navigate({ to: isAdmin ? "/admin" : "/teacher" });
    }
  }, [app?.status, rolesLoading, isAdmin, navigate]);

  const handleSubmit = () => {
    if (!fullName.trim()) return toast.error("اكتب اسمك بالكامل.");
    if (phone.length !== 11) return toast.error("رقم الهاتف لازم يكون 11 رقم بالظبط.");
    if (whatsapp.length !== 11) return toast.error("رقم الواتس لازم يكون 11 رقم بالظبط.");
    if (!subject.trim()) return toast.error("اكتب اسم المادة اللي بتدرّسها.");
    if (bio.trim().length < 20) return toast.error("اكتب نبذة عنك (20 حرف على الأقل).");

    submit.mutate(
      {
        full_name: fullName.trim(),
        phone: `+20${phone}`,
        whatsapp: `+20${whatsapp}`,
        subject: subject.trim(),
        bio: bio.trim(),
      },
      {
        onSuccess: () => toast.success("تم إرسال طلبك ✅ هيت راجع من الإدارة قريب."),
        onError: () => toast.error("تعذّر إرسال الطلب، حاول تاني."),
      },
    );
  };

  if (!user || rolesLoading || appLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // طلب قيد المراجعة
  if (app?.status === "pending") {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-card">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
            <Clock className="h-8 w-8" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold">طلبك قيد المراجعة</h1>
          <p className="mt-2 text-muted-foreground">
            استلمنا طلب تقديمك كمدرّس يا {app.full_name}. هيت راجع من إدارة المنصة، وهيوصلك إشعار بالنتيجة على حسابك.
          </p>
          <div className="mt-6 space-y-2 text-right text-sm">
            <Row icon={GraduationCap} label="الاسم" value={app.full_name} />
            <Row icon={BookOpen} label="المادة" value={app.subject} />
            <Row icon={Phone} label="الهاتف" value={app.phone} />
            <Row icon={MessageCircle} label="الواتس" value={app.whatsapp ?? "—"} />
          </div>
        </div>
      </div>
    );
  }

  // الطلب اترفض — يقدر يعدّل ويعيد التقديم
  if (app?.status === "rejected") {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-card">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
            <XCircle className="h-8 w-8" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold">تم رفض الطلب</h1>
          <p className="mt-2 text-muted-foreground">
            {app.review_notes || "للأسف تم رفض طلب تقديمك. يمكنك التواصل مع خدمة العملاء لمعرفة التفاصيل."}
          </p>
        </div>
      </div>
    );
  }

  // مفيش طلب — نموذج التقديم
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-gold text-primary-foreground shadow-gold">
          <GraduationCap className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">تقديم كـ<span className="text-gradient-gold">مدرّس</span></h1>
          <p className="text-sm text-muted-foreground">كمّل بياناتك وهتوصلك مراجعة من الإدارة.</p>
        </div>
      </div>

      <div className="mt-8 space-y-5 rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
        <Field label="الاسم بالكامل">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="اسمك الكامل"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
        </Field>

        <PhoneField label="رقم الهاتف" value={phone} onChange={setPhone} />
        <PhoneField label="رقم الواتس" value={whatsapp} onChange={setWhatsapp} />

        <Field label="المادة اللي بتدرّسها">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="مثال: رياضيات — الصف الأول الثانوي"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
        </Field>

        <Field label="نبذة عنك وخبرتك">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="اكتب نبذة مختصرة عن خبرتك وطريقة تدريسك…"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
        </Field>

        <button
          onClick={handleSubmit}
          disabled={submit.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-6 py-3 text-sm font-extrabold text-primary-foreground shadow-gold disabled:opacity-60"
        >
          {submit.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          إرسال طلب التقديم
        </button>
        <p className="text-center text-xs text-muted-foreground">
          بعد الموافقة هتفتحلك لوحة المدرّس وتبقى تقدر تضيف كورساتك.
        </p>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2">
      <span className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /> {label}</span>
      <span className="font-extrabold" dir="ltr">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold">{label}</span>
      {children}
    </label>
  );
}

function PhoneField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={`${label} (11 رقم)`}>
      <div className="flex overflow-hidden rounded-xl border border-border bg-background focus-within:border-primary" dir="ltr">
        <span className="select-none border-e border-border bg-secondary px-3 py-3 text-sm font-extrabold text-muted-foreground">+20</span>
        <input
          value={value}
          onChange={(e) => onChange(digits(e.target.value))}
          inputMode="numeric"
          placeholder="1XXXXXXXXX"
          className="w-full bg-transparent px-4 py-3 text-sm outline-none"
        />
      </div>
    </Field>
  );
}
