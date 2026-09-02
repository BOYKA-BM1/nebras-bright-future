import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Loader2, Bell, BellOff, CheckCheck, LogOut, Settings } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { useAuth } from "@/hooks/use-auth";
import { useNotificationHistory, useNotificationActions, type AppNotification } from "@/hooks/use-notifications";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationHistoryPage,
});

const TYPE_ICON: Record<string, string> = {
  montage: "🎬",
  course: "📚",
  exam: "📝",
  assignment: "📋",
  payment: "💳",
  attendance: "🔴",
  admin: "📌",
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} س`;
  const days = Math.floor(hrs / 24);
  return `منذ ${days} يوم`;
}

function NotificationHistoryPage() {
  const { confirmSignOut } = useAuth();
  const navigate = useNavigate();
  const { data: notifications = [], isLoading } = useNotificationHistory(100);
  const { markRead, markAllRead } = useNotificationActions();
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleClick = (n: AppNotification) => {
    if (!n.is_read) markRead.mutate(n.id);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <button onClick={() => confirmSignOut(() => navigate({ to: "/" }))} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bell className="h-5 w-5" /></span>
            <div>
              <h1 className="text-2xl font-extrabold sm:text-3xl">كل الإشعارات</h1>
              <p className="text-sm text-muted-foreground">{unreadCount > 0 ? `${unreadCount} إشعار غير مقروء` : "كل الإشعارات مقروءة"}</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button onClick={() => markAllRead.mutate()} className="flex items-center gap-1.5 rounded-xl border border-primary/40 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/10">
              <CheckCheck className="h-4 w-4" /> تعليم الكل كمقروء
            </button>
          )}
          <Link to="/settings/notifications" className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent">
            <Settings className="h-4 w-4" /> <span className="hidden sm:inline">الإعدادات</span>
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : notifications.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">
            <BellOff className="h-8 w-8" /> لا يوجد إشعارات حتى الآن.
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            {notifications.map((n) => (
              <a
                key={n.id}
                href={n.link || "#"}
                onClick={() => handleClick(n)}
                className={`flex gap-3 rounded-2xl border p-4 transition-colors hover:bg-accent ${n.is_read ? "border-border/60 bg-card" : "border-primary/30 bg-primary/5"}`}
              >
                <span className="mt-0.5 shrink-0 text-xl leading-none">{TYPE_ICON[n.type] ?? "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">{n.title}</p>
                    {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                  {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-1.5 text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
