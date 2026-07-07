import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, Loader2, Star, UserPlus, KeyRound, CheckCircle2, Copy, Upload, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useTeachers, useTeacherAdmin, useUploadImage } from "@/hooks/use-catalog";
import { resolveImage, type Teacher } from "@/lib/catalog";
import { createTeacherAccount } from "@/lib/teacher-admin.functions";
import { stages } from "@/data/site";

export const Route = createFileRoute("/_authenticated/admin/teachers")({
  component: AdminTeachers,
});

type FormState = {
  name: string;
  subject: string;
  stage: string;
  grade: string;
  bio: string;
  experience_years: string;
  image_url: string;
  rating: string;
  profit_percentage: string;
  sort_order: string;
  user_id: string;
};

const empty: FormState = {
  name: "",
  subject: "",
  stage: "",
  grade: "",
  bio: "",
  experience_years: "0",
  image_url: "",
  rating: "5.0",
  profit_percentage: "50",
  sort_order: "0",
  user_id: "",
};


type AcctState = { name: string; subject: string; stage: string; grade: string; email: string; password: string; bio: string; image_url: string };
const emptyAcct: AcctState = { name: "", subject: "", stage: "", grade: "", email: "", password: "", bio: "", image_url: "" };

/** صفوف المرحلة المختارة */
function gradesForStage(stageId: string): readonly string[] {
  return stages.find((s) => s.id === stageId)?.grades ?? [];
}

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function AdminTeachers() {
  const { data: teachers = [], isLoading } = useTeachers();
  const { create, update, remove } = useTeacherAdmin();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [toDelete, setToDelete] = useState<Teacher | null>(null);
  const uploadImage = useUploadImage();
  const fileRef = useRef<HTMLInputElement>(null);
  const acctFileRef = useRef<HTMLInputElement>(null);

  // إنشاء حساب مدرّس
  const callCreateAccount = useServerFn(createTeacherAccount);
  const [acctOpen, setAcctOpen] = useState(false);
  const [acct, setAcct] = useState<AcctState>(emptyAcct);
  const [acctBusy, setAcctBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setA = (k: keyof AcctState, v: string) => setAcct((a) => ({ ...a, [k]: v }));

  const uploadTo = async (file: File | undefined, apply: (url: string) => void) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("اختر ملف صورة."); return; }
    try {
      const url = await uploadImage.mutateAsync(file);
      apply(url);
      toast.success("تم رفع الصورة.");
    } catch {
      toast.error("تعذّر رفع الصورة، حاول تاني.");
    }
  };


  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (t: Teacher) => {
    setEditing(t);
    setForm({
      name: t.name,
      subject: t.subject,
      stage: (t as any).stage ?? "",
      grade: (t as any).grade ?? "",
      bio: t.bio ?? "",
      experience_years: String(t.experience_years),
      image_url: t.image_url ?? "",
      rating: String(t.rating),
      profit_percentage: String((t as any).profit_percentage ?? 50),
      sort_order: String(t.sort_order),
      user_id: t.user_id ?? "",
    });
    setOpen(true);
  };

  const openAccount = () => {
    setAcct({ ...emptyAcct, password: genPassword() });
    setCreated(null);
    setAcctOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.subject.trim()) {
      toast.error("الاسم والمادة مطلوبان.");
      return;
    }
    if (!form.image_url.trim()) {
      toast.error("صورة المدرّس مطلوبة.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      subject: form.subject.trim(),
      stage: form.stage || null,
      grade: form.grade || null,
      bio: form.bio.trim() || null,
      experience_years: Number(form.experience_years) || 0,
      image_url: form.image_url.trim() || null,
      rating: Number(form.rating) || 5,
      profit_percentage: Math.min(100, Math.max(0, Number(form.profit_percentage) || 0)),
      sort_order: Number(form.sort_order) || 0,
      user_id: form.user_id.trim() || null,
    };

    const onErr = () => toast.error("حصل خطأ، حاول تاني.");
    if (editing) {
      update.mutate(
        { id: editing.id, ...payload },
        { onSuccess: () => { toast.success("تم تحديث المدرّس."); setOpen(false); }, onError: onErr },
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => { toast.success("تمت إضافة المدرّس."); setOpen(false); },
        onError: onErr,
      });
    }
  };

  const handleCreateAccount = async () => {
    if (!acct.name.trim() || !acct.subject.trim() || !acct.stage || !acct.grade || !acct.email.trim() || acct.password.length < 8) {
      toast.error("الاسم والمادة والمرحلة والسنة والبريد وكلمة مرور (8 أحرف فأكثر) مطلوبة.");
      return;
    }
    if (!acct.image_url.trim()) {
      toast.error("صورة المدرّس مطلوبة.");
      return;
    }
    setAcctBusy(true);
    try {
      await callCreateAccount({
        data: {
          email: acct.email.trim(),
          password: acct.password,
          name: acct.name.trim(),
          subject: acct.subject.trim(),
          stage: acct.stage,
          grade: acct.grade,
          bio: acct.bio.trim() || null,
          image_url: acct.image_url.trim() || null,
        },
      });
      setCreated({ email: acct.email.trim(), password: acct.password });
      toast.success("تم إنشاء حساب المدرّس بنجاح 🎉");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إنشاء الحساب.");
    } finally {
      setAcctBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">المدرّسون</h1>
          <p className="mt-1 text-muted-foreground">{teachers.length} مدرّس</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openAccount} className="gap-2 bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
            <UserPlus className="h-4 w-4" />
            إنشاء حساب مدرّس
          </Button>
          <Button onClick={openCreate} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            إضافة سجل فقط
          </Button>
        </div>
      </div>

      <p className="mt-3 rounded-xl border border-border bg-card/50 p-3 text-sm text-muted-foreground">
        💡 «إنشاء حساب مدرّس» ينشئ حساب دخول بالبريد وكلمة المرور ويفتح للمدرّس لوحته مباشرة بعد تسجيل الدخول. «إضافة سجل فقط» بيضيف بيانات عرض بدون حساب دخول.
      </p>

      {isLoading ? (
        <div className="mt-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teachers.map((t) => {
            const img = resolveImage(t.image_url);
            return (
              <div key={t.id} className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-card">
                {img ? (
                  <img src={img} alt={t.name} className="h-16 w-16 shrink-0 rounded-full border-2 border-primary/40 object-cover" />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/15 text-2xl font-extrabold text-primary">
                    {t.name.trim().charAt(0)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold">{t.name}</h3>
                  <p className="text-sm text-primary">{t.subject}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Star className="h-3.5 w-3.5 fill-primary text-primary" /> {t.rating}
                    <span>· {t.experience_years} سنة خبرة</span>
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs">
                    {t.user_id ? (
                      <span className="flex items-center gap-1 text-primary"><CheckCircle2 className="h-3.5 w-3.5" /> له حساب دخول</span>
                    ) : (
                      <span className="text-muted-foreground">بدون حساب دخول</span>
                    )}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => openEdit(t)} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-accent">
                      <Pencil className="h-3.5 w-3.5" /> تعديل
                    </button>
                    <button onClick={() => setToDelete(t)} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" /> حذف
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* تعديل/إضافة سجل */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل المدرّس" : "إضافة سجل مدرّس"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label="الاسم"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="أ. محمد علي" /></Field>
            <Field label="المادة"><Input value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="الرياضيات" /></Field>
            <StageGradeFields
              stage={form.stage}
              grade={form.grade}
              onStage={(v) => setForm((f) => ({ ...f, stage: v, grade: "" }))}
              onGrade={(v) => set("grade", v)}
            />
            <Field label="النبذة التعريفية"><Textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={3} /></Field>
            <Field label="صورة المدرّس (مطلوبة)">
              <div className="flex items-center gap-3">
                {form.image_url ? (
                  <img src={form.image_url} alt="" className="h-16 w-16 shrink-0 rounded-full border-2 border-primary/40 object-cover" />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
                    <ImageIcon className="h-6 w-6" />
                  </span>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; uploadTo(f, (u) => set("image_url", u)); }} className="hidden" />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploadImage.isPending} className="gap-2">
                  {uploadImage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {form.image_url ? "تغيير الصورة" : "تحميل صورة"}
                </Button>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="سنوات الخبرة"><Input type="number" value={form.experience_years} onChange={(e) => set("experience_years", e.target.value)} /></Field>
              <Field label="التقييم (من 5)"><Input type="number" step="0.1" value={form.rating} onChange={(e) => set("rating", e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="نسبة ربح المدرّس (%)"><Input type="number" min="0" max="100" value={form.profit_percentage} onChange={(e) => set("profit_percentage", e.target.value)} placeholder="50" /></Field>
              <Field label="الترتيب"><Input type="number" value={form.sort_order} onChange={(e) => set("sort_order", e.target.value)} /></Field>
            </div>
            <p className="rounded-xl border border-border bg-card/50 p-3 text-xs text-muted-foreground">
              💡 عدد الطلاب بيتحسب تلقائيًا من الطلاب المشتركين فعليًا في دورات المدرّس.
            </p>


            <Field label="معرّف حساب المدرّس (User ID) — لربط لوحة المدرّس"><Input value={form.user_id} onChange={(e) => set("user_id", e.target.value)} placeholder="UUID من صفحة المستخدمين" dir="ltr" /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={create.isPending || update.isPending} className="gap-2 bg-gradient-gold text-primary-foreground">
              {(create.isPending || update.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* إنشاء حساب مدرّس */}
      <Dialog open={acctOpen} onOpenChange={setAcctOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> إنشاء حساب مدرّس</DialogTitle>
            <DialogDescription>
              ادخل بيانات المدرّس وحدّد بريده وكلمة مروره، وهيقدر يسجّل دخوله وتفتح له لوحته مباشرة.
            </DialogDescription>
          </DialogHeader>

          {created ? (
            <div className="grid gap-4 py-2">
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm">
                <p className="flex items-center gap-2 font-bold text-primary"><CheckCircle2 className="h-4 w-4" /> تم إنشاء الحساب</p>
                <p className="mt-2 text-muted-foreground">سلّم بيانات الدخول للمدرّس — هيستخدمها في صفحة تسجيل الدخول.</p>
              </div>
              <CopyRow label="البريد الإلكتروني" value={created.email} />
              <CopyRow label="كلمة المرور" value={created.password} />
              <DialogFooter>
                <Button onClick={() => setAcctOpen(false)} className="bg-gradient-gold text-primary-foreground">تم</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="grid gap-4 py-2">
                <Field label="الاسم"><Input value={acct.name} onChange={(e) => setA("name", e.target.value)} placeholder="أ. محمد علي" /></Field>
                <Field label="المادة"><Input value={acct.subject} onChange={(e) => setA("subject", e.target.value)} placeholder="الرياضيات" /></Field>
                <StageGradeFields
                  stage={acct.stage}
                  grade={acct.grade}
                  onStage={(v) => setAcct((a) => ({ ...a, stage: v, grade: "" }))}
                  onGrade={(v) => setA("grade", v)}
                />
                <Field label="البريد الإلكتروني"><Input type="email" value={acct.email} onChange={(e) => setA("email", e.target.value)} placeholder="teacher@example.com" dir="ltr" /></Field>
                <Field label="كلمة المرور">
                  <div className="flex gap-2">
                    <Input value={acct.password} onChange={(e) => setA("password", e.target.value)} dir="ltr" />
                    <Button type="button" variant="outline" onClick={() => setA("password", genPassword())}>توليد</Button>
                  </div>
                </Field>
                <Field label="النبذة (اختياري)"><Textarea value={acct.bio} onChange={(e) => setA("bio", e.target.value)} rows={2} /></Field>
                <Field label="صورة المدرّس (مطلوبة)">
                  <div className="flex items-center gap-3">
                    {acct.image_url ? (
                      <img src={acct.image_url} alt="" className="h-16 w-16 shrink-0 rounded-full border-2 border-primary/40 object-cover" />
                    ) : (
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
                        <ImageIcon className="h-6 w-6" />
                      </span>
                    )}
                    <input ref={acctFileRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; uploadTo(f, (u) => setA("image_url", u)); }} className="hidden" />
                    <Button type="button" variant="outline" onClick={() => acctFileRef.current?.click()} disabled={uploadImage.isPending} className="gap-2">
                      {uploadImage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {acct.image_url ? "تغيير الصورة" : "تحميل صورة"}
                    </Button>
                  </div>
                </Field>

              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAcctOpen(false)}>إلغاء</Button>
                <Button onClick={handleCreateAccount} disabled={acctBusy} className="gap-2 bg-gradient-gold text-primary-foreground">
                  {acctBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                  إنشاء الحساب
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المدرّس؟</AlertDialogTitle>
            <AlertDialogDescription>
              هتحذف «{toDelete?.name}». الدورات المرتبطة هتفضل موجودة بدون مدرّس.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!toDelete) return;
                remove.mutate(toDelete.id, {
                  onSuccess: () => toast.success("تم حذف المدرّس."),
                  onError: () => toast.error("تعذّر الحذف."),
                });
                setToDelete(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
        <code className="flex-1 truncate text-sm" dir="ltr">{value}</code>
        <button
          onClick={() => { navigator.clipboard.writeText(value); toast.success("تم النسخ"); }}
          className="rounded-lg p-1.5 hover:bg-accent"
          title="نسخ"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
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

const selectCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 disabled:opacity-50";

function StageGradeFields({
  stage,
  grade,
  onStage,
  onGrade,
}: {
  stage: string;
  grade: string;
  onStage: (v: string) => void;
  onGrade: (v: string) => void;
}) {
  const grades = gradesForStage(stage);
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="المرحلة">
        <select className={selectCls} value={stage} onChange={(e) => onStage(e.target.value)}>
          <option value="">اختر المرحلة</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </Field>
      <Field label="السنة الدراسية">
        <select className={selectCls} value={grade} onChange={(e) => onGrade(e.target.value)} disabled={!stage}>
          <option value="">{stage ? "اختر السنة" : "اختر المرحلة أولًا"}</option>
          {grades.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </Field>
    </div>
  );
}

