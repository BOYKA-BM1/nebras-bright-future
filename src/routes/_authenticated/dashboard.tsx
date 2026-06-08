import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Loader2,
  LogOut,
  Trash2,
  Video,
  PlayCircle,
  CalendarClock,
  BookOpen,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useBookings } from "@/hooks/use-bookings";
import { Logo } from "@/components/site/Logo";
import { courses } from "@/data/site";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { bookings, isLoading, cancel } = useBookings();

  const name =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "طالبنا العزيز";

  const totalSpent = useMemo(
    () => bookings.reduce((sum, b) => sum + (b.price || 0), 0),
    [bookings],
  );

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const courseById = (id: number) => courses.find((c) => c.id === id);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="rounded-xl border border-border px-4 py-2 text-sm font-bold transition-colors hover:bg-accent"
            >
              الدورات
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-bold transition-colors hover:bg-accent"
            >
              <LogOut className="h-4 w-4" />
              خروج
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-extrabold">
          أهلًا، <span className="text-gradient-gold">{name}</span> 👋
        </h1>
        <p className="mt-2 text-muted-foreground">دي لوحة التحكم بتاعتك — تابع دوراتك ومحاضراتك من هنا.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard icon={BookOpen} label="عدد الدورات" value={String(bookings.length)} />
          <StatCard icon={Wallet} label="إجمالي القيمة" value={`${totalSpent} ج.م`} />
          <StatCard
            icon={Video}
            label="حصص مباشرة متاحة"
            value={String(
              bookings.reduce((s, b) => s + (courseById(b.course_id)?.liveSessions ?? 0), 0),
            )}
          />
        </div>

        <h2 className="mt-12 text-xl font-extrabold">دوراتي المحجوزة</h2>

        {isLoading ? (
          <div className="mt-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <p className="text-muted-foreground">لسه محجزتش أي دورة.</p>
            <Link
              to="/"
              hash="courses"
              className="mt-4 inline-block rounded-xl bg-gradient-gold px-6 py-3 text-sm font-bold text-primary-foreground shadow-gold"
            >
              تصفّح الدورات
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {bookings.map((b) => {
              const course = courseById(b.course_id);
              return (
                <article
                  key={b.id}
                  className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold leading-snug">{b.course_title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{b.teacher_name}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
                      مؤكّد
                    </span>
                  </div>

                  {course && (
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Video className="h-4 w-4 text-primary" />
                        {course.liveSessions} حصة مباشرة
                      </span>
                      <span className="flex items-center gap-1.5">
                        <PlayCircle className="h-4 w-4 text-primary" />
                        {course.videos} فيديو مسجّل
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-border/60 pt-4">
                    <button
                      className="flex items-center gap-2 rounded-xl bg-gradient-gold px-4 py-2 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.03]"
                      onClick={() => toast.info("هتقدر تدخل المحاضرة المباشرة قبل موعدها بدقائق.")}
                    >
                      <CalendarClock className="h-4 w-4" />
                      دخول المحاضرة
                    </button>
                    <button
                      onClick={() =>
                        cancel.mutate(b.id, {
                          onSuccess: () => toast.success("تم إلغاء الحجز."),
                          onError: () => toast.error("تعذّر الإلغاء، حاول مرة أخرى."),
                        })
                      }
                      className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      إلغاء
                    </button>
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

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div className="mt-4 text-2xl font-extrabold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
