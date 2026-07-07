import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Loader2, LogOut, BookOpen, Wallet, PlayCircle, ShieldCheck, GraduationCap, ArrowLeft, Heart, UserCog, AlertCircle, MessageCircle, Send, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { useCourses } from "@/hooks/use-catalog";
import { useMyEnrollments, useFavorites, useUnenroll } from "@/hooks/use-content";
import { useMyTickets, useCreateTicket } from "@/hooks/use-staff";
import { useProfile, profileCompletion } from "@/hooks/use-profile";
import { Logo } from "@/components/site/Logo";
import { GamificationPanel } from "@/components/site/GamificationPanel";
import { resolveImage } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user, confirmSignOut } = useAuth();
  const navigate = useNavigate();
  const { isAdmin, isTeacher, isMontage, isCustomerService, isSecretary, isLoading: rolesLoading } = useRoles();
  const { data: courses = [] } = useCourses();
  const { data: enrollments = [], isLoading } = useMyEnrollments();
  const { favoriteIds } = useFavorites();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const unenroll = useUnenroll();

  const handleUnenroll = (courseId: string, title: string) => {
    if (!window.confirm(`متأكد إنك عايز تلغي اشتراكك في "${title}"؟`)) return;
    unenroll.mutate(courseId, {
      onSuccess: () => toast.success("تم إلغاء الاشتراك."),
      onError: () => toast.error("تعذّر إلغاء الاشتراك، حاول تاني."),
    });
  };

  // الأدمن يروح لوحة الإدارة مباشرة، والمدرّس للوحته، والطاقم للوحاتهم
  useEffect(() => {
    if (rolesLoading) return;
    if (isAdmin) { navigate({ to: "/admin" }); return; }
    if (isTeacher) { navigate({ to: "/teacher" }); return; }
    if (isMontage) { navigate({ to: "/staff/montage" }); return; }
    if (isCustomerService) { navigate({ to: "/staff/support" }); return; }
    if (isSecretary) { navigate({ to: "/staff/students" }); return; }
  }, [rolesLoading, isTeacher, isAdmin, isMontage, isCustomerService, isSecretary, navigate]);

  const isStaffRole = isTeacher || isMontage || isCustomerService || isSecretary;

  // الطالب اللي لسه ما اختارش مرحلته يروح للأونبوردنج
  useEffect(() => {
    if (!rolesLoading && !isAdmin && !isStaffRole && !profileLoading && profile && !profile.onboarded) {
      navigate({ to: "/onboarding" });
    }
  }, [rolesLoading, isAdmin, isStaffRole, profileLoading, profile, navigate]);

  const completion = profileCompletion(profile);

  const name =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "طالبنا العزيز";

  const myCourses = useMemo(
    () => enrollments.map((e) => courses.find((c) => c.id === e.course_id)).filter(Boolean) as typeof courses,
    [enrollments, courses],
  );
  const totalSpent = useMemo(() => myCourses.reduce((s, c) => s + (c.price || 0), 0), [myCourses]);

  const handleSignOut = () => { confirmSignOut(() => navigate({ to: "/" })); };


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo />
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <Link to="/admin" className="flex items-center gap-1.5 rounded-xl bg-gradient-gold px-4 py-2 text-sm font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.03]">
                <ShieldCheck className="h-4 w-4" /> الإدارة
              </Link>
            )}
            {(isTeacher || isAdmin) && (
              <Link to="/teacher" className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-accent">
                <GraduationCap className="h-4 w-4" /> المدرّس
              </Link>
            )}
            <Link to="/profile" className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-accent">
              <UserCog className="h-4 w-4" /> <span className="hidden sm:inline">ملفي</span>
            </Link>
            <Link to="/courses" className="rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-accent">الدورات</Link>
            <button onClick={handleSignOut} className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-bold hover:bg-accent">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-extrabold">أهلًا، <span className="text-gradient-gold">{name}</span> 👋</h1>
        <p className="mt-2 text-muted-foreground">دي لوحة التحكم بتاعتك — كمّل تعلّمك من هنا.</p>

        {!completion.complete && (
          <Link to="/profile" className="mt-6 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 transition-colors hover:bg-primary/15">
            <AlertCircle className="h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="font-bold">أكمل ملفك الشخصي ({completion.percent}%)</p>
              <p className="text-sm text-muted-foreground">لازم تكمّل بياناتك علشان تقدر تحجز وتشترك في الدورات.</p>
            </div>
            <ArrowLeft className="h-4 w-4 text-primary" />
          </Link>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard icon={BookOpen} label="دوراتي" value={String(myCourses.length)} />
          <StatCard icon={Wallet} label="إجمالي القيمة" value={`${totalSpent} ج.م`} />
          <StatCard icon={Heart} label="المفضّلة" value={String(favoriteIds.size)} />
        </div>

        <h2 className="mt-12 text-xl font-extrabold">إنجازاتي ونقاطي</h2>
        <div className="mt-4">
          <GamificationPanel courses={myCourses.length} />
        </div>

        <h2 className="mt-12 text-xl font-extrabold">دوراتي</h2>

        {isLoading ? (
          <div className="mt-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : myCourses.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <p className="text-muted-foreground">لسه ما اشتركتش في أي دورة.</p>
            <Link to="/" hash="courses" className="mt-4 inline-block rounded-xl bg-gradient-gold px-6 py-3 text-sm font-bold text-primary-foreground shadow-gold">تصفّح الدورات</Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myCourses.map((c) => {
              const img = resolveImage(c.image_url) ?? resolveImage(c.teacher?.image_url);
              return (
                <article key={c.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                  {img ? <img src={img} alt={c.title} className="h-32 w-full object-cover" /> : <div className="flex h-32 items-center justify-center bg-gradient-to-br from-primary/15 to-transparent"><BookOpen className="h-8 w-8 text-primary/50" /></div>}
                  <div className="p-4">
                    <h3 className="font-bold leading-snug line-clamp-2">{c.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{c.teacher?.name}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <PlayCircle className="h-3.5 w-3.5 text-primary" /> {c.lessons_count} درس
                    </div>
                    <Link to="/learn/$courseId" params={{ courseId: c.id }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-2 text-sm font-bold text-primary-foreground shadow-gold">
                      <ArrowLeft className="h-4 w-4" /> كمّل التعلّم
                    </Link>
                    <button
                      onClick={() => handleUnenroll(c.id, c.title)}
                      disabled={unenroll.isPending}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 px-4 py-2 text-sm font-bold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-70"
                    >
                      <XCircle className="h-4 w-4" /> إلغاء الاشتراك
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <SupportSection />
      </main>
    </div>
  );
}

function SupportSection() {
  const { data: tickets = [] } = useMyTickets();
  const createTicket = useCreateTicket();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const submit = () => {
    if (!subject.trim() || !message.trim()) { toast.error("اكتب الموضوع والرسالة."); return; }
    createTicket.mutate(
      { subject: subject.trim(), message: message.trim() },
      { onSuccess: () => { toast.success("تم إرسال استفسارك، هيتم الرد عليك قريبًا ✅"); setSubject(""); setMessage(""); }, onError: () => toast.error("تعذّر الإرسال.") },
    );
  };

  return (
    <section className="mt-12">
      <h2 className="flex items-center gap-2 text-xl font-extrabold"><MessageCircle className="h-5 w-5 text-primary" /> الدعم والاستفسارات</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm font-bold">أرسل استفسار جديد</p>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="الموضوع"
            className="mt-3 w-full rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="اكتب استفسارك هنا..."
            rows={3}
            className="mt-3 w-full rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={submit}
            disabled={createTicket.isPending}
            className="mt-3 flex items-center gap-2 rounded-xl bg-gradient-gold px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-gold disabled:opacity-60"
          >
            {createTicket.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} إرسال
          </button>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm font-bold">استفساراتي ({tickets.length})</p>
          {tickets.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">لا يوجد استفسارات بعد.</p>
          ) : (
            <div className="mt-3 space-y-3 max-h-72 overflow-y-auto">
              {tickets.map((t) => (
                <div key={t.id} className="rounded-xl border border-border/60 bg-background/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold">{t.subject}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${t.status === "answered" ? "bg-green-500/15 text-green-500" : "bg-orange-500/15 text-orange-400"}`}>
                      {t.status === "answered" ? "تم الرد" : "قيد المعالجة"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t.message}</p>
                  {t.response && (
                    <div className="mt-2 rounded-lg bg-primary/10 p-2 text-xs">
                      <span className="font-bold text-primary">الرد: </span>{t.response}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
      <div className="mt-4 text-2xl font-extrabold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
