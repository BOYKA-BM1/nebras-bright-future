import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GraduationCap, Library, BookA, ChevronLeft, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { useStages } from "@/hooks/use-catalog";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { gradesByLevel, type Level } from "@/data/grades";
import { Logo } from "@/components/site/Logo";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

const iconMap = { GraduationCap, Library, BookA } as const;

function Onboarding() {
  const navigate = useNavigate();
  const { confirmSignOut } = useAuth();
  const { isAdmin, isTeacher, isLoading: rolesLoading } = useRoles();
  const { data: stages = [], isLoading: stagesLoading } = useStages();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const update = useUpdateProfile();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [stageId, setStageId] = useState<string | null>(null);
  const [level, setLevel] = useState<Level | null>(null);

  // بيانات الحساب
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");


  // تعبئة الاسم المسجّل مسبقًا
  useEffect(() => {
    if (profile?.full_name && !fullName) setFullName(profile.full_name);
  }, [profile?.full_name]);

  // إعادة التوجيه حسب الدور/الحالة
  useEffect(() => {
    if (!rolesLoading && (isAdmin || isTeacher)) {
      navigate({ to: isAdmin ? "/admin" : "/teacher" });
    } else if (!profileLoading && profile?.onboarded) {
      navigate({ to: "/dashboard" });
    }
  }, [rolesLoading, isAdmin, isTeacher, profileLoading, profile, navigate]);

  if (rolesLoading || stagesLoading || profileLoading || isAdmin || isTeacher || profile?.onboarded) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const pickStage = (id: string, lvl: Level) => {
    setStageId(id);
    setLevel(lvl);
    setStep(3);
  };

  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 11);
  const infoValid =
    fullName.trim().split(/\s+/).length >= 2 &&
    phone.length === 11 &&
    parentPhone.length === 11 &&
    whatsapp.length === 11;

  const submitInfo = () => {
    if (!infoValid) {
      toast.error("اكتب اسمك بالكامل وكل رقم لازم يكون 11 رقم بالظبط.");
      return;
    }
    setStep(2);
  };

  const finish = (grade: string) => {
    if (!stageId || !level) return;
    update.mutate(
      {
        stage_id: stageId,
        level,
        grade,
        onboarded: true,
        full_name: fullName.trim(),
        phone: `+20${phone}`,
        parent_phone: `+20${parentPhone}`,
        whatsapp: `+20${whatsapp}`,
      },
      {
        onSuccess: () => { toast.success("تم تجهيز حسابك 🎉"); navigate({ to: "/dashboard" }); },
        onError: () => toast.error("حصل خطأ، حاول تاني."),
      },
    );
  };

  const grades = level ? gradesByLevel[level] : [];

  return (
    <div className="min-h-screen bg-hero">
      <header className="border-b border-border/60 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo />
          <button onClick={() => confirmSignOut(() => navigate({ to: "/" }))} className="text-sm font-bold text-muted-foreground hover:text-foreground">خروج</button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="mx-auto mb-8 flex max-w-md items-center gap-3">
          <StepDot active={step >= 1} done={step > 1} n={1} label="بياناتك" />
          <span className="h-px flex-1 bg-border" />
          <StepDot active={step >= 2} done={step > 2} n={2} label="المرحلة" />
          <span className="h-px flex-1 bg-border" />
          <StepDot active={step >= 3} done={false} n={3} label="السنة الدراسية" />
        </div>

        {step === 1 ? (
          <section className="mx-auto max-w-xl">
            <h1 className="text-center text-2xl font-extrabold sm:text-3xl">اكتب <span className="text-gradient-gold">بياناتك</span></h1>
            <p className="mt-2 text-center text-muted-foreground">محتاجين البيانات دي لتأكيد حسابك والتواصل معاك.</p>
            <div className="mt-8 grid gap-4 rounded-3xl border border-border bg-card p-6 shadow-card">
              <label className="grid gap-2 text-right">
                <span className="text-sm font-bold">الاسم بالكامل</span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: أحمد محمد علي"
                  className="rounded-xl border border-border bg-background px-4 py-3 text-right outline-none focus:border-primary"
                />
              </label>

              <PhoneField label="رقم الهاتف" value={phone} onChange={(v) => setPhone(digits(v))} />
              <PhoneField label="رقم ولي الأمر" value={parentPhone} onChange={(v) => setParentPhone(digits(v))} />
              <PhoneField label="رقم الواتساب" value={whatsapp} onChange={(v) => setWhatsapp(digits(v))} />

              <button
                onClick={submitInfo}
                disabled={!infoValid}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-gold px-6 py-3 font-bold text-primary-foreground shadow-gold disabled:opacity-50"
              >
                التالي: اختيار المرحلة <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </section>
        ) : step === 2 ? (
          <section>
            <button onClick={() => setStep(1)} className="mb-4 text-sm font-bold text-muted-foreground hover:text-foreground">→ رجوع للبيانات</button>
            <h1 className="text-center text-2xl font-extrabold sm:text-3xl">اختر <span className="text-gradient-gold">مرحلتك الدراسية</span></h1>
            <p className="mt-2 text-center text-muted-foreground">هنعرضلك المحتوى الخاص بمرحلتك بس.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {stages.map((s) => {
                const Icon = iconMap[s.icon as keyof typeof iconMap] ?? GraduationCap;
                return (
                  <button
                    key={s.id}
                    onClick={() => pickStage(s.id, s.level as Level)}
                    className="group flex flex-col items-start rounded-3xl border border-border bg-card p-6 text-right shadow-card transition-all hover:-translate-y-1 hover:border-primary/60"
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-gold text-primary-foreground shadow-gold"><Icon className="h-7 w-7" /></span>
                    <h3 className="mt-4 text-xl font-extrabold">{s.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary">اختر <ChevronLeft className="h-4 w-4" /></span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <section>
            <button onClick={() => setStep(2)} className="mb-4 text-sm font-bold text-muted-foreground hover:text-foreground">→ رجوع للمراحل</button>
            <h1 className="text-center text-2xl font-extrabold sm:text-3xl">اختر <span className="text-gradient-gold">سنتك الدراسية</span></h1>
            <p className="mt-2 text-center text-muted-foreground">{stages.find((s) => s.id === stageId)?.name}</p>
            <div className="mx-auto mt-8 grid max-w-xl gap-3">
              {grades.map((g) => (
                <button
                  key={g}
                  disabled={update.isPending}
                  onClick={() => finish(g)}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 text-right font-bold shadow-card transition-all hover:border-primary/60 hover:bg-accent disabled:opacity-60"
                >
                  {g}
                  {update.isPending ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Check className="h-5 w-5 text-primary opacity-0 transition-opacity group-hover:opacity-100" />}
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function PhoneField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const ok = value.length === 11;
  return (
    <label className="grid gap-2 text-right">
      <span className="text-sm font-bold">{label}</span>
      <div className="flex items-center overflow-hidden rounded-xl border border-border bg-background focus-within:border-primary" dir="ltr">
        <span className="select-none border-e border-border bg-secondary px-3 py-3 text-sm font-extrabold text-muted-foreground">+20</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="numeric"
          placeholder="01xxxxxxxxx"
          className="flex-1 bg-transparent px-3 py-3 outline-none"
        />
      </div>
      <span className={`text-xs font-bold ${value.length === 0 ? "text-muted-foreground" : ok ? "text-emerald-500" : "text-destructive"}`}>
        {ok ? "تمام ✓" : `لازم 11 رقم بالظبط (${value.length}/11)`}
      </span>
    </label>
  );
}

function StepDot({ active, done, n, label }: { active: boolean; done: boolean; n: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold ${active ? "bg-gradient-gold text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
        {done ? <Check className="h-4 w-4" /> : n}
      </span>
      <span className={`text-sm font-bold ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );
}
