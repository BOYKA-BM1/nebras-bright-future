import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2, CheckCircle2, Circle, Lock, ChevronRight,
  PlayCircle, Download, Bookmark as BookmarkIcon, StickyNote, Plus, X,
} from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/site/Logo";
import {
  useCompletionThreshold,
  useCourse,
  useCourseContent,
  useEnrollment,
  useProgress,
  useUpdateProgress,
  useRecordWatchEvent,
} from "@/hooks/use-content";
import { useClaimCertificate } from "@/hooks/use-certificates";
import { useLessonNotes, useNoteActions } from "@/hooks/use-notes";
import { useIsBookmarked, useToggleBookmark } from "@/hooks/use-bookmarks";
import { useLiveSessions } from "@/hooks/use-live";
import { toEmbedUrl, getLessonPdfs, type Lesson } from "@/lib/catalog";
import { ProtectedVideo } from "@/components/site/ProtectedVideo";
import { useContentProtection } from "@/hooks/use-content-protection";
import { useProfile } from "@/hooks/use-profile";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/learn/$courseId")({
  component: LearnPage,
});

function LearnPage() {
  const { courseId } = Route.useParams();
  const router = useRouter();
  const { data: course, isLoading } = useCourse(courseId);
  const { sections, lessons, isLoading: contentLoading } = useCourseContent(courseId);
  const { isEnrolled, isLoading: enrollLoading } = useEnrollment(courseId);
  const { data: progress = [] } = useProgress(courseId);
  const { data: liveSessions = [] } = useLiveSessions(courseId);
  const updateProgress = useUpdateProgress(courseId);
  const recordWatchEvent = useRecordWatchEvent(courseId);
  const { data: completionThreshold = 90 } = useCompletionThreshold();
  const { data: profile } = useProfile();
  const { user } = useAuth();
  const { obscured } = useContentProtection();
  const watermark = useMemo(() => {
    const name = profile?.full_name?.trim() || user?.email?.split("@")[0] || "طالب";
    const contact = profile?.phone?.trim() || user?.email || "";
    return [name, contact].filter(Boolean).join(" · ");
  }, [profile?.full_name, profile?.phone, user?.email]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  // تتبّع مشاهدة الفيديو الحالي: أعلى نسبة مشاهدة، آخر وقت أُرسل فيه تحديث، وهل أُكمل تلقائيًا بالفعل
  const watchRef = useRef({ lessonId: "", maxPercent: 0, lastSentAt: 0, autoCompleted: false });
  const currentTimeRef = useRef(0);
  const [seekTarget, setSeekTarget] = useState<number | null>(null);

  useEffect(() => {
    watchRef.current = { lessonId: activeId ?? "", maxPercent: 0, lastSentAt: 0, autoCompleted: false };
  }, [activeId]);

  const downloadPdf = async (url: string, title: string) => {
    setDownloadingUrl(url);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${title || "ملف-المحاضرة"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
      toast.error("تعذّر التحميل المباشر — تم فتح الملف في تبويب جديد.");
    } finally {
      setDownloadingUrl(null);
    }
  };

  const completedIds = useMemo(() => new Set(progress.filter((p) => p.completed).map((p) => p.lesson_id)), [progress]);
  const pct = lessons.length ? Math.round((completedIds.size / lessons.length) * 100) : 0;

  const active: Lesson | null = useMemo(() => {
    if (activeId) return lessons.find((l) => l.id === activeId) ?? null;
    return lessons[0] ?? null;
  }, [activeId, lessons]);

  const canWatch = (l: Lesson) => isEnrolled || l.is_free;

  useEffect(() => {
    if (!activeId && lessons.length) setActiveId(lessons[0].id);
  }, [lessons, activeId]);

  if (isLoading || contentLoading || enrollLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!course) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <p className="text-muted-foreground">الدورة مش موجودة.</p>
        <Link to="/" className="text-primary underline">الرجوع</Link>
      </div>
    );
  }

  if (!isEnrolled && !lessons.some((l) => l.is_free)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-extrabold">محتاج تشترك الأول</h1>
        <p className="max-w-md text-muted-foreground">لازم تشترك في «{course.title}» عشان تشوف الدروس.</p>
        <Link to="/courses/$courseId" params={{ courseId }} className="rounded-xl bg-gradient-gold px-6 py-3 text-sm font-bold text-primary-foreground shadow-gold">
          صفحة الدورة
        </Link>
      </div>
    );
  }

  const embed = active ? toEmbedUrl(active.video_url) : { kind: "none" as const, src: "" };
  const locked = active ? !canWatch(active) : false;
  const liveNow = isEnrolled ? liveSessions.find((l) => l.status === "live") : undefined;
  const liveEmbed = liveNow ? toEmbedUrl(liveNow.embed_url) : { kind: "none" as const, src: "" };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <Link to="/dashboard" className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent">
            <ChevronRight className="h-4 w-4" /> لوحتي
          </Link>
        </div>
      </header>

      {liveNow && (
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
          <div className="overflow-hidden rounded-2xl border border-destructive/40 bg-card shadow-card">
            <div className="flex items-center gap-2 border-b border-border/60 bg-destructive/10 px-5 py-3">
              <span className="flex items-center gap-1.5 rounded-full bg-destructive/20 px-2.5 py-0.5 text-xs font-bold text-destructive">🔴 مباشر الآن</span>
              <span className="font-bold">{liveNow.title}</span>
            </div>
            <ProtectedVideo
              embed={liveEmbed}
              title={liveNow.title}
              watermark={watermark}
              autoPlay
              obscured={obscured}
              emptyLabel="البث المباشر هيبدأ قريبًا."
            />
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-3">
        {/* المشغّل */}
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {locked ? (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-black text-center text-muted-foreground">
                <Lock className="h-10 w-10" />
                <p>الدرس ده متاح للمشتركين فقط.</p>
              </div>
            ) : (
              <ProtectedVideo
                embed={embed}
                title={active?.title}
                watermark={watermark}
                obscured={obscured}
                onPlay={() => active && recordWatchEvent.mutate({ lessonId: active.id, event: "play", position: 0, duration: 0 })}
                onTimeUpdate={(t, duration) => {
                  if (!active) return;
                  currentTimeRef.current = t;
                  const w = watchRef.current;
                  const percent = duration > 0 ? Math.min(100, (t / duration) * 100) : 0;
                  if (percent > w.maxPercent) w.maxPercent = percent;

                  const now = Date.now();
                  const dueForTick = Math.round(t) % 15 === 0 && t > 0 && now - w.lastSentAt > 5000;
                  const justCrossedThreshold = !w.autoCompleted && percent >= completionThreshold;

                  if (dueForTick || justCrossedThreshold) {
                    w.lastSentAt = now;
                    if (justCrossedThreshold) w.autoCompleted = true;
                    // الحساب الفعلي (النسبة، الوقت المتراكم، الاكتمال) يتم على الخادم داخل الـRPC،
                    // مش بالثقة في قيم من المتصفح — نبعت بس الموضع والمدة الحاليين.
                    recordWatchEvent.mutate({
                      lessonId: active.id,
                      event: justCrossedThreshold ? "ended" : "heartbeat",
                      position: t,
                      duration,
                    });
                  }
                }}
                onEnded={() => {
                  if (!active) return;
                  watchRef.current.autoCompleted = true;
                  recordWatchEvent.mutate({ lessonId: active.id, event: "ended", position: active.duration_minutes * 60, duration: active.duration_minutes * 60 });
                }}
                emptyLabel={
                  <>
                    <PlayCircle className="h-12 w-12" />
                    <span className="mr-2">لا يوجد فيديو لهذا الدرس بعد.</span>
                  </>
                }
                seekToSeconds={seekTarget}
              />
            )}

            {active && (
              <div className="p-5">
                <h1 className="text-xl font-extrabold">{active.title}</h1>
                {active.description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{active.description}</p>}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {!locked && (
                    <button
                      onClick={() => updateProgress.mutate({ lessonId: active.id, completed: !completedIds.has(active.id) })}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                        completedIds.has(active.id) ? "bg-primary/15 text-primary" : "bg-gradient-gold text-primary-foreground shadow-gold"
                      }`}
                    >
                      {completedIds.has(active.id) ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                      {completedIds.has(active.id) ? "تم الإكمال" : "تحديد كمكتمل"}
                    </button>
                  )}
                  <BookmarkButton targetType="lesson" targetId={active.id} />
                </div>
                {getLessonPdfs(active).length > 0 && (
                  <div className="mt-4 grid gap-2">
                    <p className="text-sm font-bold text-muted-foreground">ملفات المحاضرة</p>
                    {getLessonPdfs(active).map((pdf, i) => (
                      <button
                        key={i}
                        onClick={() => downloadPdf(pdf.url, pdf.title)}
                        disabled={downloadingUrl === pdf.url}
                        className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-accent disabled:opacity-60"
                      >
                        {downloadingUrl === pdf.url ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-primary" />}
                        <span className="flex-1 text-right">{pdf.title}</span>
                        <span className="text-xs text-muted-foreground">{downloadingUrl === pdf.url ? "جارٍ التحميل..." : "تحميل PDF"}</span>
                      </button>
                    ))}
                  </div>
                )}

                <LessonNotesPanel lessonId={active.id} courseId={courseId} getCurrentTime={() => currentTimeRef.current} onJump={(s) => setSeekTarget(s + Math.random() / 1000)} />
              </div>
            )}
          </div>
        </div>

        {/* قائمة الدروس */}
        <aside className="lg:col-span-1">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-extrabold">{course.title}</h2>
            <div className="mt-3 flex items-center gap-3">
              <Progress value={pct} className="flex-1" />
              <span className="text-sm font-bold text-primary">{pct}%</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{completedIds.size} من {lessons.length} درس</p>
            {pct === 100 && <ClaimCertificateButton courseId={courseId} />}

            <div className="mt-5 space-y-4">
              {sections.map((s) => (
                <div key={s.id}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{s.title}</p>
                  <ul className="space-y-1">
                    {s.lessons.map((l) => {
                      const isActive = active?.id === l.id;
                      const done = completedIds.has(l.id);
                      const open = canWatch(l);
                      return (
                        <li key={l.id}>
                          <button
                            onClick={() => setActiveId(l.id)}
                            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-right text-sm transition-colors ${
                              isActive ? "bg-primary/15 font-bold text-primary" : "hover:bg-accent"
                            }`}
                          >
                            {done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : open ? <PlayCircle className="h-4 w-4 shrink-0 text-muted-foreground" /> : <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />}
                            <span className="flex-1 line-clamp-2">{l.title}</span>
                            {l.duration_minutes > 0 && <span className="shrink-0 text-xs text-muted-foreground">{l.duration_minutes}د</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** يظهر لمّا الطالب يكمّل كل دروس الدورة — يطلب الشهادة عبر RPC يتحقق من الاكتمال فعليًا على الخادم */
function ClaimCertificateButton({ courseId }: { courseId: string }) {
  const claim = useClaimCertificate();
  const [claimed, setClaimed] = useState(false);

  if (claimed) {
    return (
      <Link to="/certificates" className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-gold">
        🎓 شاهد شهادتك
      </Link>
    );
  }

  return (
    <button
      onClick={() =>
        claim.mutate(courseId, {
          onSuccess: () => { setClaimed(true); toast.success("مبروك! 🎉 حصلت على شهادة إتمام الدورة"); },
          onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر إصدار الشهادة."),
        })
      }
      disabled={claim.isPending}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-gold disabled:opacity-60"
    >
      {claim.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "🎓"} استلام شهادة الإتمام
    </button>
  );
}

/** زر إضافة/إزالة الدرس أو الدورة من المفضّلة */
function BookmarkButton({ targetType, targetId }: { targetType: "lesson" | "course"; targetId: string }) {
  const isBookmarked = useIsBookmarked(targetType, targetId);
  const toggle = useToggleBookmark();
  return (
    <button
      onClick={() => toggle.mutate({ targetType, targetId, isBookmarked })}
      className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${
        isBookmarked ? "border-primary/40 bg-primary/10 text-primary" : "border-border hover:bg-accent"
      }`}
    >
      <BookmarkIcon className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`} />
      {isBookmarked ? "في المفضّلة" : "إضافة للمفضّلة"}
    </button>
  );
}

/** ملاحظاتي على الدرس — مربوطة بلحظة معيّنة من الفيديو، مع إمكانية القفز ليها */
function LessonNotesPanel({
  lessonId, courseId, getCurrentTime, onJump,
}: {
  lessonId: string;
  courseId: string;
  getCurrentTime: () => number;
  onJump: (seconds: number) => void;
}) {
  const { data: notes = [] } = useLessonNotes(lessonId);
  const { add, remove } = useNoteActions(lessonId);
  const [content, setContent] = useState("");

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const handleAdd = () => {
    if (!content.trim()) return;
    add.mutate(
      { courseId, content: content.trim(), positionSeconds: Math.floor(getCurrentTime()) },
      { onSuccess: () => setContent(""), onError: () => toast.error("تعذّر حفظ الملاحظة.") },
    );
  };

  return (
    <div className="mt-6 border-t border-border/60 pt-4">
      <p className="flex items-center gap-2 text-sm font-bold"><StickyNote className="h-4 w-4 text-primary" /> ملاحظاتي على الدرس</p>
      <div className="mt-2 flex gap-2">
        <Input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="اكتب ملاحظة عند اللحظة الحالية من الفيديو..."
        />
        <Button onClick={handleAdd} disabled={add.isPending} size="sm" className="shrink-0 gap-1.5">
          {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} إضافة
        </Button>
      </div>

      {notes.length > 0 && (
        <div className="mt-3 space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/50 p-3">
              {n.position_seconds != null && (
                <button onClick={() => onJump(n.position_seconds!)} className="shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary hover:bg-primary/20">
                  {fmt(n.position_seconds)}
                </button>
              )}
              <p className="flex-1 text-sm">{n.content}</p>
              <button onClick={() => remove.mutate(n.id)} className="shrink-0 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
