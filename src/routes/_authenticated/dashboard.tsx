import { useEffect, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Loader2, LogOut, BookOpen, Wallet, PlayCircle, ShieldCheck, GraduationCap, ArrowLeft, Heart,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { useCourses } from "@/hooks/use-catalog";
import { useMyEnrollments, useFavorites } from "@/hooks/use-content";
import { Logo } from "@/components/site/Logo";
import { resolveImage } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { isAdmin, isTeacher, isLoading: rolesLoading } = useRoles();
  const { data: courses = [] } = useCourses();
  const { data: enrollments = [], isLoading } = useMyEnrollments();
  const { favoriteIds } = useFavorites();

  // المدرّس (غير الأدمن) يتوجّه مباشرة للوحته
  useEffect(() => {
    if (!rolesLoading && isTeacher && !isAdmin) {
      navigate({ to: "/teacher" });
    }
  }, [rolesLoading, isTeacher, isAdmin, navigate]);

  const name =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "طالبنا العزيز";

  const myCourses = useMemo(
    () => enrollments.map((e) => courses.find((c) => c.id === e.course_id)).filter(Boolean) as typeof courses,
    [enrollments, courses],
  );
  const totalSpent = useMemo(() => myCourses.reduce((s, c) => s + (c.price || 0), 0), [myCourses]);

  const handleSignOut = async () => { await signOut(); navigate({ to: "/" }); };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
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
            <Link to="/" className="rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-accent">الدورات</Link>
            <button onClick={handleSignOut} className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-bold hover:bg-accent">
              <LogOut className="h-4 w-4" /> خروج
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-extrabold">أهلًا، <span className="text-gradient-gold">{name}</span> 👋</h1>
        <p className="mt-2 text-muted-foreground">دي لوحة التحكم بتاعتك — كمّل تعلّمك من هنا.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard icon={BookOpen} label="دوراتي" value={String(myCourses.length)} />
          <StatCard icon={Wallet} label="إجمالي القيمة" value={`${totalSpent} ج.م`} />
          <StatCard icon={Heart} label="المفضّلة" value={String(favoriteIds.size)} />
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
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
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
