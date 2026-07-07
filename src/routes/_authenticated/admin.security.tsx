import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Loader2,
  ShieldAlert,
  ScrollText,
  MapPin,
  MonitorSmartphone,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/security")({
  component: SecurityPage,
});

type AlertRow = {
  id: string;
  user_id: string | null;
  type: string;
  severity: string;
  message: string;
  resolved: boolean;
  created_at: string;
  profiles?: { full_name: string | null } | null;
};

type AuditRow = {
  id: string;
  user_id: string | null;
  action: string;
  entity: string | null;
  ip: string | null;
  created_at: string;
  profiles?: { full_name: string | null } | null;
};

const ACTION_LABELS: Record<string, string> = {
  login: "تسجيل دخول",
  password_change: "تغيير كلمة المرور",
  ai_chat: "استخدام المساعد الذكي",
  file_extract: "استخراج ملف",
  course_purchase_request: "طلب شراء دورة",
  account_sharing_detected: "اشتباه مشاركة حساب",
  delete: "حذف بيانات",
};

function actionLabel(a: string): string {
  return ACTION_LABELS[a] ?? a;
}

function fmt(d: string): string {
  return new Date(d).toLocaleString("ar-EG");
}

async function fetchNames(ids: (string | null)[]): Promise<Record<string, string | null>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (unique.length === 0) return {};
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", unique);
  const map: Record<string, string | null> = {};
  for (const p of (data ?? []) as { id: string; full_name: string | null }[]) {
    map[p.id] = p.full_name;
  }
  return map;
}

function SecurityPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"alerts" | "audit">("alerts");
  const [actionFilter, setActionFilter] = useState<string>("");

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ["security-alerts"],
    queryFn: async (): Promise<AlertRow[]> => {
      const { data, error } = await supabase
        .from("security_alerts")
        .select("id, user_id, type, severity, message, resolved, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (data ?? []) as AlertRow[];
      const names = await fetchNames(rows.map((r) => r.user_id));
      return rows.map((r) => ({ ...r, profiles: { full_name: names[r.user_id ?? ""] ?? null } }));
    },
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["audit-logs", actionFilter],
    queryFn: async (): Promise<AuditRow[]> => {
      let q = supabase
        .from("audit_logs")
        .select("id, user_id, action, entity, ip, created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (actionFilter) q = q.eq("action", actionFilter);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as AuditRow[];
      const names = await fetchNames(rows.map((r) => r.user_id));
      return rows.map((r) => ({ ...r, profiles: { full_name: names[r.user_id ?? ""] ?? null } }));
    },
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("security_alerts")
        .update({ resolved: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تعليم التنبيه كمحلول.");
      qc.invalidateQueries({ queryKey: ["security-alerts"] });
    },
    onError: () => toast.error("تعذّر تحديث التنبيه."),
  });

  const openAlerts = alerts.filter((a) => !a.resolved).length;

  return (
    <div>
      <h1 className="text-2xl font-extrabold sm:text-3xl">
        مركز <span className="text-gradient-gold">الأمان</span>
      </h1>
      <p className="mt-2 text-muted-foreground">
        متابعة تنبيهات مشاركة الحسابات وسجل كل الأحداث المهمة على المنصة.
      </p>

      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setTab("alerts")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
            tab === "alerts"
              ? "bg-gradient-gold text-primary-foreground shadow-gold"
              : "bg-secondary text-muted-foreground hover:bg-accent"
          }`}
        >
          <ShieldAlert className="h-4 w-4" /> التنبيهات
          {openAlerts > 0 && (
            <span className="rounded-full bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground">
              {openAlerts}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("audit")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
            tab === "audit"
              ? "bg-gradient-gold text-primary-foreground shadow-gold"
              : "bg-secondary text-muted-foreground hover:bg-accent"
          }`}
        >
          <ScrollText className="h-4 w-4" /> سجل التدقيق
        </button>
      </div>

      {tab === "alerts" ? (
        alertsLoading ? (
          <div className="mt-10 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            مفيش تنبيهات أمنية — كله تمام ✅
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {alerts.map((a) => (
              <div
                key={a.id}
                className={`rounded-2xl border p-4 shadow-card ${
                  a.resolved ? "border-border bg-card opacity-70" : "border-destructive/40 bg-destructive/5"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                      {a.type === "impossible_travel" ? (
                        <MapPin className="h-5 w-5" />
                      ) : (
                        <MonitorSmartphone className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold">{a.profiles?.full_name ?? "طالب"}</p>
                      <p className="text-sm text-muted-foreground">{a.message}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{fmt(a.created_at)}</p>
                    </div>
                  </div>
                  {!a.resolved && (
                    <button
                      onClick={() => resolve.mutate(a.id)}
                      disabled={resolve.isPending}
                      className="flex shrink-0 items-center gap-1.5 rounded-xl border border-primary/40 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" /> تم الحل
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="mt-6 flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-xl border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">كل الأحداث</option>
              {Object.keys(ACTION_LABELS).map((k) => (
                <option key={k} value={k}>
                  {ACTION_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          {logsLoading ? (
            <div className="mt-10 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
              مفيش سجلّات لسه.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[640px] text-right text-sm">
                <thead className="bg-secondary/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-bold">الحدث</th>
                    <th className="px-4 py-3 font-bold">المستخدم</th>
                    <th className="px-4 py-3 font-bold">العنصر</th>
                    <th className="px-4 py-3 font-bold">IP</th>
                    <th className="px-4 py-3 font-bold">الوقت</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-4 py-3 font-semibold">{actionLabel(l.action)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{l.profiles?.full_name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{l.entity ?? "—"}</td>
                      <td dir="ltr" className="px-4 py-3 text-muted-foreground">{l.ip ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmt(l.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
