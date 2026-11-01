import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Bookmark, BookOpen } from "lucide-react";
import { useFavorites } from "@/hooks/use-content";
import { useCourses } from "@/hooks/use-catalog";
import { resolveImage } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/bookmarks")({
  component: MyBookmarksPage,
});

function MyBookmarksPage() {
  const { favoriteIds, isLoading: favLoading } = useFavorites();
  const { data: courses = [], isLoading: coursesLoading } = useCourses();
  const isLoading = favLoading || coursesLoading;

  const favCourses = courses.filter((c) => favoriteIds.has(c.id));

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bookmark className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">المفضّلة</h1>
            <p className="text-sm text-muted-foreground">الدورات اللي حفظتها من صفحة الدورة.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-10 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : favCourses.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">
            لسه معندكش دورات في المفضّلة. افتح أي دورة واضغط ❤
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {favCourses.map((c) => {
              const img = resolveImage(c.image_url);
              return (
                <Link
                  key={c.id}
                  to="/courses/$courseId"
                  params={{ courseId: c.id }}
                  className="overflow-hidden rounded-2xl border border-border bg-card shadow-card transition hover:border-primary/40"
                >
                  {img ? (
                    <img src={img} alt="" className="h-36 w-full object-cover" />
                  ) : (
                    <div className="flex h-36 items-center justify-center bg-primary/10 text-primary">
                      <BookOpen className="h-8 w-8" />
                    </div>
                  )}
                  <div className="p-4">
                    <p className="font-extrabold line-clamp-2">{c.title}</p>
                    {c.subject ? (
                      <p className="mt-1 text-xs text-muted-foreground">{c.subject}</p>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
