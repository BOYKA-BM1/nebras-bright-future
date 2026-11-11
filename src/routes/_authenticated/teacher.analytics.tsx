import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { getMyTeacherDashboard } from "@/lib/teacher.functions";
import { LoadingState } from "@/components/shared/ui-states";

export const Route = createFileRoute("/_authenticated/teacher/analytics")({
  component: TeacherAnalyticsPickPage,
});

function TeacherAnalyticsPickPage() {
  const { user } = useAuth();
  const { isTeacher, isAdmin, isLoading: rolesLoading } = useRoles();
  const navigate = useNavigate();
  const callDashboard = useServerFn(getMyTeacherDashboard);
  const { data: stats, isLoading } = useQuery({
    queryKey: ["my-teacher-dashboard", user?.id],
    enabled: !!user && (isTeacher || isAdmin),
    queryFn: () => callDashboard(),
  });
  const courses = stats?.courses ?? [];

  if (rolesLoading || isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingState label="جاري التحميل…" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link to="/teacher" className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground">
        <ChevronRight className="h-3.5 w-3.5" /> رجوع للوحة المدرّس
      </Link>
      <h1 className="text-2xl font-extrabold">تحليلات المشاهدة</h1>
      <p className="mt-1 text-sm text-muted-foreground">اختَر دورة لعرض تقدّم الطلاب ومشاهداتهم.</p>
      <div className="mt-6 space-y-2">
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد دورات.</p>
        ) : (
          courses.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                navigate({ to: "/manage/$courseId/analytics", params: { courseId: c.id } })
              }
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm font-bold shadow-sm hover:bg-accent"
            >
              <span className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                {c.title}
              </span>
              <ChevronRight className="h-4 w-4 opacity-50" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
