import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Percent, Wallet, Users, ChevronDown, TrendingUp, Pencil, Briefcase, Save } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useFinance, type TeacherEarning } from "@/hooks/use-finance";
import { useTeacherAdmin } from "@/hooks/use-catalog";
import { useRoleShares, useUpdateRoleShare, SHARE_ROLES } from "@/hooks/use-role-shares";

export const Route = createFileRoute("/_authenticated/admin/earnings")({
  component: EarningsPage,
});

const money = (n: number) => `${n.toLocaleString("ar-EG")} ج.م`;

function EarningsPage() {
  const { data: finance, isLoading } = useFinance();
  const [open, setOpen] = useState<string | null>(null);
  const [editTeacher, setEditTeacher] = useState<TeacherEarning | null>(null);

  const teachers = finance?.teachers ?? [];
  const totalIncome = teachers.reduce((s, t) => s + t.income, 0);
  const totalProfit = finance?.teacherProfitTotal ?? 0;
  const platformShare = totalIncome - totalProfit;

  return (
    <div>
      <h1 className="text-2xl font-extrabold sm:text-3xl">
        دخل <span className="text-gradient-gold">المدرّسين</span> والنِّسب
      </h1>
      <p className="mt-2 text-muted-foreground">
        حدّد نسبة مكسب كل وظيفة من المنصّة، وعدّل نسبة أي مدرّس على حدة. اضغط على أي مدرّس لعرض التفاصيل.
      </p>

      <RoleSharesCard />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={Wallet} tone="gold" label="إجمالي دخل الدورات" value={money(totalIncome)} />
        <SummaryCard icon={TrendingUp} tone="green" label="إجمالي أرباح المدرّسين" value={money(totalProfit)} />
        <SummaryCard icon={Percent} tone="blue" label="نصيب المنصّة" value={money(platformShare)} />
      </div>

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : teachers.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">لا يوجد مدرّسون بعد.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {teachers.map((t) => (
            <TeacherRow
              key={t.id}
              t={t}
              open={open === t.id}
              onToggle={() => setOpen(open === t.id ? null : t.id)}
              onEdit={() => setEditTeacher(t)}
            />
          ))}
        </div>
      )}

      <EditTeacherShareDialog teacher={editTeacher} onClose={() => setEditTeacher(null)} />
    </div>
  );
}

