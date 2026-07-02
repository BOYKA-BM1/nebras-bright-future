import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Users, ChevronDown, Search } from "lucide-react";
import { useEnrollmentsDetail } from "@/hooks/use-finance";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  component: SubscriptionsPage,
});

const money = (n: number) => `${n.toLocaleString("ar-EG")} ج.م`;

function SubscriptionsPage() {
  const { data: rows = [], isLoading } = useEnrollmentsDetail();
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const total = rows.reduce((s, r) => s + r.subscribers.length, 0);
  const filtered = rows.filter((r) => r.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <h1 className="text-2xl font-extrabold sm:text-3xl">
        الاشتراكات <span className="text-gradient-gold">بالتفصيل</span>
      </h1>
      <p className="mt-2 text-muted-foreground">
        عدد المشتركين في كل دورة مع تفاصيل كل طالب ({total} اشتراك).
      </p>

      <div className="relative mt-6 max-w-sm">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم الدورة..."
          className="w-full rounded-xl border border-input bg-background/60 px-10 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">لا توجد اشتراكات بعد.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {filtered.map((r) => (
            <div key={r.courseId} className="overflow-hidden rounded-2xl border border-border bg-card">
              <button
                onClick={() => setOpen(open === r.courseId ? null : r.courseId)}
                className="flex w-full items-center gap-4 p-4 text-right hover:bg-accent/40"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Users className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{r.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {r.teacherName ?? "—"} · {money(r.price)}
                  </div>
                </div>
                <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-extrabold text-primary">
                  {r.subscribers.length} مشترك
                </span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
                    open === r.courseId ? "rotate-180" : ""
                  }`}
                />
              </button>

              {open === r.courseId && (
                <div className="overflow-x-auto border-t border-border/60 bg-background/40">
                  <table className="w-full text-right text-sm">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="p-2.5 font-bold">الطالب</th>
                        <th className="p-2.5 font-bold">رقم التواصل</th>
                        <th className="p-2.5 font-bold">كود الاشتراك</th>
                        <th className="p-2.5 font-bold">تاريخ الاشتراك</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.subscribers.map((s) => (
                        <tr key={s.userId} className="border-t border-border/60">
                          <td className="p-2.5 font-semibold">{s.name ?? "—"}</td>
                          <td className="p-2.5 text-muted-foreground">{s.phone ?? "—"}</td>
                          <td className="p-2.5">
                            <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs">{s.code ?? "—"}</span>
                          </td>
                          <td className="p-2.5 text-muted-foreground">
                            {new Date(s.enrolledAt).toLocaleDateString("ar-EG")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
