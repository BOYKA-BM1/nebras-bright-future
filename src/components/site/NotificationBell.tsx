import { Bell, CheckCheck, BellOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useNotifications,
  useNotificationActions,
  type AppNotification,
} from "@/hooks/use-notifications";

const TYPE_ICON: Record<string, string> = {
  montage: "🎬",
  course: "📚",
  exam: "📝",
  assignment: "📋",
  payment: "💳",
  attendance: "🔴",
  admin: "📌",
  system: "⚙️",
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

export function NotificationBell() {
  const { data: notifications = [], isLoading } = useNotifications();
  const { markRead, markAllRead } = useNotificationActions();
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleClick = (n: AppNotification) => {
    if (!n.is_read) markRead.mutate(n.id);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label="الإشعارات"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -start-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-extrabold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border p-0 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border/60 bg-card px-4 py-3">
          <div>
            <p className="text-sm font-extrabold">الإشعارات</p>
            {unreadCount > 0 ? (
              <p className="text-[11px] text-muted-foreground">{unreadCount} غير مقروء</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">كل شيء محدّث</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-primary transition hover:bg-primary/10"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              قراءة الكل
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto bg-background/40">
          {isLoading ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">جاري التحميل…</div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-muted-foreground">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <BellOff className="h-6 w-6" />
              </span>
              <p className="text-sm font-bold text-foreground">لا يوجد إشعارات</p>
              <p className="text-xs">هتظهر هنا تنبيهات الدورات والدفع والواجبات.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <a
                key={n.id}
                href={n.link || "/notifications"}
                onClick={() => handleClick(n)}
                className={`flex gap-3 border-b border-border/40 px-4 py-3 text-start transition-colors hover:bg-accent ${
                  n.is_read ? "opacity-80" : "bg-primary/5"
                }`}
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-base">
                  {TYPE_ICON[n.type] ?? "🔔"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold leading-snug">{n.title}</p>
                    {!n.is_read && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                    )}
                  </div>
                  {n.body ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</p>
                </div>
              </a>
            ))
          )}
        </div>

        <a
          href="/notifications"
          className="block border-t border-border/60 bg-card px-4 py-2.5 text-center text-sm font-bold text-primary transition hover:bg-accent"
        >
          عرض كل الإشعارات
        </a>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
