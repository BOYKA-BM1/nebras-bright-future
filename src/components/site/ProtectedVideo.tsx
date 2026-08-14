import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldAlert, Settings2, Maximize, Volume2 } from "lucide-react";

export type VideoEmbed = { kind: "iframe" | "video" | "none"; src: string };

type QualityOption = { id: number; label: string };

/**
 * مشغّل فيديو محمي:
 * - اختيار جودة الفيديو (تلقائي + كل الجودات المتاحة) لتوفير الإنترنت
 * - زر تشغيل بملء الشاشة أفقيًا (الموبايل بالعرض)
 * - تحسين وضوح الصوت (تعزيز + ضغط ديناميكي) بدون تشويش
 * - علامة مائية متحركة + مبلّطة تحمل هوية الطالب
 * - منع التحميل والزر الأيمن و Picture-in-Picture
 * - تعتيم الفيديو فورًا عند إخفاء التبويب أو فقدان التركيز
 */
export function ProtectedVideo({
  embed,
  title,
  watermark,
  autoPlay,
  obscured,
  onTimeUpdate,
  onEnded,
  emptyLabel,
}: {
  embed: VideoEmbed;
  title?: string;
  watermark: string;
  autoPlay?: boolean;
  obscured?: boolean;
  onTimeUpdate?: (t: number) => void;
  onEnded?: () => void;
  emptyLabel?: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void; currentLevel: number } | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);

  const [pos, setPos] = useState({ top: "12%", left: "10%" });
  const [qualities, setQualities] = useState<QualityOption[]>([]);
  const [quality, setQuality] = useState<number>(-1); // -1 = تلقائي
  const [menuOpen, setMenuOpen] = useState(false);
  const [boost, setBoost] = useState(false);

  const isHls = embed.kind === "video" && /\.m3u8(\?|$)/i.test(embed.src);

  // حرّك العلامة المائية دوريًا لمنع اقتصاصها
  useEffect(() => {
    const id = window.setInterval(() => {
      setPos({ top: `${8 + Math.random() * 78}%`, left: `${6 + Math.random() * 72}%` });
    }, 3500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (obscured && videoRef.current) videoRef.current.pause();
  }, [obscured]);

  /* ===== HLS: تحميل المستويات وإتاحة اختيار الجودة ===== */
  useEffect(() => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
    setQualities([]);
    setQuality(-1);

    const video = videoRef.current;
    if (!video || embed.kind !== "video") return;

    if (!isHls) {
      // MP4 مرفوع بالجودة الأصلية — نعرض الجودة الحقيقية للملف بعد قراءة الأبعاد
      const onMeta = () => {
        const h = video.videoHeight;
        if (h) setQualities([{ id: -1, label: `الأصلية ${h}p` }]);
      };
      video.addEventListener("loadedmetadata", onMeta);
      return () => video.removeEventListener("loadedmetadata", onMeta);
    }

    let cancelled = false;
    (async () => {
      const canNative = video.canPlayType("application/vnd.apple.mpegurl");
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;
      if (Hls.isSupported()) {
        const hls = new Hls({ capLevelToPlayerSize: false, enableWorker: true });
        hls.loadSource(embed.src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setQualities(
            hls.levels.map((l, i) => ({ id: i, label: `${l.height || Math.round((l.bitrate || 0) / 1000)}p` })),
          );
        });
        hlsRef.current = hls as unknown as { destroy: () => void; currentLevel: number };
      } else if (canNative) {
        video.src = embed.src;
      }
    })();

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [embed.src, embed.kind, isHls]);

  const pickQuality = (id: number) => {
    setQuality(id);
    setMenuOpen(false);
    if (hlsRef.current) hlsRef.current.currentLevel = id;
  };

  /* ===== وضوح الصوت: تعزيز + ضغط ديناميكي ===== */
  const toggleBoost = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (!audioRef.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const source = ctx.createMediaElementSource(video);
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -22;
        comp.knee.value = 26;
        comp.ratio.value = 3;
        comp.attack.value = 0.004;
        comp.release.value = 0.22;
        const gain = ctx.createGain();
        gain.value = 1;
        source.connect(comp);
        comp.connect(gain);
        gain.connect(ctx.destination);
        audioRef.current = { ctx, gain };
      }
      const { ctx, gain } = audioRef.current;
      void ctx.resume();
      const next = !boost;
      gain.gain.value = next ? 1.9 : 1;
      setBoost(next);
    } catch {
      /* المتصفح مش مدعّم — نتجاهل بهدوء */
    }
  }, [boost]);

  /* ===== ملء الشاشة أفقيًا ===== */
  const goFullscreenLandscape = useCallback(async () => {
    const el = wrapRef.current;
    const video = videoRef.current;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (el?.requestFullscreen) await el.requestFullscreen();
      else if (video && (video as unknown as { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen)
        (video as unknown as { webkitEnterFullscreen: () => void }).webkitEnterFullscreen();
      const orientation = (screen as unknown as { orientation?: { lock?: (o: string) => Promise<void> } }).orientation;
      await orientation?.lock?.("landscape").catch(() => undefined);
      void video?.play().catch(() => undefined);
    } catch {
      /* بعض المتصفحات ترفض القفل — نكمل عادي */
    }
  }, []);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) {
        const orientation = (screen as unknown as { orientation?: { unlock?: () => void } }).orientation;
        orientation?.unlock?.();
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative aspect-video w-full select-none overflow-hidden bg-black"
      onContextMenu={(e) => e.preventDefault()}
    >
      {embed.kind === "iframe" ? (
        <iframe
          src={embed.src}
          title={title}
          className="h-full w-full"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : embed.kind === "video" ? (
        <video
          ref={videoRef}
          {...(isHls ? {} : { src: embed.src })}
          controls
          playsInline
          preload="metadata"
          autoPlay={autoPlay}
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
          className="h-full w-full"
          onTimeUpdate={(e) => onTimeUpdate?.((e.target as HTMLVideoElement).currentTime)}
          onEnded={() => onEnded?.()}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          {emptyLabel ?? "لا يوجد فيديو بعد."}
        </div>
      )}

      {/* أدوات المشغّل: الجودة + الصوت + ملء الشاشة أفقيًا */}
      {embed.kind === "video" && (
        <div className="absolute left-2 top-2 z-40 flex items-center gap-1.5">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              title="جودة الفيديو"
              className="flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-[11px] font-bold text-white backdrop-blur-sm hover:bg-black/80"
            >
              <Settings2 className="h-3.5 w-3.5" />
              {quality === -1
                ? qualities.length > 1
                  ? "تلقائي"
                  : (qualities[0]?.label ?? "الجودة")
                : (qualities.find((q) => q.id === quality)?.label ?? "الجودة")}
            </button>
            {menuOpen && (
              <div className="absolute left-0 top-full mt-1 min-w-28 overflow-hidden rounded-lg border border-white/10 bg-black/90 text-right backdrop-blur-md">
                {qualities.length > 1 && (
                  <button
                    onClick={() => pickQuality(-1)}
                    className={`block w-full px-3 py-1.5 text-[11px] font-bold text-white hover:bg-white/10 ${quality === -1 ? "bg-white/10" : ""}`}
                  >
                    تلقائي (حسب الإنترنت)
                  </button>
                )}
                {qualities.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => pickQuality(q.id)}
                    className={`block w-full px-3 py-1.5 text-[11px] font-bold text-white hover:bg-white/10 ${quality === q.id ? "bg-white/10" : ""}`}
                  >
                    {q.label}
                  </button>
                ))}
                {qualities.length === 0 && (
                  <span className="block px-3 py-1.5 text-[11px] text-white/60">الجودة الأصلية</span>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleBoost}
            title="تحسين وضوح الصوت"
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-white backdrop-blur-sm ${boost ? "bg-primary/80" : "bg-black/60 hover:bg-black/80"}`}
          >
            <Volume2 className="h-3.5 w-3.5" /> {boost ? "صوت مُعزّز" : "وضوح الصوت"}
          </button>

          <button
            type="button"
            onClick={goFullscreenLandscape}
            title="ملء الشاشة أفقيًا"
            className="flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-[11px] font-bold text-white backdrop-blur-sm hover:bg-black/80"
          >
            <Maximize className="h-3.5 w-3.5" /> شاشة كاملة
          </button>
        </div>
      )}

      {/* علامة مائية مبلّطة خافتة على كامل المساحة */}
      {embed.kind !== "none" && watermark && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden opacity-[0.10]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(-30deg, transparent 0 60px, rgba(255,255,255,0.04) 60px 62px)",
          }}
        >
          <div className="flex h-full w-full flex-wrap content-around justify-around gap-2 p-6">
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                className="whitespace-nowrap text-[11px] font-bold text-white"
                style={{ transform: "rotate(-30deg)" }}
              >
                {watermark}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* علامة مائية متحركة واضحة */}
      {embed.kind !== "none" && watermark && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-20 whitespace-nowrap rounded-md bg-black/30 px-2 py-1 text-[11px] font-bold text-white/80 backdrop-blur-sm transition-all duration-1000 ease-in-out"
          style={{ top: pos.top, left: pos.left }}
        >
          {watermark}
        </div>
      )}

      {/* طبقة التعتيم عند محاولة التصوير / فقدان التركيز */}
      {obscured && embed.kind !== "none" && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/95 text-center backdrop-blur-2xl">
          <ShieldAlert className="h-10 w-10 text-primary" />
          <p className="px-6 text-sm font-bold text-white/90">
            تم إيقاف العرض مؤقتًا لحماية المحتوى.
          </p>
          <p className="px-6 text-xs text-white/60">ارجع للتبويب لاستئناف المشاهدة.</p>
        </div>
      )}
    </div>
  );
}
