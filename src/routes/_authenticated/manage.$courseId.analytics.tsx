import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ChevronRight, Users, CheckCircle2, PlayCircle, AlertTriangle, TrendingUp, ShieldAlert, Clock, CircleDot } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { useAuth } from "@/hooks/use-auth";
import { useCourse } from "@/hooks/use-content";
import { getCourseWatchAnalytics, getCourseAttendance } from "@/lib/teacher.functions";

export const Route = createFileRoute("/_authenticated/manage/$courseId/analytics")({
  component: CourseAnalytics,
});

function CourseAnalytics() {
  const { courseId } = Route.useParams();
  const { user } = useAuth();
  const { data: course } = useCourse(courseId);
  const call = useServerFn(getCourseWatchAnalytics);
  const callAttendance = useServerFn(getCourseAttendance);
  const { data, isLoading } = useQuery({
    queryKey: ["course-watch-analytics", courseId],
    enabled: !!user,
    queryFn: () => call({ data: { courseId } }),
    staleTime: 30_000,
  });
  const { data: attendance } = useQuery({
    queryKey: ["course-attendance", courseId],
    enabled: !!user,
    queryFn: () => callAttendance({ data: { courseId } }),
    staleTime: 30_000,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <Link
            to="/manage/$courseId"
            params={{ courseId }}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent"
          >
            <ChevronRight className="h-4 w-4" /> رجوع لإدارة الدورة
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">تحليلات مشاهدة الفيديو</p>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{course?.title ?? "..."}</h1>

        {isLoading ? (
          <div className="mt-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : !data?.authorized ? (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">مش متاح ليك تشوف تحليلات الدورة دي.</p>
          </div>
        ) : (
          <>
            {/* بطاقات ملخّص الكورس */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Users, label: "الطلاب المشتركون", value: data.totalStudents },
                { icon: TrendingUp, label: "متوسط تقدّم الكورس", value: `${data.avgCourseProgress}%` },
                { icon: PlayCircle, label: "متوسط مشاهدة الفيديوهات", value: `${data.avgWatchPercent}%` },
                { icon: CheckCircle2, label: "متوسط الاختبارات", value: `${data.avgQuizScore}%` },
              ].map((c) => (
                <div key={c.label} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-muted-foreground">{c.label}</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary"><c.icon className="h-4 w-4" /></span>
                  </div>
                  <p className="mt-3 text-2xl font-extrabold text-gradient-gold">{c.value}</p>
                </div>
              ))}
            </div>

            {/* حالة كل درس */}
            <section className="mt-8">
              <h2 className="text-lg font-extrabold">حالة كل درس</h2>
              <p className="mt-1 text-sm text-muted-foreground">مين أكمل، ومين بدأ ولم يكمل، ومين لم يبدأ بعد.</p>
              <div className="mt-4 space-y-3">
                {data.lessons.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">لا توجد دروس بعد.</p>
                ) : (
                  data.lessons.map((l) => (
                    <div key={l.lessonId} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold">{l.title}</p>
                        <span className="text-xs font-bold text-muted-foreground">متوسط المشاهدة {l.avgWatchPercent}%</span>
                      </div>
                      <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                        {l.totalStudents > 0 && (
                          <>
                            <div className="h-full bg-primary" style={{ width: `${(l.completed / l.totalStudents) * 100}%` }} title="مكتمل" />
                            <div className="h-full bg-yellow-400" style={{ width: `${(l.partial / l.totalStudents) * 100}%` }} title="بدأ ولم يكمل" />
                            <div className="h-full bg-destructive/60" style={{ width: `${(l.notStarted / l.totalStudents) * 100}%` }} title="لم يبدأ" />
                          </>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> مكتمل: {l.completed}</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-400" /> بدأ ولم يكمل: {l.partial}</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive/60" /> لم يبدأ: {l.notStarted}</span>
                      </div>

                      {l.partial > 0 && (
                        <div className="mt-3 border-t border-border/60 pt-3">
                          <p className="text-[11px] font-bold text-muted-foreground">أماكن التوقف (الطلاب اللي بدأوا ولم يكملوا)</p>
                          <div className="mt-2 flex items-end gap-1.5" style={{ height: 48 }}>
                            {([
                              ["0-25%", l.dropOff.b0to25],
                              ["25-50%", l.dropOff.b25to50],
                              ["50-75%", l.dropOff.b50to75],
                              ["75-99%", l.dropOff.b75to99],
                            ] as const).map(([label, count]) => {
                              const max = Math.max(l.dropOff.b0to25, l.dropOff.b25to50, l.dropOff.b50to75, l.dropOff.b75to99, 1);
                              return (
                                <div key={label} className="flex flex-1 flex-col items-center gap-1">
                                  <div className="flex w-full flex-1 items-end">
                                    <div
                                      className="w-full rounded-t bg-orange-400/70"
                                      style={{ height: `${Math.max(4, (count / max) * 100)}%` }}
                                      title={`${count} طالب توقّف عند ${label}`}
                                    />
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">{label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* الطلاب المحتاجون متابعة */}
            <section className="mt-8">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/15 text-destructive"><AlertTriangle className="h-4 w-4" /></span>
                <h2 className="text-lg font-extrabold">طلاب يحتاجون متابعة</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">مؤشرات فقط (ضعف مشاهدة أو ضعف نتائج) — مش حكمًا نهائيًا على الطالب.</p>
              {data.strugglingStudents.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">لا يوجد طلاب محتاجون متابعة حاليًا 🎉</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {data.strugglingStudents.map((s) => (
                    <div key={s.userId} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-4 py-3">
                      <span className="font-bold">{s.fullName}</span>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>مشاهدة: <b className="text-foreground">{s.avgWatchPercent}%</b></span>
                        <span>متوسط الاختبارات: <b className="text-foreground">{s.avgQuizScore}%</b></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* النشاط/الحضور المبني على المشاهدة الفعلية — مش ضغطة حاضر/غايب يدوية */}
            {attendance?.authorized && (
              <section className="mt-8">
                <h2 className="flex items-center gap-2 text-lg font-extrabold"><Clock className="h-5 w-5 text-primary" /> نشاط الطلاب</h2>
                <p className="mt-1 text-sm text-muted-foreground">آخر نشاط مشاهدة فعلي لكل طالب — دورات فيديو مسجّلة، مش حصص مباشرة، فمفيش "حضور" بالمعنى التقليدي.</p>
                <div className="mt-4 space-y-2">
                  {attendance.students.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">لا يوجد طلاب مشتركين بعد.</p>
                  ) : (
                    attendance.students.map((s) => (
                      <div key={s.userId} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CircleDot className={`h-3 w-3 ${s.activeLast7Days ? "text-green-500" : "text-muted-foreground"}`} />
                          <span className="font-bold">{s.fullName}</span>
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>{s.lessonsWatched} / {s.totalLessons} درس</span>
                          <span>{s.lastActiveAt ? `آخر نشاط: ${new Date(s.lastActiveAt).toLocaleDateString("ar-EG")}` : "لم يبدأ بعد"}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
