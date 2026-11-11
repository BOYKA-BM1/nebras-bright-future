import { createFileRoute } from "@tanstack/react-router";
import { TeacherSimpleTaskPage } from "./teacher.homework";

export const Route = createFileRoute("/_authenticated/teacher/exams")({
  component: () => <TeacherSimpleTaskPage kind="exam" />,
});
