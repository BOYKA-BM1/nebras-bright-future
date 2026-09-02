import { useState, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, ClipboardList, Clock, CheckCircle2, Upload, LogOut, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/site/Logo";
import { NotificationBell } from "@/components/site/NotificationBell";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { useMyAssignments, useMySubmission, useSubmitAssignment, type Assignment } from "@/hooks/use-assignments";
import { useUploadFile, type UploadedFile } from "@/hooks/use-files";

export const Route = createFileRoute("/_authenticated/assignments")({
  component: StudentAssignments,
});

function StudentAssignments() {
  const { confirmSignOut } = useAuth();
  const navigate = useNavigate();
  const { data: assignments = [], isLoading } = useMyAssignments();
  const [active, setActive] = useState<(Assignment & { courseTitle: string }) | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button onClick={() => confirmSignOut(() => navigate({ to: "/" }))} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardList className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">واجباتي</h1>
            <p className="text-sm text-muted-foreground">الواجبات المفتوحة في كل الدورات المشترك فيها.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : assignments.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">لا يوجد واجبات مفتوحة حاليًا 🎉</div>
        ) : (
          <div className="mt-6 grid gap-3">
            {assignments.map((a) => (
              <button
                key={a.id}
                onClick={() => setActive(a)}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 text-right shadow-card hover:bg-accent"
              >
                <div>
                  <p className="font-extrabold">{a.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{a.courseTitle}</p>
                </div>
                {a.due_at && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> {new Date(a.due_at).toLocaleDateString("ar-EG")}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </main>

      {active && <SubmitDialog assignment={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function SubmitDialog({ assignment, onClose }: { assignment: Assignment & { courseTitle: string }; onClose: () => void }) {
  const { data: submission, isLoading } = useMySubmission(assignment.id);
  const submit = useSubmitAssignment();
  const uploadFile = useUploadFile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [note, setNote] = useState("");

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    uploadFile.mutate(
      { file, context: "assignment_submission" },
      {
        onSuccess: (f) => { setUploadedFile(f); toast.success("تم رفع الملف ✅"); },
        onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر رفع الملف."),
      },
    );
  };

  const handleSubmit = () => {
    submit.mutate(
      { assignmentId: assignment.id, fileUrl: uploadedFile ? uploadedFile.storage_path : null, note: note.trim() || null },
      { onSuccess: () => toast.success("تم تسليم الواجب ✅"), onError: () => toast.error("تعذّر التسليم.") },
    );
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{assignment.title}</DialogTitle></DialogHeader>
        {assignment.description && <p className="text-sm text-muted-foreground">{assignment.description}</p>}

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : submission?.status === "graded" ? (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
            <p className="flex items-center gap-2 font-bold text-green-500"><CheckCircle2 className="h-4 w-4" /> تم التصحيح</p>
            <p className="mt-2 text-lg font-extrabold">{submission.score} / {assignment.max_score}</p>
            {submission.feedback && <p className="mt-2 text-sm text-muted-foreground">{submission.feedback}</p>}
          </div>
        ) : (
          <>
            {submission && (
              <p className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" /> تم تسليم الواجب، تقدر تعدّل التسليم قبل التصحيح.
              </p>
            )}
            <div className="space-y-3">
              <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="hidden" onChange={handlePickFile} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadFile.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm font-bold text-muted-foreground hover:bg-accent disabled:opacity-60"
              >
                {uploadFile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                {uploadedFile ? uploadedFile.original_filename : "إرفاق ملف (PDF, صورة, Word)"}
              </button>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة أو إجابة نصية (اختياري)" rows={4} />
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit} disabled={submit.isPending} className="gap-2 bg-gradient-gold text-primary-foreground shadow-gold">
                {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {submission ? "تحديث التسليم" : "تسليم"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