/* ======= إدارة نسب الوظائف ======= */
function RoleSharesCard() {
  const { data: shares, isLoading } = useRoleShares();
  const updateShare = useUpdateRoleShare();
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (shares) {
      setDraft(
        Object.fromEntries(SHARE_ROLES.map((r) => [r.role, String(shares[r.role] ?? 0)])),
      );
    }
  }, [shares]);

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2 font-bold">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Briefcase className="h-4 w-4" />
        </span>
        نسبة مكسب كل وظيفة من المنصّة
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        النسبة اللي بتاخدها كل وظيفة من دخل المنصّة. غيّرها لأي رقم من 0 إلى 100%.
      </p>

      {isLoading ? (
        <div className="mt-4 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SHARE_ROLES.map((r) => (
            <div key={r.role} className="flex items-center gap-3 rounded-xl border border-border bg-background/50 p-3">
              <span className="min-w-0 flex-1 truncate font-semibold">{r.label}</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={draft[r.role] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [r.role]: e.target.value }))}
                  className="w-20 text-center"
                  dir="ltr"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <Button
                size="sm"
                disabled={updateShare.isPending}
                onClick={() =>
                  updateShare.mutate(
                    { role: r.role, percentage: Number(draft[r.role]) || 0 },
                    {
                      onSuccess: () => toast.success(`تم تحديث نسبة ${r.label} ✅`),
                      onError: () => toast.error("تعذّر الحفظ."),
                    },
                  )
                }
                className="gap-1.5 bg-gradient-gold text-primary-foreground"
              >
                <Save className="h-3.5 w-3.5" /> حفظ
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ======= تعديل نسبة مدرّس بعينه ======= */
function EditTeacherShareDialog({ teacher, onClose }: { teacher: TeacherEarning | null; onClose: () => void }) {
  const { update } = useTeacherAdmin();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (teacher) setValue(String(teacher.profit_percentage));
  }, [teacher]);

  const save = () => {
    if (!teacher) return;
    const pct = Math.min(100, Math.max(0, Number(value) || 0));
    update.mutate(
      { id: teacher.id, name: teacher.name, subject: teacher.subject ?? "", profit_percentage: pct },
      {
        onSuccess: () => { toast.success("تم تحديث نسبة المدرّس ✅"); onClose(); },
        onError: () => toast.error("تعذّر الحفظ."),
      },
    );
  };

  return (
    <Dialog open={!!teacher} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>نسبة مكسب {teacher?.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1.5 py-2">
          <Label>نسبة الربح (%)</Label>
          <div className="flex items-center gap-2">
            <Input type="number" min="0" max="100" value={value} onChange={(e) => setValue(e.target.value)} dir="ltr" />
            <span className="text-muted-foreground">%</span>
          </div>
          <p className="text-xs text-muted-foreground">دي نسبة خاصة بالمدرّس ده وبتتغلب على النسبة العامة للوظيفة.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={update.isPending} className="gap-2 bg-gradient-gold text-primary-foreground">
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TeacherRow({ t, open, onToggle, onEdit }: { t: TeacherEarning; open: boolean; onToggle: () => void; onEdit: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex w-full items-center gap-4 p-4 text-right">
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-4 hover:opacity-80">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary font-bold">
            {t.image_url ? <img src={t.image_url} alt={t.name} className="h-full w-full object-cover" /> : t.name.charAt(0)}
          </span>
          <div className="min-w-0 flex-1 text-right">
            <div className="truncate font-bold">{t.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {t.subject ?? "—"} · {t.subscribers} مشترك
            </div>
          </div>
          <div className="hidden text-center sm:block">
            <div className="text-xs text-muted-foreground">الدخل</div>
            <div className="font-extrabold">{money(t.income)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">النسبة</div>
            <div className="font-extrabold text-primary">{t.profit_percentage}%</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">الربح</div>
            <div className="font-extrabold text-green-500">{money(t.profit)}</div>
          </div>
        </button>
        <button
          onClick={onEdit}
          title="تعديل النسبة"
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-accent"
        >
          <Pencil className="h-3.5 w-3.5" /> النسبة
        </button>
        <button onClick={onToggle} className="shrink-0">
          <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>



      {open && (
        <div className="border-t border-border/60 bg-background/40 p-4">
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="إجمالي الدخل" value={money(t.income)} />
            <MiniStat label="نسبة الربح" value={`${t.profit_percentage}%`} />
            <MiniStat label="ربح المدرّس" value={money(t.profit)} />
            <MiniStat label="نصيب المنصّة" value={money(t.platformShare)} />
          </div>
          {t.courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد دورات لهذا المدرّس.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-right text-sm">
                <thead className="bg-card/60 text-muted-foreground">
                  <tr>
                    <th className="p-2.5 font-bold">الدورة</th>
                    <th className="p-2.5 font-bold">السعر</th>
                    <th className="p-2.5 font-bold">المشتركون</th>
                    <th className="p-2.5 font-bold">الدخل</th>
                    <th className="p-2.5 font-bold">ربح المدرّس</th>
                  </tr>
                </thead>
                <tbody>
                  {t.courses.map((c) => (
                    <tr key={c.id} className="border-t border-border/60">
                      <td className="p-2.5 font-semibold">{c.title}</td>
                      <td className="p-2.5 text-muted-foreground">{money(c.price)}</td>
                      <td className="p-2.5">{c.subscribers}</td>
                      <td className="p-2.5 font-bold">{money(c.income)}</td>
                      <td className="p-2.5 font-bold text-green-500">
                        {money(Math.round((c.income * t.profit_percentage) / 100))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TONES = {
  gold: "bg-gradient-gold text-primary-foreground shadow-gold",
  green: "bg-green-500/15 text-green-500",
  blue: "bg-blue-500/15 text-blue-400",
} as const;

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: keyof typeof TONES;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${TONES[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="mt-4 text-2xl font-extrabold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-extrabold">{value}</div>
    </div>
  );
}
