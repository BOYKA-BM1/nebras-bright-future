import { createFileRoute } from "@tanstack/react-router";
import { TeacherTaskWorkspace } from "./teacher.homework";

export const Route = createFileRoute("/_authenticated/teacher/exams")({
  component: () => (
    <TeacherTaskWorkspace
      kind="exam"
      title="الامتحانات"
      subtitle="ارفع أسئلة الامتحان للطلاب ونموذج الإجابة للتصحيح الذكي"
    />
  ),
});
