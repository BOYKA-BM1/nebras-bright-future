import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Database,
  BookOpen,
  Upload,
  Sparkles,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  useKnowledgeDocs,
  useKnowledgeAdmin,
  useUploadKnowledgeFile,
  type KnowledgeDoc,
} from "@/hooks/use-knowledge";
import { extractDocText } from "@/lib/knowledge.functions";
import { gradesByLevel, type Level } from "@/data/grades";
import { useTeachers } from "@/hooks/use-catalog";

export const Route = createFileRoute("/_authenticated/admin/knowledge")({
  component: AdminKnowledge,
});

const ALL = "__all__";

const stageLabel: Record<string, string> = {
  primary: "المرحلة الابتدائية",
  prep: "المرحلة الإعدادية",
  secondary: "المرحلة الثانوية",
};

type FormState = {
  title: string;
  stage: string; // "" or ALL means كل المراحل
  grade: string;
  subject: string;
  teacher_id: string; // ALL means بدون مدرّس محدد
  content: string;
  file_url: string;
};

const empty: FormState = {
  title: "",
  stage: ALL,
  grade: ALL,
  subject: "",
  teacher_id: ALL,
  content: "",
  file_url: "",
};

function AdminKnowledge() {
  const { data: docs = [], isLoading } = useKnowledgeDocs();
  const { create, update, remove } = useKnowledgeAdmin();
  const uploadFile = useUploadKnowledgeFile();
  const extract = useServerFn(extractDocText);
  const { data: teachers = [] } = useTeachers();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeDoc | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [toDelete, setToDelete] = useState<KnowledgeDoc | null>(null);
  const [extracting, setExtracting] = useState(false);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const gradeOptions =
    form.stage && form.stage !== ALL ? gradesByLevel[form.stage as Level] ?? [] : [];

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (d: KnowledgeDoc) => {
    setEditing(d);
    setForm({
      title: d.title,
      stage: d.stage ?? ALL,
      grade: d.grade ?? ALL,
      subject: d.subject ?? "",
      teacher_id: d.teacher_id ?? ALL,
      content: d.content ?? "",
      file_url: d.file_url ?? "",
    });
    setOpen(true);
  };

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (file.type && file.type !== "application/pdf") {
      toast.error("الملف لازم يكون PDF.");
      return;
    }
    try {
      const url = await uploadFile.mutateAsync(file);
      set("file_url", url);
      toast.success("تم رفع الملف. تقدر تستخرج نصه للمساعد الذكي.");
    } catch {
      toast.error("تعذّر رفع الملف، حاول تاني.");
    }
  };

  const handleExtract = async () => {
    if (!form.file_url) { toast.error("ارفع ملف PDF الأول."); return; }
    setExtracting(true);
    try {
      const { text } = await extract({ data: { url: form.file_url } });
      setForm((f) => ({ ...f, content: (f.content ? f.content + "\n\n" : "") + text }));
      toast.success("تم استخراج نص الكتاب وإضافته للمحتوى ✨");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر استخراج النص.");
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = () => {
    if (!form.title.trim()) { toast.error("عنوان الكتاب/المذكرة مطلوب."); return; }
    if (!form.content.trim() && !form.file_url) {
      toast.error("اكتب المحتوى أو ارفع ملف واستخرج نصه.");
      return;
    }
    const teacher = teachers.find((t) => t.id === form.teacher_id);
    const payload = {
      title: form.title.trim(),
      stage: form.stage === ALL ? null : form.stage,
      grade: form.grade === ALL ? null : form.grade,
      subject: form.subject.trim() || teacher?.subject || null,
      teacher_id: form.teacher_id === ALL ? null : form.teacher_id,
      teacher_name: teacher?.name || null,
      content: form.content.trim(),
      file_url: form.file_url || null,
    };
    const onErr = () => toast.error("حصل خطأ، حاول تاني.");
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, {
        onSuccess: () => { toast.success("تم التحديث."); setOpen(false); },
        onError: onErr,
      });
    } else {
      create.mutate(payload, {
        onSuccess: () => { toast.success("تمت الإضافة لقاعدة المعرفة."); setOpen(false); },
        onError: onErr,
      });
    }
  };

  const scopeText = (d: KnowledgeDoc) => {
    const parts: string[] = [];
    parts.push(d.stage ? stageLabel[d.stage] ?? d.stage : "كل المراحل");
    if (d.grade) parts.push(d.grade);
    if (d.subject) parts.push(d.subject);
    if (d.teacher_name) parts.push(`أ/ ${d.teacher_name}`);
    return parts.join(" · ");
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
            <Database className="h-6 w-6 text-primary" />
            قاعدة معرفة <span className="text-gradient-gold">الذكاء الاصطناعي</span>
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            هنا بتتحكم بالكامل في المعلومات اللي المساعد الذكي بياخد منها إجاباته. ضيف كتب ومذكرات
            لكل مرحلة وصف دراسي، وعدّل أو احذف أي معلومة في أي وقت ({docs.length}).
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
          <Plus className="h-4 w-4" /> إضافة كتاب / مذكرة
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : docs.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          مفيش كتب أو مذكرات في قاعدة المعرفة لسه. ابدأ بإضافة أول كتاب.
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => (
            <div key={d.id} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold">
                  <BookOpen className="h-5 w-5" />
                </span>
                {d.file_url && (
                  <a
                    href={d.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-bold text-muted-foreground hover:bg-accent"
                  >
                    <FileText className="h-3.5 w-3.5" /> الملف
                  </a>
                )}
              </div>
              <h3 className="mt-4 font-bold">{d.title}</h3>
              <span className="mt-1 text-xs font-semibold text-primary">{scopeText(d)}</span>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                {d.content || "— بدون نص، ملف مرفق فقط —"}
              </p>
              <div className="mt-4 flex gap-2">
                <button onClick={() => openEdit(d)} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-accent">
                  <Pencil className="h-3.5 w-3.5" /> تعديل
                </button>
                <button onClick={() => setToDelete(d)} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" /> حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل المعلومة" : "إضافة كتاب / مذكرة"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label="العنوان">
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="مثال: مذكرة الجبر — الوحدة الأولى" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="المرحلة">
                <Select value={form.stage} onValueChange={(v) => setForm((f) => ({ ...f, stage: v, grade: ALL }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>كل المراحل</SelectItem>
                    <SelectItem value="primary">المرحلة الابتدائية</SelectItem>
                    <SelectItem value="prep">المرحلة الإعدادية</SelectItem>
                    <SelectItem value="secondary">المرحلة الثانوية</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="الصف الدراسي">
                <Select value={form.grade} onValueChange={(v) => set("grade", v)} disabled={gradeOptions.length === 0}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>كل الصفوف</SelectItem>
                    {gradeOptions.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="مدرّس المادة">
              <Select
                value={form.teacher_id}
                onValueChange={(v) => {
                  const t = teachers.find((x) => x.id === v);
                  setForm((f) => ({
                    ...f,
                    teacher_id: v,
                    // نملأ المادة تلقائيًا من المدرّس لو المادة فاضية
                    subject: f.subject.trim() ? f.subject : t?.subject ?? "",
                  }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="اختر المدرّس المسؤول" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>بدون مدرّس محدد</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{t.subject ? ` — ${t.subject}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                لما تختار المدرّس، المساعد الذكي هيعرف إنه هو مدرّس المادة دي ويقدر يقول اسمه لو الطالب سأل.
              </p>
            </Field>

            <Field label="المادة (اختياري)">
              <Input value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="رياضيات / علوم / لغة عربية..." />
            </Field>


            <div className="rounded-xl border border-dashed border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-accent">
                  {uploadFile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  رفع ملف PDF
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                </label>
                {form.file_url && (
                  <>
                    <a href={form.file_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary hover:underline">
                      عرض الملف المرفوع
                    </a>
                    <button
                      type="button"
                      onClick={handleExtract}
                      disabled={extracting}
                      className="flex items-center gap-1.5 rounded-lg bg-gradient-gold px-3 py-2 text-xs font-bold text-primary-foreground shadow-gold disabled:opacity-60"
                    >
                      {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      استخراج النص للمساعد
                    </button>
                  </>
                )}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                ارفع الكتاب PDF ثم اضغط «استخراج النص» علشان المساعد يقدر يقرأه، أو اكتب المحتوى يدويًا تحت.
              </p>
            </div>

            <Field label="المحتوى / النص الذي يستخدمه المساعد">
              <Textarea
                value={form.content}
                onChange={(e) => set("content", e.target.value)}
                rows={10}
                placeholder="اكتب أو الصق هنا نص المذكرة/الكتاب الذي سيعتمد عليه المساعد الذكي في إجاباته..."
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={create.isPending || update.isPending} className="gap-2 bg-gradient-gold text-primary-foreground">
              {(create.isPending || update.isPending) && <Loader2 className="h-4 w-4 animate-spin" />} حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف من قاعدة المعرفة؟</AlertDialogTitle>
            <AlertDialogDescription>
              هتحذف «{toDelete?.title}» نهائيًا، ومش هيقدر المساعد الذكي يستخدمه بعد كده.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!toDelete) return;
                remove.mutate(toDelete.id, {
                  onSuccess: () => toast.success("تم الحذف."),
                  onError: () => toast.error("تعذّر الحذف."),
                });
                setToDelete(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
