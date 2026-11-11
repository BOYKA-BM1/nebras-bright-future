import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Loader2, ClipboardList, FileQuestion, Upload, CheckCircle2, AlertCircle, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  useMyAssignments, useMySubmission, useSubmitAssignment, type Assignment,
} from "@/hooks/use-assignments";
import { useUploadFile } from "@/hooks/use-files";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState, EmptyState } from "@/components/shared/ui-states";

export const Route = createFileRoute("/_authenticated/assignments")({
  component: StudentAssignmentsPage,
});

function StudentAssignmentsPage() {
  const { data: all = [], isLoading } = useMyAssignments();
  const [tab, setTab] = useState<"homework" | "exam">("homework");

  const filtered = useMemo(() => {
    return all.filter((a) => {
      const k = (a as any).kind ?? "homework";
      return tab === "exam" ? k === "exam" : k !== "exam";
    });
  }, [all, tab]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold">واجباتي وامتحاناتي</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          سلّم إجابتك نصًا (وملف إن حابب) — التصحيح الذكي يظهر فورًا مع ذكر الأخطاء.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => setTab("homework")}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${
            tab === "homework" ? "bg-primary text-primary-foreground shadow" : "hover:bg-accent"
          }`}
        >
          <ClipboardList className="h-4 w-4" /> الواجبات
        </button>
        <button
          type="button"
          onClick={() => setTab("exam")}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${
            tab === "exam" ? "bg-primary text-primary-foreground shadow" : "hover:bg-accent"
          }`}
        >
          <FileQuestion className="h-4 w-4" /> الامتحانات
        </button>
      </div>

      {isLoading ? (
        <LoadingState label="جاري التحميل…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={tab === "exam" ? "لا توجد امتحانات الآن" : "لا توجد واجبات الآن"}
          description="لما المدرّس ينشر واجب أو امتحان على دوراتك هيظهر هنا."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((a) => (
            <AssignmentCard key={a.id} assignment={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssignmentCard({ assignment }: { assignment: Assignment & { courseTitle?: string } }) {
  const { data: submission, isLoading } = useMySubmission(assignment.id);
  const submit = useSubmitAssignment();
  const upload = useUploadFile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState(submission?.note ?? "");
  const [filePath, setFilePath] = useState<string | null>(submission?.file_url ?? null);
  const [lastGrade, setLastGrade] = useState<{ score: number; feedback: string; maxScore: number } | null>(null);

  const kind = (assignment as any).kind === "exam" ? "exam" : "homework";
  const maxScore = Number(assignment.max_score) || 100;
  const graded = submission?.status === "graded" || lastGrade != null;
  const score = lastGrade?.score ?? submission?.score;
  const feedback = lastGrade?.feedback ?? submission?.feedback;

  const onPickFile = (file: File) => {
    upload.mutate(
      { file, context: "assignment_submission", relatedId: assignment.id },
      {
        onSuccess: (row) => {
          setFilePath(row.storage_path);
          toast.success("تم رفع الملف");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الرفع"),
      },
    );
  };

  const onSubmit = () => {
    if (!note.trim() && !filePath) {
      toast.error("اكتب إجابتك أو ارفع ملفًا.");
      return;
    }
    if (!note.trim()) {
      toast.error("اكتب ملخص إجابتك نصًا ليتم التصحيح الذكي.");
      return;
    }
    submit.mutate(
      { assignmentId: assignment.id, note: note.trim(), fileUrl: filePath, autoGrade: true },
      {
        onSuccess: (res: any) => {
          if (res?.grade) {
            setLastGrade(res.grade);
            toast.success(`النتيجة: ${res.grade.score} / ${res.grade.maxScore}`);
          } else {
            toast.success("تم التسليم — التصحيح الآلي غير متاح حاليًا.");
          }
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر التسليم"),
      },
    );
  };

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
            kind === "exam" ? "bg-violet-500/15 text-violet-400" : "bg-primary/15 text-primary"
          }`}>
            {kind === "exam" ? "امتحان" : "واجب"}
          </span>
          <h2 className="mt-1 text-lg font-extrabold">{assignment.title}</h2>
          <p className="text-xs text-muted-foreground">{assignment.courseTitle ?? "دورة"}</p>
        </div>
        {assignment.due_at && (
          <p className="text-xs font-bold text-muted-foreground">
            التسليم: {new Date(assignment.due_at).toLocaleString("ar-EG")}
          </p>
        )}
      </div>

      {assignment.description && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{assignment.description}</p>
      )}

      {isLoading ? (
        <Loader2 className="mt-4 h-5 w-5 animate-spin text-primary" />
      ) : (
        <div className="mt-4 space-y-3">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="اكتب إجابتك هنا بوضوح…"
            disabled={graded && submission?.status === "graded"}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickFile(f);
              }}
            />
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {filePath ? "ملف مرفق ✓" : "إرفاق ملف"}
            </Button>
            <Button type="button" size="sm" className="gap-1.5" onClick={onSubmit} disabled={submit.isPending}>
              {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              تسليم وتصحيح ذكي
            </Button>
          </div>

          {(graded || feedback) && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-sm font-extrabold text-primary">
                <CheckCircle2 className="h-4 w-4" />
                النتيجة: {score != null ? `${score} / ${maxScore}` : "—"}
              </div>
              {feedback && (
                <pre className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">{feedback}</pre>
              )}
            </div>
          )}

          {!graded && submission && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5" /> تم التسليم سابقًا — تقدر تعدّل وتعيد الإرسال.
            </p>
          )}
        </div>
      )}
    </article>
  );
}
