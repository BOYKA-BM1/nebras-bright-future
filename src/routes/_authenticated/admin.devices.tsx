import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, MonitorSmartphone, RotateCcw, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { listAccounts, resetAccountDevice } from "@/lib/admin-accounts.functions";

export const Route = createFileRoute("/_authenticated/admin/devices")({
  component: DevicesPage,
});

/** يحوّل الـ user agent لاسم جهاز مبسّط */
function deviceName(ua: string | null): string {
  if (!ua) return "جهاز";
  const os =
    /iPhone/i.test(ua) ? "آيفون" :
    /iPad/i.test(ua) ? "آيباد" :
    /Android/i.test(ua) ? "أندرويد" :
    /Windows/i.test(ua) ? "ويندوز" :
    /Mac OS/i.test(ua) ? "ماك" :
    /Linux/i.test(ua) ? "لينكس" : "جهاز";
  const browser =
    /Edg/i.test(ua) ? "Edge" :
    /Chrome/i.test(ua) ? "Chrome" :
    /Firefox/i.test(ua) ? "Firefox" :
    /Safari/i.test(ua) ? "Safari" : "متصفح";
  return `${os} · ${browser}`;
}

function DevicesPage() {
  const fetchAccounts = useServerFn(listAccounts);
  const resetDevice = useServerFn(resetAccountDevice);
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["admin-accounts"],
    queryFn: () => fetchAccounts(),
  });

  const resetDeviceM = useMutation({
    mutationFn: (a: { userId: string }) => resetDevice({ data: a }),
    onSuccess: () => {
      toast.success("تم إعادة تعيين الجهاز، يقدر يسجّل من جهاز جديد.");
      qc.invalidateQueries({ queryKey: ["admin-accounts"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "تعذّر إعادة التعيين."),
  });

  // الحسابات اللي عليها جهاز مسجّل فقط
  const withDevice = accounts.filter((a) => a.device_registered_at);
  const filtered = withDevice.filter(
    (a) =>
      a.email.toLowerCase().includes(q.toLowerCase()) ||
      (a.full_name ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <h1 className="text-2xl font-extrabold sm:text-3xl">
        الأجهزة <span className="text-gradient-gold">المسجّلة</span>
      </h1>
      <p className="mt-2 text-muted-foreground">
        كل حساب مربوط بجهاز واحد. من هنا تقدر تشوف الجهاز اللي اتسجّل بيه وتعيد تعيينه علشان الطالب
        يقدر يفتح حسابه من جهاز جديد ({withDevice.length}).
      </p>

      <div className="relative mt-6 max-w-sm">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث بالبريد أو الاسم..."
          className="w-full rounded-xl border border-input bg-background/60 px-10 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          مفيش أجهزة مسجّلة لسه.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <div key={a.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MonitorSmartphone className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold">{a.full_name ?? "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-secondary/40 p-3">
                <p className="text-sm font-semibold" title={a.device_label ?? ""}>
                  {deviceName(a.device_label)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  اتسجّل: {new Date(a.device_registered_at!).toLocaleString("ar-EG")}
                </p>
              </div>

              <button
                onClick={() => {
                  if (confirm(`إعادة تعيين جهاز ${a.email}؟ هيقدر يسجّل الدخول من جهاز جديد.`))
                    resetDeviceM.mutate({ userId: a.id });
                }}
                disabled={resetDeviceM.isPending}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary/40 px-3 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
              >
                <RotateCcw className="h-4 w-4" /> إعادة تعيين الجهاز
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
