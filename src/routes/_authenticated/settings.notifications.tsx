import { createFileRoute } from "@tanstack/react-router";
import {
  Loader2,
  Settings,
  BookOpen,
  FileQuestion,
  ClipboardList,
  Film,
  Users,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/use-notifications";
import { useRoles } from "@/hooks/use-roles";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  component: NotificationSettings,
});

const ROWS: {
  key: "course_enabled" | "exam_enabled" | "assignment_enabled" | "montage_enabled";
  icon: typeof BookOpen;
  label: string;
  hint: string;
}[] = [
  { key: "course_enabled", icon: BookOpen, label: "إشعارات الدورات", hint: "درس جديد، شهادة إتمام" },
  { key: "exam_enabled", icon: FileQuestion, label: "إشعارات الاختبارات", hint: "نتائج الاختبارات" },
  { key: "assignment_enabled", icon: ClipboardList, label: "إشعارات الواجبات", hint: "واجب جديد، نتيجة التصحيح" },
  { key: "montage_enabled", icon: Film, label: "إشعارات المونتاج", hint: "حالة الفيديو، مراجعات" },
];

function NotificationSettings() {
  const { data: prefs, isLoading } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const { isParent } = useRoles();

  const toggle = (key: string, value: boolean) => {
    update.mutate(
      { [key]: value },
      {
        onSuccess: () => toast.success(value ? "تم التفعيل" : "تم الإيقاف"),
        onError: () => toast.error("تعذّر حفظ الإعداد. تأكد من الاتصال بـ Supabase."),
      },
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Settings className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">إعدادات الإشعارات</h1>
            <p className="text-sm text-muted-foreground">اختار الإشعارات اللي عايز تستقبلها.</p>
          </div>
        </div>

        {isLoading || !prefs ? (
          <div className="mt-10 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            {ROWS.map((r) => {
              const on = Boolean(prefs[r.key]);
              return (
                <label
                  key={r.key}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition hover:bg-accent/40"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <r.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-bold">{r.label}</p>
                      <p className="text-xs text-muted-foreground">{r.hint}</p>
                    </div>
                  </div>
                  <Switch
                    checked={on}
                    onCheckedChange={(v) => toggle(r.key, v)}
                    aria-label={r.label}
                  />
                </label>
              );
            })}

            {isParent && (
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition hover:bg-accent/40">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Users className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-bold">إشعارات أبنائي</p>
                    <p className="text-xs text-muted-foreground">تقدّم، نتائج، شهادات أبنائك المرتبطين</p>
                  </div>
                </div>
                <Switch
                  checked={Boolean(prefs.parent_digest_enabled)}
                  onCheckedChange={(v) => toggle("parent_digest_enabled", v)}
                  aria-label="إشعارات أبنائي"
                />
              </label>
            )}

            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-4 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                الإشعارات الإدارية المهمة (زي التنبيهات الأمنية والتحديثات الضرورية) بتوصل دايمًا ومش قابلة
                للإيقاف.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
