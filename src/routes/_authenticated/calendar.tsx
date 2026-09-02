import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, CalendarDays, ClipboardList, Radio, FileQuestion, BookOpen, LogOut } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { NotificationBell } from "@/components/site/NotificationBell";
import { useAuth } from "@/hooks/use-auth";
import { useCalendarEvents, type CalendarEvent } from "@/hooks/use-calendar";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

const TYPE_META: Record<CalendarEvent["type"], { icon: typeof ClipboardList; label: string; cls: string }> = {
  assignment: { icon: ClipboardList, label: "موعد تسليم واجب", cls: "bg-orange-500/15 text-orange-400" },
  live: { icon: Radio, label: "بث مباشر", cls: "bg-red-500/15 text-red-400" },
  exam: { icon: FileQuestion, label: "اختبار", cls: "bg-purple-500/15 text-purple-400" },
  lesson: { icon: BookOpen, label: "درس جديد", cls: "bg-green-500/15 text-green-500" },
};

function CalendarPage() {
  const { confirmSignOut } = useAuth();
  const navigate = useNavigate();
  const { data: events = [], isLoading } = useCalendarEvents();

  const groups = events.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    const key = new Date(e.date).toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    (acc[key] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button onClick={() => confirmSignOut(() => navigate({ to: "/" }))} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">المواعيد</h1>
            <p className="text-sm text-muted-foreground">كل الواجبات والبثوث والاختبارات القادمة في مكان واحد.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : events.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">لا يوجد مواعيد قادمة حاليًا.</div>
        ) : (
          <div className="mt-6 space-y-6">
            {Object.entries(groups).map(([day, dayEvents]) => (
              <div key={day}>
                <p className="mb-2 text-sm font-extrabold text-muted-foreground">{day}</p>
                <div className="space-y-2">
                  {dayEvents.map((e) => {
                    const meta = TYPE_META[e.type];
                    return (
                      <Link key={e.id} to={e.link} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card hover:bg-accent">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.cls}`}>
                          <meta.icon className="h-4.5 w-4.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold">{e.title}</p>
                          <p className="text-xs text-muted-foreground">{meta.label} · {e.courseTitle}</p>
                        </div>
                        <span className="shrink-0 text-xs font-bold text-muted-foreground">
                          {new Date(e.date).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
