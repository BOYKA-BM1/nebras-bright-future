import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Loader2, Users, LogOut, LinkIcon, BookOpen, CheckCircle2, ClipboardList, UserPlus, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/site/Logo";
import { NotificationBell } from "@/components/site/NotificationBell";
import { useAuth } from "@/hooks/use-auth";
import { useMyChildren, useLinkChild, useChildProgress, type LinkedChild } from "@/hooks/use-parent";
import { useChildEducationProfile, useEducationSystems, useBaccalaureateTracks } from "@/hooks/use-baccalaureate";

export const Route = createFileRoute("/_authenticated/parent")({
  component: ParentDashboard,
});

function ParentDashboard() {
  const { confirmSignOut } = useAuth();
  const navigate = useNavigate();
  const { data: children = [], isLoading } = useMyChildren();
  const [activeChild, setActiveChild] = useState<LinkedChild | null>(null);

  const handleSignOut = () => confirmSignOut(() => navigate({ to: "/" }));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Link to="/calendar" className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent">
              <CalendarDays className="h-4 w-4" /> <span className="hidden sm:inline">المواعيد</span>
            </Link>
            <button onClick={handleSignOut} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">لوحة ولي الأمر</h1>
            <p className="text-sm text-muted-foreground">تابع تقدّم أبنائك في الدروس والاختبارات.</p>
          </div>
        </div>

        <LinkChildCard />

        {isLoading ? (
          <div className="mt-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : children.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">
            لسه معندكش أبناء مرتبطين. استخدم الكود اللي هيديهولك ابنك من صفحة البروفايل بتاعته.
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {children.map((c) => (
              <button
                key={c.linkId}
                onClick={() => setActiveChild(c)}
                className={`rounded-2xl border p-5 text-right shadow-card transition-colors ${
                  activeChild?.linkId === c.linkId ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent"
                }`}
              >
                <p className="font-extrabold">{c.fullName}</p>
                {c.grade && <p className="mt-1 text-xs text-muted-foreground">{c.grade}</p>}
              </button>
            ))}
          </div>
        )}

        {activeChild && <ChildProgressPanel child={activeChild} />}
      </main>
    </div>
  );
}

function LinkChildCard() {
  const [code, setCode] = useState("");
  const link = useLinkChild();

  const submit = () => {
    if (code.trim().length < 4) { toast.error("اكتب الكود اللي شاركه معاك ابنك."); return; }
    link.mutate(code.trim(), {
      onSuccess: () => { toast.success("تم ربط الحساب بنجاح ✅"); setCode(""); },
      onError: (err) => toast.error(err instanceof Error ? err.message : "الكود غير صحيح."),
    });
  };

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-5">
      <UserPlus className="h-5 w-5 shrink-0 text-primary" />
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="أدخل كود ابنك هنا"
          dir="ltr"
          className="min-w-[160px] flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-bold tracking-widest outline-none focus:border-primary"
        />
        <button
          onClick={submit}
          disabled={link.isPending}
          className="flex items-center gap-2 rounded-xl bg-gradient-gold px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-gold disabled:opacity-60"
        >
          {link.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />} ربط
        </button>
      </div>
    </div>
  );
}

function ChildProgressPanel({ child }: { child: LinkedChild }) {
  const { data, isLoading } = useChildProgress(child.studentId);
  const { data: eduProfile } = useChildEducationProfile(child.studentId);
  const { data: systems = [] } = useEducationSystems();
  const { data: tracks = [] } = useBaccalaureateTracks();

  if (isLoading) return <div className="mt-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const system = systems.find((s) => s.id === eduProfile?.education_system_id);
  const track = tracks.find((t) => t.id === eduProfile?.track_id);

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <BookOpen className="h-5 w-5 text-primary" /> تقدّم {child.fullName}
      </h2>

      {eduProfile && (
        <div className="mt-3 flex flex-wrap gap-4 rounded-xl border border-border/60 bg-card px-4 py-3 text-sm">
          <span><span className="text-muted-foreground">النظام: </span><span className="font-bold">{system?.name_ar}</span></span>
          <span><span className="text-muted-foreground">الصف: </span><span className="font-bold">{eduProfile.grade}</span></span>
          {track && <span><span className="text-muted-foreground">المسار: </span><span className="font-bold">{track.name_ar}</span></span>}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {(data?.courses.length ?? 0) === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">لا يوجد اشتراكات نشطة بعد.</p>
        ) : (
          data!.courses.map((c) => {
            const inactive7Days = !c.lastActiveAt || Date.now() - new Date(c.lastActiveAt).getTime() > 7 * 24 * 60 * 60 * 1000;
            return (
              <div key={c.courseId} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
                <div>
                  <span className="font-bold">{c.title}</span>
                  <p className={`mt-0.5 text-[11px] ${inactive7Days ? "text-destructive" : "text-muted-foreground"}`}>
                    {c.lastActiveAt ? `آخر نشاط: ${new Date(c.lastActiveAt).toLocaleDateString("ar-EG")}` : "لم يبدأ المشاهدة بعد"}
                    {inactive7Days && c.lastActiveAt ? " (أكتر من أسبوع)" : ""}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {c.completed} / {c.lessonsTracked} درس مكتمل
                </span>
              </div>
            );
          })
        )}
      </div>

      <h3 className="mt-6 flex items-center gap-2 text-base font-extrabold">
        <ClipboardList className="h-4 w-4 text-primary" /> آخر نتائج الاختبارات
      </h3>
      <div className="mt-3 space-y-2">
        {(data?.examAttempts.length ?? 0) === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">لا توجد نتائج اختبارات بعد.</p>
        ) : (
          data!.examAttempts.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
              <span className="font-bold">{a.quizTitle}</span>
              <span className="text-sm font-extrabold text-primary">{a.score} / {a.total}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
