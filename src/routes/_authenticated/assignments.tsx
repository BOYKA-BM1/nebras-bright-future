import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, ClipboardList, Upload, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  useMyAssignments, useMySubmission, useSubmitAssignment, type Assignment,
} from "@/hooks/use-assignments";
import { useUploadFile } from "@/hooks/use-files";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState, EmptyState } from "@/components/shared/ui-states";

export const Route = createFileRoute("/_authenticated/assignments")({
  component: StudentHomeworkPage,
});

function StudentHomeworkPage() {
  const { data: all = [], isLoading } = useMyAssignments();
  const list = useMemo(
    () => all.filter((a) => (a as { kind?: string }).kind !== "exam"),
    [all],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-extrabold">واجباتي</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        واجبات دوراتك — سلّم إجابتك للتصحيح الذكي الفوري.
      </p>
      <div className="mt-6">
        {isLoading ? (
          <LoadingState label="جاري التحميل…" />
        ) : list.length === 0 ? (
          <EmptyState
            title="لا توجد واجبات الآن"
            description="لما المدرّس ينشر واجب على دوراتك هيظهر هنا."
          />
        ) : (
          <div className="space-y-4">
            {list.map((a) => (
              <HomeworkCard key={a.id} assignment={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HomeworkCard({ assignment }: { assignment: Assignment & { courseTitle?: string } }) {
  const { data: submission, isLoading } = useMySubmission(assignment.id);
  const submit = useSubmitAssignment();
  const upload = useUploadFile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState(submission?.note ?? "");
  const [filePath, setFilePath] = useState<string | null>(submission?.file_url ?? null);
  const [lastGrade, setLastGrade] = useState<{ score: number; feedback: string; maxScore: number } | null>(null);
  const maxScore = Number(assignment.max_score) || 100;
  const score = lastGrade?.score ?? submission?.score;
  const feedback = lastGrade?.feedback ?? submission?.feedback;

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <span className="inline-flex rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">واجب</span>
      <h2 className="mt-1 text-lg font-extrabold">{assignment.title}</h2>
      <p className="text-xs text-muted-foreground">{assignment.courseTitle ?? "دورة"}</p>
      {assignment.description && <p className="mt-3 text-sm text-muted-foreground">{assignment.description}</p>}
      {isLoading ? (
        <Loader2 className="mt-4 h-5 w-5 animate-spin text-primary" />
      ) : (
        <div className="mt-4 space-y-3">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="اكتب إجابتك…" />
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              upload.mutate({ file: f, context: "assignment_submission", relatedId: assignment.id }, {
                onSuccess: (row) => { setFilePath(row.storage_path); toast.success("تم رفع الملف"); },
                onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الرفع"),
              });
            }} />
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> {filePath ? "ملف ✓" : "إرفاق"}
            </Button>
            <Button type="button" size="sm" className="gap-1.5" disabled={submit.isPending} onClick={() => {
              if (!note.trim()) { toast.error("اكتب إجابتك نصًا"); return; }
              submit.mutate({ assignmentId: assignment.id, note: note.trim(), fileUrl: filePath, autoGrade: true }, {
                onSuccess: (res: { grade?: { score: number; feedback: string; maxScore: number } }) => {
                  if (res?.grade) { setLastGrade(res.grade); toast.success(`النتيجة: ${res.grade.score}/${res.grade.maxScore}`); }
                  else toast.success("تم التسليم");
                },
                onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر"),
              });
            }}>
              {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} تسليم وتصحيح
            </Button>
          </div>
          {feedback != null && feedback !== "" && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
              <p className="font-extrabold text-primary flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> النتيجة: {score ?? "—"} / {maxScore}</p>
              <pre className="mt-2 whitespace-pre-wrap text-xs">{feedback}</pre>
            </div>
          )}
          {submission && !feedback && (
            <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> تم التسليم</p>
          )}
        </div>
      )}
    </article>
  );
}
