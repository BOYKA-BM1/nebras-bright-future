import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Plus, ClipboardList, ChevronRight, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { getMyTeacherDashboard } from "@/lib/teacher.functions";
import {
  useCourseAssignments,
  useAssignmentActions,
  type Assignment,
} from "@/hooks/use-assignments";
import { useUploadFile } from "@/hooks/use-files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/shared/ui-states";

export const Route = createFileRoute("/_authenticated/teacher/homework")({
  component: TeacherHomeworkPage,
});

function TeacherHomeworkPage() {
  return <TeacherTaskWorkspace kind="homework" title="الواجبات" subtitle="ارفع الأسئلة للطلاب ونموذج الإجابة للتصحيح الذكي" />;
}

function TeacherTaskWorkspace({
  kind,
  title,
  subtitle,
}: {
  kind: "homework" | "exam";
  title: string;
  subtitle: string;
}) {
  const { user } = useAuth();
  const { isTeacher, isAdmin, isLoading: rolesLoading } = useRoles();
  const callDashboard = useServerFn(getMyTeacherDashboard);
  const { data: stats, isLoading } = useQuery({
    queryKey: ["my-teacher-dashboard", user?.id],
    enabled: !!user && (isTeacher || isAdmin),
    queryFn: () => callDashboard(),
  });
  const courses = stats?.courses ?? [];
  const [courseId, setCourseId] = useState<string | null>(null);
  const activeCourseId = courseId ?? courses[0]?.id ?? null;
  const { data: assignments = [], isLoading: aLoading } = useCourseAssignments(activeCourseId ?? undefined);
  const list = useMemo(
    () => assignments.filter((a) => ((a as { kind?: string }).kind ?? "homework") === kind),
    [assignments, kind],
  );
  const [createOpen, setCreateOpen] = useState(false);

  if (rolesLoading || isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingState label="جاري التحميل…" />
      </div>
    );
  }
  if (!isTeacher && !isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-muted-foreground">الصفحة للمدرّسين فقط.</p>
        <Link to="/dashboard" className="mt-4 inline-block text-primary font-bold underline">لوحتي</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/teacher" className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-3.5 w-3.5" /> رجوع للوحة المدرّس
          </Link>
          <h1 className="text-2xl font-extrabold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button
          className="gap-2 bg-gradient-gold text-primary-foreground shadow-gold"
          disabled={!activeCourseId}
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" /> {kind === "exam" ? "امتحان جديد" : "واجب جديد"}
        </Button>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          لا توجد دورات مربوطة بحسابك بعد.
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {courses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCourseId(c.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  activeCourseId === c.id
                    ? "bg-primary text-primary-foreground"
                    : "border border-border hover:bg-accent"
                }`}
              >
                {c.title}
              </button>
            ))}
          </div>

          {aLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              لا يوجد {kind === "exam" ? "امتحانات" : "واجبات"} على هذه الدورة بعد.
            </div>
          ) : (
            <ul className="space-y-3">
              {list.map((a) => (
                <li key={a.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-extrabold">{a.title}</p>
                      {a.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{a.description}</p>
                      )}
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {(a as { answer_key_text?: string | null }).answer_key_text
                          ? "نموذج إجابة ✓"
                          : "بدون نموذج إجابة نصّي"}
                        {(a as { file_url?: string | null }).file_url ? " · ملف أسئلة ✓" : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold">
                      {a.status === "open" ? "مفتوح" : "مغلق"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {activeCourseId && (
        <CreateTaskDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          courseId={activeCourseId}
          kind={kind}
        />
      )}
    </div>
  );
}

function CreateTaskDialog({
  open,
  onOpenChange,
  courseId,
  kind,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  courseId: string;
  kind: "homework" | "exam";
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [answerKeyText, setAnswerKeyText] = useState("");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [answerKeyPath, setAnswerKeyPath] = useState<string | null>(null);
  const { create } = useAssignmentActions();
  const upload = useUploadFile();

  const uploadOne = (file: File, which: "task" | "key") => {
    upload.mutate(
      { file, context: "assignment", relatedId: courseId },
      {
        onSuccess: (row) => {
          if (which === "task") setFilePath(row.storage_path);
          else setAnswerKeyPath(row.storage_path);
          toast.success(which === "task" ? "تم رفع ملف الأسئلة" : "تم رفع ملف نموذج الإجابة");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الرفع"),
      },
    );
  };

  const submit = () => {
    if (!title.trim()) {
      toast.error("اكتب العنوان");
      return;
    }
    if (!answerKeyText.trim()) {
      toast.error("اكتب نموذج الإجابة نصًا — مطلوب للتصحيح الذكي");
      return;
    }
    create.mutate(
      {
        course_id: courseId,
        title: title.trim(),
        description: description.trim() || undefined,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        max_score: Number(maxScore) || 100,
        kind,
        file_url: filePath,
        answer_key_url: answerKeyPath,
        answer_key_text: answerKeyText.trim(),
      } as any,
      {
        onSuccess: () => {
          toast.success(kind === "exam" ? "تم نشر الامتحان للطلاب" : "تم نشر الواجب للطلاب");
          onOpenChange(false);
          setTitle("");
          setDescription("");
          setDueAt("");
          setMaxScore("100");
          setAnswerKeyText("");
          setFilePath(null);
          setAnswerKeyPath(null);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر النشر"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{kind === "exam" ? "امتحان جديد" : "واجب جديد"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>العنوان (يظهر للطالب)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>تعليمات / وصف للطلاب</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>موعد التسليم</Label>
              <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            <div>
              <Label>الدرجة الكاملة</Label>
              <Input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary/40 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-extrabold">
              <ClipboardList className="h-4 w-4" /> ملف الأسئلة للطالب فقط
            </p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold hover:bg-accent">
              <Upload className="h-4 w-4" />
              {filePath ? "تم الرفع ✓" : "رفع ملف الأسئلة"}
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadOne(f, "task");
                }}
              />
            </label>
            <p className="mt-2 text-[11px] text-muted-foreground">هذا الملف يظهر للطالب. لا تضع الحل هنا.</p>
          </div>

          <div className="rounded-xl border border-primary/35 bg-primary/5 p-3">
            <p className="mb-2 text-sm font-extrabold">نموذج الإجابة (للذكاء الاصطناعي فقط)</p>
            <Textarea
              value={answerKeyText}
              onChange={(e) => setAnswerKeyText(e.target.value)}
              rows={5}
              placeholder="اكتب الحل النموذجي نقطة بنقطة…"
            />
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold hover:bg-accent">
              <Upload className="h-4 w-4" />
              {answerKeyPath ? "ملف نموذج ✓" : "ملف نموذج (اختياري)"}
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadOne(f, "key");
                }}
              />
            </label>
            <p className="mt-2 text-[11px] text-muted-foreground">
              لا يظهر للطالب. يُستخدم لمقارنة إجابة الطالب وتصحيحها فور التسليم.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={create.isPending || upload.isPending} className="gap-2">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} نشر
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { TeacherTaskWorkspace };
