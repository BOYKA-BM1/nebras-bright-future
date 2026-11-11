import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronRight, Users, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { getMyTeacherDashboard, getCourseAttendance } from "@/lib/teacher.functions";
import { LoadingState } from "@/components/shared/ui-states";

export const Route = createFileRoute("/_authenticated/teacher/analytics")({
  component: TeacherSubscribersPage,
});

function TeacherSubscribersPage() {
  const { user } = useAuth();
  const { isTeacher, isAdmin, isLoading: rolesLoading } = useRoles();
  const callDashboard = useServerFn(getMyTeacherDashboard);
  const callAttendance = useServerFn(getCourseAttendance);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["my-teacher-dashboard", user?.id],
    enabled: !!user && (isTeacher || isAdmin),
    queryFn: () => callDashboard(),
  });
  const courses = stats?.courses ?? [];
  const [courseId, setCourseId] = useState<string | null>(null);
  const activeId = courseId ?? courses[0]?.id ?? null;

  const { data: attendance, isLoading: attLoading } = useQuery({
    queryKey: ["course-attendance", activeId],
    enabled: !!activeId,
    queryFn: () => callAttendance({ data: { courseId: activeId! } }),
  });

  if (rolesLoading || isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingState label="جاري التحميل…" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link
        to="/teacher"
        className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="h-3.5 w-3.5" /> رجوع للوحة المدرّس
      </Link>
      <h1 className="flex items-center gap-2 text-2xl font-extrabold">
        <Users className="h-6 w-6 text-primary" /> المشتركين
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        كل الطلاب المشتركين في دوراتك: مشاهدة الدروس ودرجات الواجبات والامتحانات.
      </p>

      {courses.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">لا توجد دورات مربوطة بحسابك.</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            {courses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCourseId(c.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  activeId === c.id
                    ? "bg-primary text-primary-foreground"
                    : "border border-border hover:bg-accent"
                }`}
              >
                {c.title}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {attLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !attendance?.authorized ? (
              <p className="text-sm text-muted-foreground">غير مصرّح بعرض هذه الدورة.</p>
            ) : (attendance.students?.length ?? 0) === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                لا يوجد مشتركين في هذه الدورة بعد.
              </div>
            ) : (
              <ul className="space-y-3">
                {attendance.students.map((s) => {
                  const pct =
                    s.totalLessons > 0
                      ? Math.round((s.lessonsWatched / s.totalLessons) * 100)
                      : 0;
                  return (
                    <li
                      key={s.userId}
                      className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-extrabold">{s.fullName}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {s.activeLast7Days
                              ? "نشط خلال آخر 7 أيام"
                              : s.lastActiveAt
                                ? `آخر نشاط: ${new Date(s.lastActiveAt).toLocaleDateString("ar-EG")}`
                                : "لم يشاهد بعد"}
                          </p>
                        </div>
                        <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary">
                          {s.lessonsWatched}/{s.totalLessons} درس · {pct}%
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-secondary/50 px-3 py-2">
                          <p className="text-muted-foreground">متوسط الامتحانات</p>
                          <p className="mt-0.5 text-sm font-extrabold">
                            {s.examAvg != null ? `${s.examAvg}` : "—"}
                            {s.examCount ? (
                              <span className="ms-1 text-[10px] font-normal text-muted-foreground">
                                ({s.examCount})
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <div className="rounded-xl bg-secondary/50 px-3 py-2">
                          <p className="text-muted-foreground">متوسط الواجبات</p>
                          <p className="mt-0.5 text-sm font-extrabold">
                            {s.homeworkAvg != null ? `${s.homeworkAvg}` : "—"}
                            {s.homeworkCount ? (
                              <span className="ms-1 text-[10px] font-normal text-muted-foreground">
                                ({s.homeworkCount})
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
