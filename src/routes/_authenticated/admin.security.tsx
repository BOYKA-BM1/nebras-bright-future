import { maskEmail, displayIp, displayEmail } from "@/lib/mask";
import { useRoles } from "@/hooks/use-roles";
import { useServerFn } from "@tanstack/react-start";
import { listAuditLogs } from "@/lib/security-admin.functions";
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
  const { isFullAdmin } = useRoles();
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

  const fetchAuditLogs = useServerFn(listAuditLogs);
  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["audit-logs", actionFilter],
    queryFn: async (): Promise<AuditRow[]> => {
      const rows = await fetchAuditLogs({
        data: { actionFilter: actionFilter || null, limit: 300 },
      });
      return rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        action: r.action,
        entity: r.entity,
        ip: r.ip,
        created_at: r.created_at,
        profiles: { full_name: r.full_name },
      }));
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
                      <td dir="ltr" className="px-4 py-3 text-muted-foreground">{l.ip ?? "غير متاح"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmt(l.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <ContentProtectionEventsPanel />
    </div>
  );
}


function ContentProtectionEventsPanel() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["content-protection-events", status, page],
    queryFn: async () => {
      let query = (supabase as any).from("content_protection_events")
        .select(
          "id, user_id, course_id, lesson_id, event_type, detection_method, confidence, review_status, created_at, session_note",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (status !== "all") query = query.eq("review_status", status);
      const { data, error, count } = await query;
      if (error) throw error;
      const rows = data ?? [];
      const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
      const courseIds = [...new Set(rows.map((r: any) => r.course_id).filter(Boolean))];
      const names: Record<string, string> = {};
      const courses: Record<string, string> = {};
      if (userIds.length) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        for (const p of profiles ?? []) names[p.id] = p.full_name ?? "—";
      }
      if (courseIds.length) {
        const { data: cs } = await supabase.from("courses").select("id, title").in("id", courseIds);
        for (const c of cs ?? []) courses[c.id] = c.title ?? "—";
      }
      return { rows, count: count ?? rows.length, names, courses };
    },
  });

  const markReviewed = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("content_protection_events")
        .update({ review_status: "reviewed" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-protection-events"] }),
  });

  const rows = (data?.rows ?? []).filter((e: any) => {
    if (!q.trim()) return true;
    const name = data?.names?.[e.user_id] ?? "";
    return name.includes(q) || String(e.user_id).includes(q) || String(e.event_type).includes(q);
  });

  return (
    <section className="mt-10">
      <h2 className="text-xl font-extrabold">حماية المحتوى والأحداث الأمنية</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        إشارات متصفح غير حاسمة (PrintScreen / إخفاء تبويب / طباعة). ليست إثباتًا قاطعًا على لقط شاشة، ولا تُستخدم وحدها لعقوبة تلقائية.
        لا يوجد مسار Native مؤكد في هذا المشروع؛ قيم <span className="font-mono">confirmed_native</span> غير مقبولة من المتصفح.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث بالاسم أو المعرف…"
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">كل الحالات</option>
          <option value="pending">قيد المراجعة</option>
          <option value="reviewed">تمت المراجعة</option>
          <option value="dismissed">مُستبعد</option>
        </select>
      </div>
      {isLoading ? (
        <div className="mt-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : isError ? (
        <p className="mt-6 text-sm text-destructive">تعذّر تحميل الأحداث. تأكد من تطبيق migration الحماية.</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">لا توجد أحداث مطابقة.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[860px] text-right text-sm">
            <thead className="bg-secondary/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">الطالب</th>
                <th className="px-3 py-2">الدورة</th>
                <th className="px-3 py-2">النوع</th>
                <th className="px-3 py-2">المصدر</th>
                <th className="px-3 py-2">الثقة</th>
                <th className="px-3 py-2">الوقت</th>
                <th className="px-3 py-2">الحالة</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e: any) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-semibold">{data?.names?.[e.user_id] ?? "—"}</div>
                    <div className="font-mono text-[10px] text-muted-foreground" dir="ltr">{String(e.user_id).slice(0, 8)}…</div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{e.course_id ? (data?.courses?.[e.course_id] ?? "—") : "—"}</td>
                  <td className="px-3 py-2 font-semibold">{e.event_type}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                      إشارة متصفح
                    </span>
                  </td>
                  <td className="px-3 py-2">{e.confidence}</td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(e.created_at).toLocaleString("ar-EG")}</td>
                  <td className="px-3 py-2">{e.review_status}</td>
                  <td className="px-3 py-2">
                    {e.review_status === "pending" && (
                      <button
                        type="button"
                        className="rounded-lg border border-border px-2 py-1 text-xs font-bold hover:bg-accent"
                        onClick={() => markReviewed.mutate(e.id)}
                      >
                        تمت المراجعة
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <button type="button" disabled={page === 0} className="rounded-lg border px-2 py-1 disabled:opacity-40" onClick={() => setPage((p) => Math.max(0, p - 1))}>السابق</button>
        <span>صفحة {page + 1}</span>
        <button type="button" className="rounded-lg border px-2 py-1" onClick={() => setPage((p) => p + 1)}>التالي</button>
      </div>
    </section>
  );
}
