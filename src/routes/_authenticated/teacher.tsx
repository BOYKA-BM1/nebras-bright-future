import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  Settings2,
  ShieldAlert,
  PlayCircle,
  Ticket,
  Copy,
  Wallet,
  Users,
  Star,
  TrendingUp,
  UserRound,
  CalendarDays,
} from "lucide-react";
import { ComplaintButton } from "@/components/site/ComplaintButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { useCourses, useTeachers } from "@/hooks/use-catalog";
import { useCoupons } from "@/hooks/use-admin";
import { getMyTeacherDashboard } from "@/lib/teacher.functions";
import { resolveImage } from "@/lib/catalog";
import { LoadingState } from "@/components/shared/ui-states";

export const Route = createFileRoute("/_authenticated/teacher")({
  component: TeacherDashboard,
});

function TeacherDashboard() {
  const { user } = useAuth();
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

  const myTeacherId =
    stats?.teacherId ?? teachers.find((t) => t.user_id === user?.id)?.id ?? null;

  const myCoupons = useMemo(() => {
    if (isAdmin) return coupons;
    if (!myTeacherId) return [];
    return coupons.filter((c) => c.teacher_id === myTeacherId);
  }, [coupons, isAdmin, myTeacherId]);

  const myCourses = useMemo(() => {
    if (isAdmin) {
      return courses.map((c) => ({
        id: c.id,
        title: c.title,
        subject: c.subject ?? null,
        image_url: c.image_url ?? null,
        is_published: !!c.is_published,
        lessons: Number(c.lessons_count || 0),
        teacherImage: c.teacher?.image_url ?? null,
      }));
    }
    return (stats?.courses ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      subject: c.subject,
      image_url: c.image_url,
      is_published: c.is_published,
      lessons: c.lessons,
      teacherImage: null as string | null,
    }));
  }, [courses, isAdmin, stats?.courses]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("تم نسخ الكود");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-background px-4">
        <LoadingState label="جاري تحميل لوحة المدرّس…" />
      </div>
    );
  }

  if (!isTeacher && !isAdmin) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </span>
        <h1 className="text-2xl font-extrabold">غير مصرّح لك</h1>
        <p className="max-w-md text-muted-foreground">
          الصفحة دي مخصّصة للمدرّسين. لو إنت مدرّس وعايز حساب، تواصل مع الإدارة.
        </p>
        <Link
          to="/"
          className="rounded-xl bg-gradient-gold px-6 py-3 text-sm font-bold text-primary-foreground shadow-gold"
        >
          الرجوع للرئيسية
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* شريط أدوات صغير — القائمة الجانبية الموحدة في Navbar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">لوحة المدرّس</h1>
            <p className="text-sm text-muted-foreground">إدارة دوراتك وطلابك وأرباحك</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold hover:bg-accent"
                >
                  <UserRound className="h-4 w-4" />
                  بياناتي
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>بياناتي</DialogTitle>
                  <DialogDescription>ملخص حساب المدرّس</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">البريد: </span>
                    {user?.email ?? "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">معرّف المدرّس: </span>
                    {myTeacherId ?? "غير مربوط بعد"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">عدد الدورات: </span>
                    {myCourses.length}
                  </p>
                </div>
                <Link
                  to="/profile"
                  className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                >
                  فتح الملف الشخصي
                </Link>
              </DialogContent>
            </Dialog>

            <Link
              to="/calendar"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold hover:bg-accent"
            >
              <CalendarDays className="h-4 w-4" />
              المواعيد
            </Link>

            <ComplaintButton />
          </div>
        </div>

        {/* إحصائيات */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: BookOpen, label: "دوراتي", value: fmt(myCourses.length) },
            { icon: Users, label: "الطلاب", value: fmt(Number(stats?.students ?? 0)) },
            { icon: Wallet, label: "الأرباح", value: fmt(Number(stats?.profit ?? 0)) },
            { icon: Star, label: "التقييم", value: stats?.rating != null ? String(stats.rating) : "—" },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-extrabold">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* كوبونات */}
        {myCoupons.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold">
              <Ticket className="h-5 w-5 text-primary" /> كوبوناتي
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {myCoupons.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div>
                    <p className="font-bold">{c.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.discount_percent != null ? `${c.discount_percent}%` : c.discount_amount != null ? `${c.discount_amount} ج` : "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyCode(c.code)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs font-bold hover:bg-accent"
                  >
                    <Copy className="h-3.5 w-3.5" /> نسخ
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* الدورات */}
        <section className="mt-8">
          <h2 className="text-lg font-extrabold">دوراتي</h2>
          {coursesLoading && !stats ? (
            <LoadingState label="جاري تحميل الدورات…" className="mt-6" />
          ) : myCourses.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">
                لا توجد دورات مرتبطة بحسابك بعد. تواصل مع الإدارة لربط دوراتك.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myCourses.map((c) => {
                const img = resolveImage(c.image_url) ?? resolveImage(c.teacherImage);
                return (
                  <div
                    key={c.id}
                    className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
                  >
                    {img ? (
                      <img src={img} alt={c.title} className="h-32 w-full object-cover" />
                    ) : (
                      <div className="flex h-32 items-center justify-center bg-gradient-to-br from-primary/15 to-transparent">
                        <BookOpen className="h-8 w-8 text-primary/50" />
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="line-clamp-2 font-bold leading-snug">{c.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{c.subject}</p>
                      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <PlayCircle className="h-3.5 w-3.5 text-primary" />
                          {c.lessons} درس
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 ${
                            c.is_published ? "bg-primary/10 text-primary" : "bg-secondary"
                          }`}
                        >
                          {c.is_published ? "منشورة" : "مسودّة"}
                        </span>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Link
                          to="/manage/$courseId"
                          params={{ courseId: c.id }}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-2 text-sm font-bold text-primary-foreground shadow-gold"
                        >
                          <Settings2 className="h-4 w-4" /> إدارة المحتوى
                        </Link>
                        <Link
                          to="/manage/$courseId/analytics"
                          params={{ courseId: c.id }}
                          className="flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/20"
                          title="تحليلات المشاهدة"
                        >
                          <TrendingUp className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
