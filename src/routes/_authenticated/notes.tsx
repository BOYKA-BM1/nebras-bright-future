import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, StickyNote, LogOut, Trash2 } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { useAuth } from "@/hooks/use-auth";
import { useAllMyNotes, useNoteActions } from "@/hooks/use-notes";

export const Route = createFileRoute("/_authenticated/notes")({
  component: MyNotesPage,
});

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function MyNotesPage() {
  const { confirmSignOut } = useAuth();
  const navigate = useNavigate();
  const { data: notes = [], isLoading } = useAllMyNotes();
  const { remove } = useNoteActions(undefined);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <button onClick={() => confirmSignOut(() => navigate({ to: "/" }))} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><StickyNote className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">ملاحظاتي</h1>
            <p className="text-sm text-muted-foreground">كل الملاحظات اللي كتبتها على الدروس، من كل الدورات.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : notes.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">لسه معملتش أي ملاحظات.</div>
        ) : (
          <div className="mt-6 space-y-3">
            {notes.map((n) => (
              <div key={n.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link to="/learn/$courseId" params={{ courseId: n.course_id }} className="min-w-0 flex-1">
                    <p className="truncate text-xs text-muted-foreground">{n.courseTitle} · {n.lessonTitle}{n.position_seconds != null ? ` · ${fmt(n.position_seconds)}` : ""}</p>
                    <p className="mt-1 text-sm font-bold">{n.content}</p>
                  </Link>
                  <button onClick={() => remove.mutate(n.id)} className="shrink-0 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
