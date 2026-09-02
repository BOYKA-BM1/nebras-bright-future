import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Loader2, CalendarRange, BookMarked, GitPullRequestArrow, CheckCircle2, XCircle, Star } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  useEducationSystems, useBaccalaureateTracks, useAcademicYearsAdmin, useAcademicYearActions,
  useSubjectsAdmin, useSubjectActions, useTrackChangeRequestsAdmin, useReviewTrackChange,
} from "@/hooks/use-baccalaureate";
import { gradesByLevel } from "@/data/grades";

export const Route = createFileRoute("/_authenticated/admin/education")({
  component: AdminEducation,
});

type Tab = "years" | "subjects" | "requests";

function AdminEducation() {
  const [tab, setTab] = useState<Tab>("subjects");

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookMarked className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">إدارة النظام التعليمي</h1>
          <p className="text-sm text-muted-foreground">السنوات الدراسية، المواد، وطلبات تغيير المسار.</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {([
          { key: "subjects", label: "المواد", icon: BookMarked },
          { key: "years", label: "السنوات الدراسية", icon: CalendarRange },
          { key: "requests", label: "طلبات تغيير المسار", icon: GitPullRequestArrow },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              tab === t.key ? "bg-gradient-gold text-primary-foreground shadow-gold" : "border border-border hover:bg-accent"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "subjects" && <SubjectsTab />}
        {tab === "years" && <AcademicYearsTab />}
        {tab === "requests" && <TrackChangeRequestsTab />}
      </div>
    </div>
  );
}

function SubjectsTab() {
  const { data: systems = [] } = useEducationSystems();
  const { data: tracks = [] } = useBaccalaureateTracks();
  const [systemId, setSystemId] = useState<string>("");
  const { data: subjects = [], isLoading } = useSubjectsAdmin(systemId ? { educationSystemId: systemId } : undefined);
  const { create, remove } = useSubjectActions();

  const [open, setOpen] = useState(false);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [formSystemId, setFormSystemId] = useState("");
  const [grade, setGrade] = useState("");
  const [trackId, setTrackId] = useState<string>("all");

  const submit = () => {
    if (!nameAr.trim() || !formSystemId || !grade) { toast.error("املأ اسم المادة والنظام والصف."); return; }
    create.mutate(
      { name_ar: nameAr.trim(), name_en: nameEn.trim() || null, education_system_id: formSystemId, grade, track_id: trackId === "all" ? null : trackId },
      {
        onSuccess: () => { toast.success("تمت إضافة المادة ✅"); setOpen(false); setNameAr(""); setNameEn(""); },
        onError: () => toast.error("تعذّرت الإضافة."),
      },
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={systemId || "all"} onValueChange={(v) => setSystemId(v === "all" ? "" : v)}>
          <SelectTrigger className="w-60"><SelectValue placeholder="كل الأنظمة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنظمة</SelectItem>
            {systems.map((s) => <SelectItem key={s.id} value={s.id}>{s.name_ar}</SelectItem>)}
          </SelectContent>
        </Select>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-gold text-primary-foreground shadow-gold"><Plus className="h-4 w-4" /> مادة جديدة</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>مادة جديدة</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>اسم المادة (عربي)</Label><Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} /></div>
              <div><Label>الاسم بالإنجليزي (اختياري)</Label><Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" /></div>
              <div>
                <Label>النظام التعليمي</Label>
                <Select value={formSystemId} onValueChange={setFormSystemId}>
                  <SelectTrigger><SelectValue placeholder="اختر النظام" /></SelectTrigger>
                  <SelectContent>{systems.map((s) => <SelectItem key={s.id} value={s.id}>{s.name_ar}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>الصف</Label>
                <Select value={grade} onValueChange={setGrade}>
                  <SelectTrigger><SelectValue placeholder="اختر الصف" /></SelectTrigger>
                  <SelectContent>{gradesByLevel.secondary.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>المسار (اختياري — لو مادة عامة اسيبه فاضي)</Label>
                <Select value={trackId} onValueChange={setTrackId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المسارات / مادة عامة</SelectItem>
                    {tracks.map((t) => <SelectItem key={t.id} value={t.id}>{t.name_ar}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={create.isPending} className="gap-2">
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} إضافة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="mt-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : subjects.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          لا توجد مواد مُضافة بعد. المنصة لا تفترض أي مادة تلقائيًا — أضف المواد الرسمية من هنا.
        </p>
      ) : (
        <div className="mt-6 grid gap-2">
          {subjects.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
              <div>
                <p className="font-bold">{s.name_ar}</p>
                <p className="text-xs text-muted-foreground">{s.grade} {s.track_id ? "· مسار محدد" : "· كل المسارات"}</p>
              </div>
              <button onClick={() => remove.mutate(s.id)} className="text-xs font-bold text-destructive hover:underline">إلغاء تفعيل</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AcademicYearsTab() {
  const { data: years = [], isLoading } = useAcademicYearsAdmin();
  const { create, activate } = useAcademicYearActions();
  const [name, setName] = useState("");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: 2026/2027" className="w-48" dir="ltr" />
        <Button
          onClick={() => {
            if (!name.trim()) return;
            create.mutate({ name: name.trim() }, { onSuccess: () => { toast.success("تمت الإضافة"); setName(""); }, onError: () => toast.error("تعذّرت الإضافة، ربما الاسم مكرر.") });
          }}
          disabled={create.isPending}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> إضافة سنة
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="mt-6 grid gap-2">
          {years.map((y) => (
            <div key={y.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
              <span className="font-bold" dir="ltr">{y.name}</span>
              {y.is_active ? (
                <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-3 py-1 text-xs font-bold text-green-500"><Star className="h-3 w-3" /> فعّالة الآن</span>
              ) : (
                <button onClick={() => activate.mutate(y.id)} className="text-xs font-bold text-primary hover:underline">تفعيل هذه السنة</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TrackChangeRequestsTab() {
  const { data: requests = [], isLoading } = useTrackChangeRequestsAdmin("pending");
  const review = useReviewTrackChange();

  return (
    <div>
      {isLoading ? (
        <div className="mt-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : requests.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">لا توجد طلبات معلّقة حاليًا.</p>
      ) : (
        <div className="grid gap-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-xl border border-border/60 bg-card p-4">
              <p className="font-bold">{r.studentName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {r.currentTrackName ?? "بدون مسار"} ← <span className="font-bold text-foreground">{r.requestedTrackName}</span>
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => review.mutate({ requestId: r.id, approve: true })} disabled={review.isPending} className="gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> موافقة
                </Button>
                <Button size="sm" variant="outline" onClick={() => review.mutate({ requestId: r.id, approve: false })} disabled={review.isPending} className="gap-1.5 text-destructive">
                  <XCircle className="h-3.5 w-3.5" /> رفض
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
