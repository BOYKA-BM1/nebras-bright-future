import { Bell, CheckCheck, BellOff } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications, useNotificationActions, type AppNotification } from "@/hooks/use-notifications";

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

/** جرس الإشعارات — مركز إشعارات موحّد لكل أدوار المنصة (طالب / مدرّس / ولي أمر / طاقم) */
export function NotificationBell() {
  const { data: notifications = [] } = useNotifications();
  const { markRead, markAllRead } = useNotificationActions();
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleClick = (n: AppNotification) => {
    if (!n.is_read) markRead.mutate(n.id);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border hover:bg-accent"
          aria-label="الإشعارات"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -left-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-extrabold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <span className="text-sm font-extrabold">الإشعارات</span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" /> تعليم الكل كمقروء
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
              <BellOff className="h-8 w-8" />
              <p className="text-sm">لا يوجد إشعارات حتى الآن.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <a
                key={n.id}
                href={n.link || "#"}
                onClick={() => handleClick(n)}
                className={`flex gap-2.5 border-b border-border/40 px-4 py-3 text-right transition-colors hover:bg-accent ${
                  n.is_read ? "" : "bg-primary/5"
                }`}
              >
                <span className="mt-0.5 shrink-0 text-lg leading-none">{TYPE_ICON[n.type] ?? "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold">{n.title}</p>
                    {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</p>
                </div>
              </a>
            ))
          )}
        </div>
        <a href="/notifications" className="block border-t border-border/60 px-4 py-2.5 text-center text-sm font-bold text-primary hover:bg-accent">
          عرض كل الإشعارات
        </a>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
