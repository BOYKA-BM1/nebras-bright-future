import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * تخطيط مسارات المدرّس — يعرض الصفحة الفرعية (لوحة / واجبات / امتحانات / مشتركين)
 */
export const Route = createFileRoute("/_authenticated/teacher")({
  component: TeacherLayout,
});

function TeacherLayout() {
  return <Outlet />;
}
