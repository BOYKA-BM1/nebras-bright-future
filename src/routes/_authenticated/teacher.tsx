import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, BookOpen, Settings2, LogOut, Home, ShieldAlert, PlayCircle, Ticket, Copy, Wallet, Users, Star, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { useCourses, useTeachers } from "@/hooks/use-catalog";
import { useCoupons } from "@/hooks/use-admin";
import { getMyTeacherDashboard } from "@/lib/teacher.functions";
import { Logo } from "@/components/site/Logo";
import { resolveImage } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/teacher")({
  component: TeacherDashboard,
});

function TeacherDashboard() {
  const { user, confirmSignOut } = useAuth();
  const navigate = useNavigate();
  const { isTeacher, isAdmin, isLoading } = useRoles();
  const { data: courses = [], isLoading: coursesLoading } = useCourses();
  const { data: teachers = [] } = useTeachers();
  const { data: coupons = [] } = useCoupons();
  const callDashboard = useServerFn(getMyTeacherDashboard);
  const { data: stats } = useQuery({
    queryKey: ["my-teacher-dashboard", user?.id],
    enabled: !!user && (isTeacher || isAdmin),
    queryFn: () => callDashboard(),
    staleTime: 30_000,
  });
  const fmt = (n: number) => new Intl.NumberFormat("ar-EG").format(Math.round(n));

  const myTeacher = useMemo(
    () => teachers.find((t) => t.user_id === user?.id) ?? null,
    [teachers, user?.id],
  );

  const myCoupons = useMemo(() => {
    if (isAdmin) return coupons;
    if (!myTeacher) return [];
    return coupons.filter((c) => c.teacher_id === myTeacher.id);
  }, [coupons, isAdmin, myTeacher]);

  const myCourses = useMemo(() => {
    if (isAdmin) return courses;
    return courses.filter((c) => c.teacher?.user_id === user?.id);
  }, [courses, isAdmin, user?.id]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("تم نسخ الكود");
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!isTeacher && !isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive"><ShieldAlert className="h-8 w-8" /></span>
        <h1 className="text-2xl font-extrabold">غير مصرّح لك</h1>
        <p className="max-w-md text-muted-foreground">الصفحة دي مخصّصة للمدرّسين. لو إنت مدرّس وعايز حساب، تواصل مع الإدارة.</p>
        <Link to="/" className="rounded-xl bg-gradient-gold px-6 py-3 text-sm font-bold text-primary-foreground shadow-gold">الرجوع للرئيسية</Link>
      </div>
    );
  }

  const handleSignOut = () => { confirmSignOut(() => navigate({ to: "/" })); };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary sm:inline">لوحة المدرّس</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent"><Home className="h-4 w-4" /><span className="hidden sm:inline">الموقع</span></Link>
            <button onClick={handleSignOut} className="flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-sm font-bold hover:bg-accent"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">خروج</span></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* ملخص أداء المدرّس */}
        {stats?.isTeacher && (
          <section className="mb-10">
            <h1 className="text-2xl font-extrabold sm:text-3xl">أهلًا{stats.name ? ` أ/ ${stats.name}` : ""} 👋</h1>
            <p className="mt-1 text-muted-foreground">ملخّص أدائك على المنصة.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Wallet, label: "أرباحي", value: `${fmt(stats.profit)} ج.م`, hint: `نسبتك ${stats.profitPercentage}% من ${fmt(stats.revenue)} ج.م` },
                { icon: Users, label: "عدد الطلاب", value: fmt(stats.students), hint: `${fmt(stats.activeEnrollments)} اشتراك نشط` },
                { icon: Star, label: "تقييمي", value: stats.rating.toFixed(1), hint: "من 5 نجوم" },
                { icon: PlayCircle, label: "إجمالي الدروس", value: fmt(stats.lessons), hint: `${stats.courses.length} دورة` },
              ].map((c) => (
                <div key={c.label} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-muted-foreground">{c.label}</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary"><c.icon className="h-4 w-4" /></span>
                  </div>
                  <p className="mt-3 text-2xl font-extrabold text-gradient-gold">{c.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
                </div>
              ))}
            </div>

            {stats.courses.some((c) => c.income > 0 || c.subscribers > 0) && (
              <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary"><TrendingUp className="h-4 w-4" /></span>
                  <h2 className="font-extrabold">الكورسات الأكثر مبيعًا</h2>
                </div>
                <div className="mt-4 space-y-2">
                  {stats.courses.slice(0, 5).map((c, i) => (
                    <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/50 px-4 py-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-extrabold text-primary">{i + 1}</span>
                      <span className="flex-1 truncate font-bold">{c.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{fmt(c.subscribers)} طالب</span>
                      <span className="shrink-0 text-sm font-extrabold text-primary">{fmt(c.income)} ج.م</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* كوبونات المدرّس */}
        <section className="mb-10 rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Ticket className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-extrabold">كوبونات الخصم الخاصة بك</h2>
              <p className="text-xs text-muted-foreground">شارك الكود ده مع طلابك علشان يستفيدوا بالخصم.</p>
            </div>
          </div>

          {myCoupons.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-border bg-card/50 p-5 text-center text-sm text-muted-foreground">
              لا يوجد كوبون مخصّص لك حتى الآن. تواصل مع الإدارة لإنشاء الكوبون الخاص بك.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {myCoupons.map((c) => (
                <div key={c.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => copyCode(c.code)}
                      className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 font-mono text-sm font-bold text-primary hover:bg-primary/20"
                      dir="ltr"
                      title="نسخ الكود"
                    >
                      {c.code} <Copy className="h-3.5 w-3.5" />
                    </button>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c.is_active ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                      {c.is_active ? "فعّال" : "موقوف"}
                    </span>
                  </div>
                  <p className="mt-3 text-lg font-extrabold text-gradient-gold">
                    {c.discount_percent ? `${c.discount_percent}%` : c.discount_amount ? `${c.discount_amount} ج.م` : "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    استُخدم {c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""} مرة
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <h1 className="text-2xl font-extrabold sm:text-3xl">دوراتي</h1>
        <p className="mt-1 text-muted-foreground">{isAdmin ? "بصفتك أدمن تقدر تدير محتوى كل الدورات." : "أدِر محتوى دوراتك ودروسك من هنا."}</p>


        {coursesLoading ? (
          <div className="mt-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : myCourses.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">لا توجد دورات مرتبطة بحسابك بعد. تواصل مع الإدارة لربط دوراتك.</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myCourses.map((c) => {
              const img = resolveImage(c.image_url) ?? resolveImage(c.teacher?.image_url);
              return (
                <div key={c.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                  {img ? <img src={img} alt={c.title} className="h-32 w-full object-cover" /> : <div className="flex h-32 items-center justify-center bg-gradient-to-br from-primary/15 to-transparent"><BookOpen className="h-8 w-8 text-primary/50" /></div>}
                  <div className="p-4">
                    <h3 className="font-bold leading-snug line-clamp-2">{c.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{c.subject}</p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><PlayCircle className="h-3.5 w-3.5 text-primary" />{c.lessons_count} درس</span>
                      <span className={`rounded-full px-2 py-0.5 ${c.is_published ? "bg-primary/10 text-primary" : "bg-secondary"}`}>{c.is_published ? "منشورة" : "مسودّة"}</span>
                    </div>
                    <Link to="/manage/$courseId" params={{ courseId: c.id }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-2 text-sm font-bold text-primary-foreground shadow-gold">
                      <Settings2 className="h-4 w-4" /> إدارة المحتوى
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
