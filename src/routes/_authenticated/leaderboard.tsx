import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy, Home, Loader2, Crown, Medal, Sparkles } from "lucide-react";

import { Navbar } from "@/components/site/Navbar";
import { useAuth } from "@/hooks/use-auth";
import { useMyXp, useLeaderboard } from "@/hooks/use-gamification";
import { levelInfo, levelTitle } from "@/lib/gamification";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "لوحة المتصدّرين — نجم باشا" },
      { name: "description", content: "شوف ترتيبك بين الطلاب واجمع نقاط XP واطلع لأعلى المستويات." },
    ],
  }),
  component: LeaderboardPage,
});

const fmt = (n: number) => new Intl.NumberFormat("ar-EG").format(Math.round(n));

function rankBadge(rank: number) {
  if (rank === 1) return { icon: Crown, cls: "bg-gradient-gold text-primary-foreground shadow-gold" };
  if (rank === 2) return { icon: Medal, cls: "bg-secondary text-foreground" };
  if (rank === 3) return { icon: Medal, cls: "bg-amber-700/20 text-amber-600" };
  return { icon: null, cls: "bg-muted text-muted-foreground" };
}

function LeaderboardPage() {
  const { user } = useAuth();
  const { data: xp = 0 } = useMyXp();
  const { data: board = [], isLoading } = useLeaderboard(50);

  const myRank = useMemo(
    () => board.find((r) => r.user_id === user?.id)?.rank ?? null,
    [board, user?.id],
  );
  const lv = levelInfo(xp);

  return (
    <div className="min-h-screen bg-background pt-[60px]">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-gold text-primary-foreground shadow-gold">
              <Trophy className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold sm:text-2xl">لوحة المتصدّرين</h1>
              <p className="text-xs text-muted-foreground">اجمع نقاط XP من الدروس والاشتراكات واطلع الأول</p>
            </div>
          </div>
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent"
          >
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">لوحتي</span>
          </Link>
        </div>

        {/* بطاقة ترتيبي */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-gold text-lg font-extrabold text-primary-foreground shadow-gold">
                {lv.level}
              </span>
              <div>
                <p className="text-xs font-bold text-muted-foreground">
                  <Sparkles className="mr-1 inline h-3 w-3" /> {levelTitle(lv.level)}
                </p>
                <p className="text-lg font-extrabold">{fmt(xp)} XP</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-muted-foreground">ترتيبك</p>
              <p className="text-2xl font-extrabold text-gradient-gold">
                {myRank ? `#${fmt(myRank)}` : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* الجدول */}
        {isLoading ? (
          <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : board.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            مفيش نقاط لسه — ابدأ ذاكر واجمع XP وتكون أول واحد على القائمة! 🚀
          </div>
        ) : (
          <div className="space-y-2">
            {board.map((row) => {
              const isMe = row.user_id === user?.id;
              const rb = rankBadge(row.rank);
              const RB = rb.icon;
              return (
                <div
                  key={row.user_id}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                    isMe ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent/50"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${rb.cls}`}
                  >
                    {RB ? <RB className="h-5 w-5" /> : fmt(row.rank)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {row.name || "طالب"}
                      {isMe && <span className="mr-2 text-xs font-bold text-primary">(أنت)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      المستوى {levelInfo(row.xp).level} — {levelTitle(levelInfo(row.xp).level)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-extrabold text-gradient-gold">{fmt(row.xp)} XP</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
