import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Loader2, Upload, ImageIcon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { getMyTeacherDashboard } from "@/lib/teacher.functions";
import { useCourseContent } from "@/hooks/use-content";
import { useCourseAssignments, useAssignmentActions } from "@/hooks/use-assignments";
import { useUploadFile } from "@/hooks/use-files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/shared/ui-states";

export const Route = createFileRoute("/_authenticated/teacher/homework")({
  component: () => <TeacherSimpleTaskPage kind="homework" />,
});

export function TeacherSimpleTaskPage({ kind }: { kind: "homework" | "exam" }) {
  const isExam = kind === "exam";
  const title = isExam ? "الامتحانات" : "الواجبات";
  const { user } = useAuth();
  const { isTeacher, isAdmin, isLoading: rolesLoading } = useRoles();
  const callDashboard = useServerFn(getMyTeacherDashboard);
  const { data: stats, isLoading } = useQuery({
    queryKey: ["my-teacher-dashboard", user?.id],
    enabled: !!user && (isTeacher || isAdmin),
    queryFn: () => callDashboard(),
  });
  const courses = stats?.courses ?? [];
  const [courseId, setCourseId] = useState<string>("");
  const activeCourseId = courseId || courses[0]?.id || "";

  const { sections, isLoading: contentLoading } = useCourseContent(activeCourseId || undefined);
  const units = (sections ?? []).filter((u) => u.id !== "__orphan__");
  const [sectionId, setSectionId] = useState<string>("");
  const activeSectionId = sectionId || units[0]?.id || "";

  const [name, setName] = useState("");
  const [questionsPath, setQuestionsPath] = useState<string | null>(null);
  const [answerPath, setAnswerPath] = useState<string | null>(null);
  const upload = useUploadFile();
  const { create } = useAssignmentActions();
  const { data: existing = [], isLoading: listLoading } = useCourseAssignments(
    activeCourseId || undefined,
  );
  const list = useMemo(
    () =>
      existing.filter((a) => ((a as { kind?: string }).kind ?? "homework") === kind),
    [existing, kind],
  );

  const uploadImage = (file: File, which: "q" | "a") => {
    if (!file.type.startsWith("image/") && !file.type.includes("pdf")) {
      toast.error("ارفع صورة أو PDF");
      return;
    }
    upload.mutate(
      { file, context: "assignment", relatedId: activeCourseId || undefined },
      {
        onSuccess: (row) => {
          if (which === "q") setQuestionsPath(row.storage_path);
          else setAnswerPath(row.storage_path);
          toast.success(which === "q" ? "تم رفع صورة الأسئلة" : "تم رفع صورة الإجابة");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الرفع"),
      },
    );
  };

  const publish = () => {
    if (!activeCourseId) {
      toast.error("اختَر الدورة");
      return;
    }
    if (!activeSectionId) {
      toast.error("اختَر الوحدة");
      return;
    }
    if (!name.trim()) {
      toast.error("اكتب اسم " + (isExam ? "الامتحان" : "الواجب"));
      return;
    }
    if (!questionsPath) {
      toast.error("ارفع صورة الأسئلة");
      return;
    }
    if (!answerPath) {
      toast.error("ارفع صورة الإجابة");
      return;
    }
    const unitTitle = units.find((u) => u.id === activeSectionId)?.title ?? "وحدة";
    create.mutate(
      {
        course_id: activeCourseId,
        title: name.trim(),
        description: `الوحدة: ${unitTitle}`,
        kind,
        file_url: questionsPath,
        answer_key_url: answerPath,
        // نص مرجعي بسيط للتصحيح الذكي عند غياب OCR
        answer_key_text: `نموذج إجابة مرفق كصورة للوحدة «${unitTitle}». قارن إجابة الطالب بالمحتوى المتوقع للوحدة.`,
        max_score: 100,
      } as any,
      {
        onSuccess: () => {
          toast.success(isExam ? "تم نشر الامتحان للطلاب" : "تم نشر الواجب للطلاب");
          setName("");
          setQuestionsPath(null);
          setAnswerPath(null);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر النشر"),
      },
    );
  };

  if (rolesLoading || isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingState label="جاري التحميل…" />
      </div>
    );
  }
  if (!isTeacher && !isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-muted-foreground">
        الصفحة للمدرّسين فقط.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
      <Link
        to="/teacher"
        className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="h-3.5 w-3.5" /> رجوع للوحة المدرّس
      </Link>
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        اختَر الوحدة، اكتب الاسم، ارفع صورة الأسئلة وصورة الإجابة.
      </p>

      {courses.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">لا توجد دورات مربوطة بحسابك.</p>
      ) : (
        <div className="mt-6 space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
          {/* الدورة */}
          <div>
            <Label className="mb-1.5 block">الدورة</Label>
            <select
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-bold"
              value={activeCourseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setSectionId("");
              }}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* الوحدة */}
          <div>
            <Label className="mb-1.5 block">الوحدة</Label>
            {contentLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : units.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد وحدات في هذه الدورة. أضف وحدة من إدارة الدورة أولًا.</p>
            ) : (
              <select
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-bold"
                value={activeSectionId}
                onChange={(e) => setSectionId(e.target.value)}
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* الاسم */}
          <div>
            <Label className="mb-1.5 block">{isExam ? "اسم الامتحان" : "اسم الواجب"}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isExam ? "مثلاً: امتحان الوحدة الأولى" : "مثلاً: واجب الوحدة الأولى"}
              className="rounded-xl"
            />
          </div>

          {/* رفع الأسئلة */}
          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <p className="mb-2 text-sm font-extrabold">صورة الأسئلة (تظهر للطالب)</p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold hover:bg-accent">
              {questionsPath ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
              {questionsPath ? "تم الرفع ✓ — تغيير" : "رفع صورة الأسئلة"}
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage(f, "q");
                }}
              />
            </label>
          </div>

          {/* رفع الإجابة */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="mb-2 text-sm font-extrabold">صورة الإجابة (للذكاء الاصطناعي فقط)</p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold hover:bg-accent">
              {answerPath ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {answerPath ? "تم الرفع ✓ — تغيير" : "رفع صورة الإجابة"}
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage(f, "a");
                }}
              />
            </label>
            <p className="mt-2 text-[11px] text-muted-foreground">لا تظهر للطالب.</p>
          </div>

          <Button
            className="w-full gap-2 bg-gradient-gold py-6 text-base font-extrabold text-primary-foreground shadow-gold"
            disabled={create.isPending || upload.isPending || !units.length}
            onClick={publish}
          >
            {create.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {isExam ? "نشر الامتحان" : "نشر الواجب"}
          </Button>
        </div>
      )}

      {/* قائمة المنشورة */}
      {activeCourseId && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-extrabold text-muted-foreground">
            {isExam ? "امتحانات منشورة" : "واجبات منشورة"}
          </h2>
          {listLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد شيء منشور بعد.</p>
          ) : (
            <ul className="space-y-2">
              {list.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-bold"
                >
                  {a.title}
                  {a.description ? (
                    <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                      {a.description}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
