import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Loader2, LogOut, BookOpen, Wallet, PlayCircle, ShieldCheck, GraduationCap, ArrowLeft, Heart, UserCog, AlertCircle, MessageCircle, Send, XCircle, HeartHandshake, MessagesSquare, ClipboardList, Award, CalendarDays, StickyNote, Bookmark, Menu, Sparkles, LineChart, Bot, Route as RouteIcon, BrainCircuit, Atom, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { useCourses } from "@/hooks/use-catalog";
import { useMyEnrollments, useFavorites, useUnenroll } from "@/hooks/use-content";
import { useMyTickets, useCreateTicket } from "@/hooks/use-staff";
import { useProfile, profileCompletion } from "@/hooks/use-profile";
import { Logo } from "@/components/site/Logo";
import { NotificationBell } from "@/components/site/NotificationBell";
import { SearchBar } from "@/components/site/SearchBar";
import { GamificationPanel } from "@/components/site/GamificationPanel";
import { resolveImage } from "@/lib/catalog";
import {
  LoadingState,
  ErrorState,
  EmptyState,
  StatCard as SharedStatCard,
} from "@/components/shared/ui-states";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user, confirmSignOut } = useAuth();
  const navigate = useNavigate();
  const { isAdmin, isTeacher, isMontage, isCustomerService, isSecretary, isPsychologist, isParent, isLoading: rolesLoading } = useRoles();
  const { data: courses = [], isError: coursesError, refetch: refetchCourses } = useCourses();
  const {
    data: enrollments = [],
    isLoading,
    isError: enrollmentsError,
    refetch: refetchEnrollments,
  } = useMyEnrollments();
  const { favoriteIds } = useFavorites();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const unenroll = useUnenroll();
  const dataError = coursesError || enrollmentsError;
  const refetchAll = () => {
    void refetchCourses();
    void refetchEnrollments();
  };

  const handleUnenroll = (courseId: string, title: string) => {
    if (!window.confirm(`متأكد إنك عايز تلغي اشتراكك في "${title}"؟`)) return;
    unenroll.mutate(courseId, {
      onSuccess: () => toast.success("تم إلغاء الاشتراك."),
      onError: () => toast.error("تعذّر إلغاء الاشتراك، حاول تاني."),
    });
  };

  // كل حساب يروح لصفحته الخاصة على طول
  const roleHome = rolesLoading
    ? null
    : isAdmin
      ? "/admin"
      : isTeacher
        ? "/teacher"
        : isParent
          ? "/parent"
          : isPsychologist
            ? "/psych"
            : isMontage
              ? "/staff/montage"
              : isCustomerService
                ? "/staff/support"
                : isSecretary
                  ? "/staff/students"
                  : null;

  useEffect(() => {
    if (roleHome) navigate({ to: roleHome });
  }, [roleHome, navigate]);


  const isStaffRole = isTeacher || isMontage || isCustomerService || isSecretary || isParent;

  // الحساب الجديد يختار نوعه (طالب / ولي أمر) الأول، وبعدين الأونبوردنج
  const accountType = user?.user_metadata?.account_type as string | undefined;
  useEffect(() => {
    if (rolesLoading || isAdmin || isStaffRole || isPsychologist) return;
    if (!accountType) {
      navigate({ to: "/account-type" });
      return;
    }
    if (accountType === "parent") {
      navigate({ to: "/parent-link" });
      return;
    }
    if (!profileLoading && profile && !profile.onboarded) {
      navigate({ to: "/onboarding" });
    }
  }, [rolesLoading, isAdmin, isStaffRole, isPsychologist, accountType, profileLoading, profile, navigate]);

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

  // ماننتظر تحديد الدور قبل عرض لوحة الطالب — علشان محصلش وميض للوحة الغلط
  if (rolesLoading || roleHome) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }




  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo />
          <div className="flex flex-wrap items-center gap-2">
            <NotificationBell />
            {isAdmin && (
              <Link to="/admin" className="flex items-center gap-1.5 rounded-xl bg-gradient-gold px-4 py-2 text-sm font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.03]">
                <ShieldCheck className="h-4 w-4" /> <span className="hidden sm:inline">الإدارة</span>
              </Link>
            )}
            {(isTeacher || isAdmin) && (
              <Link to="/teacher" className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-accent">
                <GraduationCap className="h-4 w-4" /> <span className="hidden sm:inline">المدرّس</span>
              </Link>
            )}

            {/* الروابط الثانوية: صف كامل على الشاشات الأوسع، وقائمة "المزيد" على الموبايل عشان الهيدر ميتزحمش */}
            <div className="hidden items-center gap-2 sm:flex">
              <Link to="/profile" className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-accent">
                <UserCog className="h-4 w-4" /> ملفي
              </Link>
              <Link to="/courses" className="rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-accent">الدورات</Link>
              <Link to="/assignments" className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-accent">
                <ClipboardList className="h-4 w-4" /> واجباتي
              </Link>
              <Link to="/certificates" className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-accent">
                <Award className="h-4 w-4" /> شهاداتي
              </Link>
              <Link to="/calendar" className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-accent">
                <CalendarDays className="h-4 w-4" /> المواعيد
              </Link>
              <Link to="/notes" className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-accent">
                <StickyNote className="h-4 w-4" /> ملاحظاتي
              </Link>
              <Link to="/bookmarks" className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-accent">
                <Bookmark className="h-4 w-4" /> المفضّلة
              </Link>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent sm:hidden">
                  <Menu className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="sm:hidden">
                <DropdownMenuItem asChild><Link to="/profile" className="flex items-center gap-2"><UserCog className="h-4 w-4" /> ملفي</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/courses" className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> الدورات</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/assignments" className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /> واجباتي</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/certificates" className="flex items-center gap-2"><Award className="h-4 w-4" /> شهاداتي</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/calendar" className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> المواعيد</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/notes" className="flex items-center gap-2"><StickyNote className="h-4 w-4" /> ملاحظاتي</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/bookmarks" className="flex items-center gap-2"><Bookmark className="h-4 w-4" /> المفضّلة</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button onClick={handleSignOut} className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-bold hover:bg-accent">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <HeroBanner name={name} />

        <div className="mt-5 sm:mt-6">
          <SearchBar />
        </div>

        {!completion.complete && (
          <Link
            to="/profile"
            className="mt-5 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 transition-colors hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:mt-6"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-bold">أكمل ملفك الشخصي ({completion.percent}%)</p>
              <p className="text-sm text-muted-foreground">
                لازم تكمّل بياناتك علشان تقدر تحجز وتشترك في الدورات.
              </p>
            </div>
            <ArrowLeft className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          </Link>
        )}

        {/* Statistics from real enrollments / favorites only */}
        <div className="mt-6 grid grid-cols-1 gap-3 min-[400px]:grid-cols-3 sm:mt-8 sm:gap-4">
          <SharedStatCard icon={BookOpen} label="دوراتي" value={String(myCourses.length)} />
          <SharedStatCard icon={Wallet} label="إجمالي القيمة" value={`${totalSpent} ج.م`} />
          <SharedStatCard icon={Heart} label="المفضّلة" value={String(favoriteIds.size)} />
        </div>

        {/* Quick student rooms */}
        <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4">
          <Link
            to="/psych"
            className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 transition-colors hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <HeartHandshake className="h-6 w-6 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-bold">الغرفة النفسية</p>
              <p className="text-xs text-muted-foreground">كلام سرّي مع دكتور نفسي أو اطلب مكالمة.</p>
            </div>
            <ArrowLeft className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          </Link>
          <Link
            to="/community"
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <MessagesSquare className="h-6 w-6 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-bold">غرفة صفّي</p>
              <p className="text-xs text-muted-foreground">دردشة جماعية مع زمايلك في نفس الصف.</p>
            </div>
            <ArrowLeft className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          </Link>
        </div>

        <section className="mt-10 sm:mt-12" aria-labelledby="dash-gamification">
          <h2 id="dash-gamification" className="text-xl font-extrabold tracking-tight">
            إنجازاتي ونقاطي
          </h2>
          <div className="mt-4">
            <GamificationPanel courses={myCourses.length} />
          </div>
        </section>

        <section className="mt-10 sm:mt-12" aria-labelledby="dash-my-courses">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="dash-my-courses" className="text-xl font-extrabold tracking-tight">
              كمّل التعلّم
            </h2>
            <Link
              to="/courses"
              className="text-sm font-bold text-primary transition-colors hover:text-primary/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              تصفّح كل الدورات
            </Link>
          </div>

          {dataError ? (
            <ErrorState
              className="mt-6"
              title="تعذّر تحميل دوراتك"
              description="حصل خطأ أثناء جلب الاشتراكات أو قائمة الدورات."
              onRetry={refetchAll}
            />
          ) : isLoading ? (
            <LoadingState className="mt-6" label="جاري تحميل دوراتك…" />
          ) : myCourses.length === 0 ? (
            <EmptyState
              className="mt-6"
              title="لسه ما اشتركتش في أي دورة"
              description="تصفّح الكتالوج واشترك في دورة عشان تبدأ التعلّم."
              action={
                <Link
                  to="/courses"
                  className="inline-flex rounded-xl bg-gradient-gold px-6 py-3 text-sm font-bold text-primary-foreground shadow-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  تصفّح الدورات
                </Link>
              }
            />
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myCourses.map((c) => {
                const img = resolveImage(c.image_url) ?? resolveImage(c.teacher?.image_url);
                return (
                  <article
                    key={c.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
                  >
                    {img ? (
                      <img src={img} alt="" className="h-32 w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-32 items-center justify-center bg-gradient-to-br from-primary/15 to-transparent">
                        <BookOpen className="h-8 w-8 text-primary/50" aria-hidden />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="line-clamp-2 font-bold leading-snug">{c.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{c.teacher?.name}</p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <PlayCircle className="h-3.5 w-3.5 text-primary" aria-hidden />
                        {c.lessons_count} درس
                      </div>
                      <div className="mt-auto pt-4">
                        <Link
                          to="/learn/$courseId"
                          params={{ courseId: c.id }}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          <ArrowLeft className="h-4 w-4" aria-hidden />
                          كمّل التعلّم
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleUnenroll(c.id, c.title)}
                          disabled={unenroll.isPending}
                          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 px-4 py-2 text-sm font-bold text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-70"
                        >
                          <XCircle className="h-4 w-4" aria-hidden />
                          إلغاء الاشتراك
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

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

/** بانر الترحيب الرئيسي — يطابق تصميم المرجع: عنوان + زرارين + رسم توضيحي متوهّج + بطاقات مميّزات */
function HeroBanner({ name }: { name: string }) {
  const features = [
    { icon: Sparkles, title: "محتوى ذكي", subtitle: "مخصص لك" },
    { icon: LineChart, title: "تقييم مستمر", subtitle: "ونقاط تفصيلية" },
    { icon: Bot, title: "مساعد AI", subtitle: "يساعدك في أي وقت" },
    { icon: RouteIcon, title: "مسارات تعلم", subtitle: "مصممة لأهدافك" },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 sm:p-10">
      <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        {/* النص والأزرار */}
        <div>
          <p className="text-sm font-bold text-muted-foreground">مرحبًا بك في</p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">
            <span className="text-foreground">edu</span>
            <span className="text-gradient-gold">mindly</span>
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            منصة تعليمية ذكية تساعدك على التعلم بتركيز أعلى وذكاء أكبر، يا {name}.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to="/courses" className="flex items-center gap-2 rounded-xl bg-gradient-gold px-5 py-3 text-sm font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.03]">
              متابعة التعلم <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link to="/calendar" className="flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-bold hover:bg-accent">
              <PlayCircle className="h-4 w-4" /> اكتشف المزيد
            </Link>
          </div>
        </div>

        {/* الرسم التوضيحي المتوهّج */}
        <div className="relative mx-auto flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64">
          <div className="absolute inset-0 rounded-full bg-gradient-gold opacity-20 blur-3xl" />
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="absolute rounded-full border border-primary/20"
              style={{ inset: `${i * 18}px` }}
            />
          ))}
          <span className="glow-gold flex h-24 w-24 items-center justify-center rounded-full bg-gradient-gold text-primary-foreground">
            <BrainCircuit className="h-12 w-12" />
          </span>
          <span className="absolute -top-1 right-6 flex h-9 w-9 animate-float-slow items-center justify-center rounded-xl bg-secondary text-primary shadow-card">
            <GraduationCap className="h-4.5 w-4.5" />
          </span>
          <span className="absolute bottom-2 -left-2 flex h-9 w-9 animate-float-slow items-center justify-center rounded-xl bg-secondary text-primary shadow-card" style={{ animationDelay: "1.5s" }}>
            <Atom className="h-4.5 w-4.5" />
          </span>
          <span className="absolute left-8 top-6 flex h-9 w-9 animate-float-slow items-center justify-center rounded-xl bg-secondary text-primary shadow-card" style={{ animationDelay: "3s" }}>
            <TrendingUp className="h-4.5 w-4.5" />
          </span>
        </div>
      </div>

      {/* بطاقات المميّزات */}
      <div className="mt-8 grid grid-cols-2 gap-3 border-t border-border/60 pt-6 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/50 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <f.icon className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{f.title}</p>
              <p className="truncate text-xs text-muted-foreground">{f.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
