import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Percent, Wallet, Users, ChevronDown, TrendingUp } from "lucide-react";
import { useFinance, type TeacherEarning } from "@/hooks/use-finance";

export const Route = createFileRoute("/_authenticated/admin/earnings")({
  component: EarningsPage,
});

const money = (n: number) => `${n.toLocaleString("ar-EG")} ج.م`;

function EarningsPage() {
  const { data: finance, isLoading } = useFinance();
  const [open, setOpen] = useState<string | null>(null);

  const teachers = finance?.teachers ?? [];
  const totalIncome = teachers.reduce((s, t) => s + t.income, 0);
  const totalProfit = finance?.teacherProfitTotal ?? 0;
  const platformShare = totalIncome - totalProfit;

  return (
    <div>
      <h1 className="text-2xl font-extrabold sm:text-3xl">
        دخل <span className="text-gradient-gold">المدرّسين</span>
      </h1>
      <p className="mt-2 text-muted-foreground">
        إجمالي دخل كل مدرّس ونسبة أرباحه. اضغط على أي مدرّس لعرض التفاصيل حسب كل دورة.
      </p>

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
            <TeacherRow key={t.id} t={t} open={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TeacherRow({ t, open, onToggle }: { t: TeacherEarning; open: boolean; onToggle: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <button onClick={onToggle} className="flex w-full items-center gap-4 p-4 text-right hover:bg-accent/40">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary font-bold">
          {t.image_url ? <img src={t.image_url} alt={t.name} className="h-full w-full object-cover" /> : t.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
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
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

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
