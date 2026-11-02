import { useState } from "react";
import { Clock, CheckCircle2, XCircle, GraduationCap, Phone, MessageCircle, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  useTeacherApplications,
  useReviewTeacherApplication,
  type TeacherApplication,
} from "@/hooks/use-teacher-apply";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "قيد المراجعة", cls: "bg-amber-500/15 text-amber-600" },
  approved: { label: "مقبول", cls: "bg-emerald-500/15 text-emerald-600" },
  rejected: { label: "مرفوض", cls: "bg-destructive/15 text-destructive" },
};

/**
 * طلبات التقديم كمدرّس — تظهر للإدارة وخدمة العملاء.
 * الموافقة تُنشئ دور المدرّس وسجل المدرّس عبر دالة review_teacher_application.
 */
export function TeacherApplications() {
  const { data: apps = [], isLoading } = useTeacherApplications();
  const review = useReviewTeacherApplication();
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const shown = filter === "pending" ? apps.filter((a) => a.status === "pending") : apps;

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-extrabold sm:text-2xl">طلبات التقديم كمدرّس</h2>
            <p className="text-sm text-muted-foreground">راجع الطلبات ووافق أو ارفض مع ملاحظات.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("pending")}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === "pending" ? "bg-gradient-gold text-primary-foreground shadow-gold" : "border border-border hover:bg-accent"}`}
          >
            قيد المراجعة
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === "all" ? "bg-gradient-gold text-primary-foreground shadow-gold" : "border border-border hover:bg-accent"}`}
          >
            الكل ({apps.length})
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-8 flex justify-center">
          <Clock className="h-6 w-6 animate-pulse text-muted-foreground" />
        </div>
      ) : shown.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">
          لا توجد طلبات {filter === "pending" ? "قيد المراجعة" : ""} حاليًا 📭
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {shown.map((app) => (
            <ApplicationCard key={app.id} app={app} onReview={(approve, notes) => {
              review.mutate(
                { id: app.id, approve, notes },
                {
                  onSuccess: () => toast.success(approve ? "تم قبول المدرّس ✅" : "تم رفض الطلب"),
                  onError: () => toast.error("تعذّر تنفيذ المراجعة، حاول تاني."),
                },
              );
            }} busy={review.isPending} />
          ))}
        </div>
      )}
    </section>
  );
}

function ApplicationCard({
  app,
  onReview,
  busy,
}: {
  app: TeacherApplication;
  onReview: (approve: boolean, notes?: string) => void;
  busy: boolean;
}) {
  const [notes, setNotes] = useState("");
  const st = STATUS[app.status] ?? STATUS.pending;
  const decided = app.status !== "pending";

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold">{app.full_name}</h3>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {app.phone}</span>
            {app.whatsapp && (
              <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {app.whatsapp}</span>
            )}
            <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {app.subject}</span>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${st.cls}`}>{st.label}</span>
      </div>

      {app.bio && <p className="mt-3 rounded-xl bg-background/60 p-3 text-sm text-muted-foreground">{app.bio}</p>}

      {app.review_notes && decided && (
        <p className="mt-3 text-sm">
          <span className="font-bold">ملاحظات المراجعة:</span>{" "}
          <span className="text-muted-foreground">{app.review_notes}</span>
        </p>
      )}

      {!decided && (
        <div className="mt-4 space-y-2">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات (اختياري) — تظهر للمدرّس مع الرد"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={() => onReview(true, notes.trim() || undefined)}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-gradient-gold px-4 py-2 text-sm font-bold text-primary-foreground shadow-gold disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" /> قبول وفتح لوحته
            </button>
            <button
              onClick={() => onReview(false, notes.trim() || undefined)}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-bold text-destructive disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" /> رفض
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
