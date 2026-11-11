import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, ChevronRight, Plus, ClipboardList, Users, CheckCircle2, Clock, XCircle, Upload, FileQuestion } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCourse } from "@/hooks/use-content";
import {
  useCourseAssignments, useAssignmentActions, useAssignmentSubmissions, useGradeSubmission,
  type Assignment,
} from "@/hooks/use-assignments";
import { useFileDownloadUrl, useUploadFile } from "@/hooks/use-files";

export const Route = createFileRoute("/_authenticated/manage/$courseId/assignments")({
  component: CourseAssignments,
});

function CourseAssignments() {
  const { courseId } = Route.useParams();
  const { data: course } = useCourse(courseId);
  const { data: assignments = [], isLoading } = useCourseAssignments(courseId);
  const [openAssignment, setOpenAssignment] = useState<Assignment | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-end px-4 py-3 sm:px-6">
          <Link to="/manage/$courseId" params={{ courseId }} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent">
            <ChevronRight className="h-4 w-4" /> رجوع لإدارة الدورة
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">الواجبات والامتحانات</p>
            <h1 className="text-2xl font-extrabold sm:text-3xl">{course?.title ?? "..."}</h1>
          </div>
          <CreateAssignmentDialog courseId={courseId} />
        </div>

        {isLoading ? (
          <div className="mt-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : assignments.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">لسه معملتش أي واجب لهذه الدورة.</div>
        ) : (
          <div className="mt-6 grid gap-3">
            {assignments.map((a) => (
              <button
                key={a.id}
                onClick={() => setOpenAssignment(a)}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 text-right shadow-card hover:bg-accent"
              >
                <div>
                  <p className="font-extrabold">{a.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.due_at ? `يسلّم قبل ${new Date(a.due_at).toLocaleDateString("ar-EG")}` : "بدون موعد نهائي"} · الدرجة الكاملة {a.max_score}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${a.status === "open" ? "bg-green-500/15 text-green-500" : "bg-secondary text-muted-foreground"}`}>
                  {a.status === "open" ? "مفتوح" : "مُغلق"}
                </span>
              </button>
            ))}
          </div>
        )}
      </main>

      {openAssignment && <SubmissionsDialog assignment={openAssignment} onClose={() => setOpenAssignment(null)} />}
    </div>
  );
}

function CreateAssignmentDialog({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"homework" | "exam">("homework");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [answerKeyText, setAnswerKeyText] = useState("");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [answerKeyPath, setAnswerKeyPath] = useState<string | null>(null);
  const [unlockAfter, setUnlockAfter] = useState(true);
  const { create } = useAssignmentActions();
  const upload = useUploadFile();

  const uploadOne = (file: File, which: "task" | "key") => {
    upload.mutate(
      { file, context: "assignment" as any, relatedId: courseId },
      {
        onSuccess: (row: any) => {
          const path = row?.storage_path ?? null;
          if (!path) {
            toast.error("تعذّر حفظ الملف");
            return;
          }
          if (which === "task") setFilePath(path);
          else setAnswerKeyPath(path);
          toast.success(which === "task" ? "تم رفع ملف الواجب" : "تم رفع نموذج الإجابة");
        },
        onError: () => toast.error("تعذّر رفع الملف"),
      },
    );
  };

  const submit = () => {
    if (!title.trim()) {
      toast.error("اكتب العنوان.");
      return;
    }
    if (!answerKeyText.trim() && !answerKeyPath) {
      toast.error("ارفع نموذج الإجابة أو اكتبه نصًا — مطلوب للتصحيح الذكي.");
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
        answer_key_text: answerKeyText.trim() || null,
        unlock_after_lesson: unlockAfter,
      } as any,
      {
        onSuccess: () => {
          toast.success(kind === "exam" ? "تم إنشاء الامتحان ✅" : "تم إنشاء الواجب ✅");
          setOpen(false);
          setTitle("");
          setDescription("");
          setDueAt("");
          setMaxScore("100");
          setAnswerKeyText("");
          setFilePath(null);
          setAnswerKeyPath(null);
          setKind("homework");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الإنشاء."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-gradient-gold text-primary-foreground shadow-gold">
          <Plus className="h-4 w-4" /> واجب / امتحان
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>رفع واجب أو امتحان</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKind("homework")}
              className={`rounded-xl border px-3 py-2 text-sm font-bold ${kind === "homework" ? "border-primary bg-primary/15 text-primary" : "border-border"}`}
            >
              <ClipboardList className="mb-1 inline h-4 w-4" /> واجب
            </button>
            <button
              type="button"
              onClick={() => setKind("exam")}
              className={`rounded-xl border px-3 py-2 text-sm font-bold ${kind === "exam" ? "border-primary bg-primary/15 text-primary" : "border-border"}`}
            >
              <FileQuestion className="mb-1 inline h-4 w-4" /> امتحان
            </button>
          </div>
          <div>
            <Label>العنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: تمارين الوحدة الأولى" />
          </div>
          <div>
            <Label>وصف للطلاب</Label>
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

          <div className="rounded-xl border border-border/60 bg-secondary/30 p-3">
            <p className="mb-2 text-sm font-bold">1) رفع ملف {kind === "exam" ? "الامتحان" : "الواجب"} للطلاب</p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold hover:bg-accent">
              <Upload className="h-4 w-4" />
              {filePath ? "تم الرفع ✓ — تغيير الملف" : "اختيار ملف"}
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
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
            <p className="mb-2 text-sm font-bold">2) رفع نموذج الإجابة (للذكاء الاصطناعي)</p>
            <Textarea
              value={answerKeyText}
              onChange={(e) => setAnswerKeyText(e.target.value)}
              rows={4}
              placeholder="اكتب نموذج الإجابة هنا بوضوح… كل نقطة أو حل نموذجي"
            />
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold hover:bg-accent">
              <Upload className="h-4 w-4" />
              {answerKeyPath ? "تم رفع ملف النموذج ✓" : "أو ارفع ملف نموذج الإجابة"}
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
              التصحيح الذكي يعتمد أساسًا على النص. الملف اختياري للأرشيف.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={unlockAfter} onChange={(e) => setUnlockAfter(e.target.checked)} />
            يظهر للطالب بعد مشاهدة دروس الدورة
          </label>
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

function SubmissionsDialog({ assignment, onClose }: { assignment: Assignment; onClose: () => void }) {
  const { data: submissions = [], isLoading } = useAssignmentSubmissions(assignment.id);
  const { update } = useAssignmentActions();
  const grade = useGradeSubmission();
  const [scores, setScores] = useState<Record<string, string>>({});

  const toggleStatus = () => {
    update.mutate(
      { id: assignment.id, courseId: assignment.course_id, status: assignment.status === "open" ? "closed" : "open" },
      { onSuccess: () => toast.success(assignment.status === "open" ? "تم إغلاق الواجب" : "تم إعادة فتح الواجب") },
    );
  };

  const submitGrade = (submissionId: string) => {
    const score = Number(scores[submissionId]);
    if (Number.isNaN(score)) { toast.error("اكتب درجة صحيحة."); return; }
    grade.mutate(
      { id: submissionId, assignmentId: assignment.id, score },
      { onSuccess: () => toast.success("تم حفظ الدرجة ✅"), onError: () => toast.error("تعذّر الحفظ.") },
    );
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" /> {assignment.title}</span>
            <Button size="sm" variant="outline" onClick={toggleStatus} className="gap-1.5">
              {assignment.status === "open" ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {assignment.status === "open" ? "إغلاق الواجب" : "إعادة فتح"}
            </Button>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : submissions.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            <Users className="h-4 w-4" /> لا يوجد تسليمات حتى الآن.
          </p>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => (
              <div key={s.id} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">{s.studentName}</p>
                  <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    s.status === "graded" ? "bg-green-500/15 text-green-500" : s.status === "late" ? "bg-destructive/15 text-destructive" : "bg-blue-500/15 text-blue-400"
                  }`}>
                    {s.status === "graded" ? <CheckCircle2 className="h-3 w-3" /> : s.status === "late" ? <Clock className="h-3 w-3" /> : null}
                    {s.status === "graded" ? "تم التصحيح" : s.status === "late" ? "متأخر" : "مُسلَّم"}
                  </span>
                </div>
                {s.note && <p className="mt-2 text-sm text-muted-foreground">{s.note}</p>}
                {s.file_url && <SubmissionFileLink filePath={s.file_url} />}
                <div className="mt-3 flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder={s.score != null ? String(s.score) : `الدرجة من ${assignment.max_score}`}
                    value={scores[s.id] ?? ""}
                    onChange={(e) => setScores({ ...scores, [s.id]: e.target.value })}
                    className="w-32"
                  />
                  <Button size="sm" onClick={() => submitGrade(s.id)} disabled={grade.isPending}>حفظ الدرجة</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * الملفات المرفوعة عن طريق نظام الملفات الموحّد بتتخزّن كـstorage_path (مش رابط مباشر)،
 * فبنولّد رابط تنزيل مؤقّت وقت الطلب — وده بيتحقق فعليًا من RLS قبل ما يصدر أي رابط.
 * لسه بندعم الروابط القديمة (اللي كانت بتتلصق كنص خام) كـfallback للتوافق.
 */
function SubmissionFileLink({ filePath }: { filePath: string }) {
  const getUrl = useFileDownloadUrl();
  const isLegacyUrl = /^https?:\/\//.test(filePath);

  if (isLegacyUrl) {
    return (
      <a href={filePath} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-primary hover:underline">
        عرض الملف المُسلَّم
      </a>
    );
  }

  return (
    <button
      onClick={() =>
        getUrl.mutate(filePath, {
          onSuccess: (url) => window.open(url, "_blank"),
          onError: () => toast.error("تعذّر فتح الملف."),
        })
      }
      disabled={getUrl.isPending}
      className="mt-2 flex items-center gap-1.5 text-sm text-primary hover:underline disabled:opacity-60"
    >
      {getUrl.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} عرض الملف المُسلَّم
    </button>
  );
}
