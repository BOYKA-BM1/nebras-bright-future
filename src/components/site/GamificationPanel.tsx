import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Trophy, Loader2, Sparkles, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useMyXp, useLeaderboard } from "@/hooks/use-gamification";
import { levelInfo, levelTitle, computeBadges } from "@/lib/gamification";

export function GamificationPanel({ courses = 0 }: { courses?: number }) {
  const { user } = useAuth();
  const { data: xp = 0, isLoading: xpLoading } = useMyXp();
  const { data: board = [], isLoading: boardLoading } = useLeaderboard(10);

  const myRank = useMemo(() => board.find((r) => r.user_id === user?.id)?.rank ?? null, [board, user?.id]);
  const lv = levelInfo(xp);
  const badges = computeBadges({ xp, rank: myRank, courses });
  const earned = badges.filter((b) => b.earned);

  const fmt = (n: number) => new Intl.NumberFormat("ar-EG").format(Math.round(n));

  if (xpLoading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* المستوى والنقاط + الأوسمة */}
      <div className="lg:col-span-2 space-y-6">
        <div className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-gold text-lg font-extrabold text-primary-foreground shadow-gold">
                {lv.level}
              </span>
              <div>
                <p className="text-xs font-bold text-muted-foreground">المستوى {lv.level}</p>
                <p className="text-lg font-extrabold">{levelTitle(lv.level)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold text-gradient-gold">{fmt(xp)} XP</p>
              {myRank && <p className="text-xs text-muted-foreground">ترتيبك #{fmt(myRank)}</p>}
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>المستوى {lv.level}</span>
              <span>باقي {fmt(lv.toNext)} نقطة للمستوى {lv.level + 1}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-gradient-gold transition-all" style={{ width: `${lv.percent}%` }} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-extrabold">أوسمتي</h3>
            <span className="text-xs text-muted-foreground">({earned.length}/{badges.length})</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {badges.map((b) => (
              <div
                key={b.key}
                className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                  b.earned ? "border-primary/40 bg-primary/5" : "border-dashed border-border bg-background/40 opacity-60"
                }`}
              >
                <span className={`text-2xl ${b.earned ? "" : "grayscale"}`}>{b.emoji}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold">{b.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* لوحة المتصدّرين */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h3 className="font-extrabold">لوحة المتصدّرين</h3>
        </div>
        {boardLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : board.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">لسه مفيش نقاط. ابدأ ذاكر واكمّل دروسك! 🚀</p>
        ) : (
          <ol className="mt-4 space-y-2">
            {board.map((r) => {
              const me = r.user_id === user?.id;
              const medal = r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : null;
              return (
                <li
                  key={r.user_id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 ${me ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-accent"}`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center text-sm font-extrabold">
                    {medal ?? <span className="text-muted-foreground">{r.rank}</span>}
                  </span>
                  <span className="flex-1 truncate text-sm font-bold">{me ? "أنت" : r.name}</span>
                  <span className="shrink-0 text-sm font-extrabold text-primary">{fmt(r.xp)}</span>
                </li>
              );
            })}
          </ol>
        )}
        <Link
          to="/leaderboard"
          className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-primary/40 px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
        >
          شوف لوحة المتصدّرين كاملة <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
