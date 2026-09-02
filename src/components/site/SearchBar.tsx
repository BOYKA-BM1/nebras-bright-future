import { useState, useRef, useEffect } from "react";
import { Search, BookOpen, Video, ClipboardList, User, Loader2, X } from "lucide-react";
import { useSearch, type SearchResult } from "@/hooks/use-search";

const KIND_META: Record<SearchResult["kind"], { icon: typeof Search; label: string }> = {
  course: { icon: BookOpen, label: "دورة" },
  lesson: { icon: Video, label: "درس" },
  assignment: { icon: ClipboardList, label: "واجب" },
  student: { icon: User, label: "طالب" },
};

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: results = [], isFetching } = useSearch(query);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="ابحث عن دورة، درس، واجب..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {isFetching ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : query ? (
          <button onClick={() => { setQuery(""); setOpen(false); }}><X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /></button>
        ) : null}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute right-0 top-full z-40 mt-2 max-h-96 w-full min-w-[280px] overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
          {results.length === 0 && !isFetching ? (
            <p className="p-4 text-center text-sm text-muted-foreground">لا يوجد نتائج لـ"{query}"</p>
          ) : (
            results.map((r) => {
              const meta = KIND_META[r.kind];
              return (
                <a
                  key={`${r.kind}-${r.id}`}
                  href={r.link}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 border-b border-border/40 px-4 py-2.5 text-right last:border-0 hover:bg-accent"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><meta.icon className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground">{meta.label}{r.subtitle ? ` · ${r.subtitle}` : ""}</p>
                  </div>
                </a>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
