import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Bookmark, LogOut, BookOpen, Video } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { useAuth } from "@/hooks/use-auth";
import { useMyBookmarks } from "@/hooks/use-bookmarks";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/bookmarks")({
  component: MyBookmarksPage,
});

function MyBookmarksPage() {
  const { confirmSignOut } = useAuth();
  const navigate = useNavigate();
  const { data: bookmarks = [], isLoading } = useMyBookmarks();
  const [titles, setTitles] = useState<Record<string, { title: string; courseId?: string }>>({});

  useEffect(() => {
    const lessonIds = bookmarks.filter((b) => b.target_type === "lesson").map((b) => b.target_id);
    const courseIds = bookmarks.filter((b) => b.target_type === "course").map((b) => b.target_id);
    (async () => {
      const map: Record<string, { title: string; courseId?: string }> = {};
      if (lessonIds.length) {
        const { data } = await supabase.from("lessons").select("id, title, course_id").in("id", lessonIds);
        for (const l of data ?? []) map[l.id] = { title: l.title, courseId: l.course_id };
      }
      if (courseIds.length) {
        const { data } = await supabase.from("courses").select("id, title").in("id", courseIds);
        for (const c of data ?? []) map[c.id] = { title: c.title };
      }
      setTitles(map);
    })();
  }, [bookmarks]);

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
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bookmark className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">المفضّلة</h1>
            <p className="text-sm text-muted-foreground">الدروس والدورات اللي حفظتها.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : bookmarks.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">لسه معندكش حاجة في المفضّلة.</div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {bookmarks.map((b) => {
              const info = titles[b.target_id];
              const link = b.target_type === "course" ? `/learn/${b.target_id}` : `/learn/${info?.courseId ?? ""}`;
              return (
                <Link key={b.id} to={link} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card hover:bg-accent">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {b.target_type === "course" ? <BookOpen className="h-4.5 w-4.5" /> : <Video className="h-4.5 w-4.5" />}
                  </span>
                  <p className="truncate font-bold">{info?.title ?? "..."}</p>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
