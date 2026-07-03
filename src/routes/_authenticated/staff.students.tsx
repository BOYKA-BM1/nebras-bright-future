import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Loader2, Users, Search, Phone, MessageSquare, User as UserIcon, BookOpen, CheckCircle2, Award, Calendar,
} from "lucide-react";
import { useStudents, useStudentDetail, type StudentRow } from "@/hooks/use-staff";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/staff/students")({
  component: StudentsPage,
});

const LEVEL_LABEL: Record<string, string> = {
  primary: "ابتدائي",
  preparatory: "إعدادي",
  secondary: "ثانوي",
};

function StudentsPage() {
  const { data: students = [], isLoading } = useStudents();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<StudentRow | null>(null);

  const filtered = students.filter(
    (s) =>
      (s.full_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (s.phone ?? "").includes(q) ||
      (s.whatsapp ?? "").includes(q),
  );

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">بيانات الطلاب</h1>
          <p className="text-sm text-muted-foreground">كل بيانات الطلاب والدورات والدرجات ({students.length}).</p>
        </div>
      </div>

      <div className="relative mt-6 max-w-sm">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث بالاسم أو رقم الهاتف..."
          className="w-full rounded-xl border border-input bg-background/60 px-10 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      {isLoading ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-right text-sm">
            <thead className="bg-card/60 text-muted-foreground">
              <tr>
                <th className="p-3 font-bold">الطالب</th>
                <th className="p-3 font-bold">الهاتف</th>
                <th className="p-3 font-bold">واتساب</th>
                <th className="p-3 font-bold">المرحلة / السنة</th>
                <th className="p-3 font-bold">الدورات</th>
                <th className="p-3 font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-border/60 hover:bg-accent/40">
                  <td className="p-3 font-semibold">{s.full_name ?? "—"}</td>
                  <td className="p-3 text-muted-foreground" dir="ltr">{s.phone ?? "—"}</td>
                  <td className="p-3 text-muted-foreground" dir="ltr">{s.whatsapp ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">
                    {s.level ? LEVEL_LABEL[s.level] ?? s.level : "—"} {s.grade ? `• ${s.grade}` : ""}
                  </td>
                  <td className="p-3">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{s.enrollments}</span>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => setSelected(s)}
                      className="rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10"
                    >
                      التفاصيل
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">لا يوجد طلاب مطابقين.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <StudentDialog student={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function StudentDialog({ student, onClose }: { student: StudentRow | null; onClose: () => void }) {
  const { data, isLoading } = useStudentDetail(student?.id ?? null);

  return (
    <Dialog open={!!student} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-primary" /> {student?.full_name ?? "الطالب"}
          </DialogTitle>
        </DialogHeader>

        {student && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info icon={Phone} label="الهاتف" value={student.phone} />
              <Info icon={MessageSquare} label="واتساب" value={student.whatsapp} />
              <Info icon={Phone} label="هاتف ولي الأمر" value={student.parent_phone} />
              <Info icon={Calendar} label="تاريخ الميلاد" value={student.birthdate} />
              <Info icon={BookOpen} label="المرحلة" value={student.level ? LEVEL_LABEL[student.level] ?? student.level : null} />
              <Info icon={Award} label="السنة" value={student.grade} />
            </div>

            {isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <>
                <section>
                  <h3 className="mb-2 text-sm font-extrabold">الدورات المشترك فيها</h3>
                  {data && data.courses.length > 0 ? (
                    <div className="space-y-2">
                      {data.courses.map((c) => {
                        const pct = c.lessonsTotal ? Math.round((c.lessonsCompleted / c.lessonsTotal) * 100) : 0;
                        return (
                          <div key={c.courseId} className="rounded-xl border border-border bg-card/60 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold">{c.title}</span>
                              <span className="text-xs text-muted-foreground">{c.teacherName}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                              حضر {c.lessonsCompleted} من {c.lessonsTotal} درس ({pct}%)
                              {c.code && <span className="ml-auto rounded bg-secondary px-2 py-0.5 font-mono">{c.code}</span>}
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                              <div className="h-full rounded-full bg-gradient-gold" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">لا يوجد اشتراكات.</p>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-extrabold">الامتحانات والدرجات</h3>
                  {data && data.attempts.length > 0 ? (
                    <div className="space-y-2">
                      {data.attempts.map((a) => (
                        <div key={a.id} className="flex items-center justify-between rounded-xl border border-border bg-card/60 p-3 text-sm">
                          <div>
                            <p className="font-bold">{a.quizTitle}</p>
                            <p className="text-xs text-muted-foreground">{a.courseTitle}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${a.score / (a.total || 1) >= 0.5 ? "bg-green-500/15 text-green-500" : "bg-destructive/15 text-destructive"}`}>
                            {a.score} / {a.total}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">لم يخض أي امتحان بعد.</p>
                  )}
                </section>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1 font-bold" dir={label.includes("هاتف") || label === "واتساب" ? "ltr" : undefined}>{value || "—"}</div>
    </div>
  );
}
