import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Gauge, Settings2, Play, Pause } from "lucide-react";

export type VideoEmbed = { kind: "iframe" | "video" | "none"; src: string };

type QualityOption = { id: number; label: string };

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

/**
 * مشغّل فيديو نظيف: تشغيل/إيقاف + شريط تقدّم + صوت + جودة + سرعة فقط.
 * بدون علامة مائية، بدون أزرار إضافية.
 */
export function ProtectedVideo({
  embed,
  title,
  watermark: _watermark,
  autoPlay,
  obscured,
  onTimeUpdate,
  onEnded,
  onPlay,
  emptyLabel,
  seekToSeconds,
}: {
  embed: VideoEmbed;
  title?: string;
  watermark?: string;
  autoPlay?: boolean;
  obscured?: boolean;
  onTimeUpdate?: (t: number, duration: number) => void;
  onEnded?: () => void;
  onPlay?: () => void;
  emptyLabel?: React.ReactNode;
  seekToSeconds?: number | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void; currentLevel: number; levels?: { height?: number; bitrate?: number }[] } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [qualities, setQualities] = useState<QualityOption[]>([]);
  const [quality, setQuality] = useState<number>(-1);
  const [showSpeed, setShowSpeed] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<number | null>(null);

  const isHls = embed.kind === "video" && /\.m3u8(\?|$)/i.test(embed.src);
  const isNativeVideo = embed.kind === "video";

  const bumpControls = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setShowControls(false), 3200);
  }, []);

  useEffect(() => {
    if (obscured && videoRef.current) {
      videoRef.current.pause();
      setPlaying(false);
    }
  }, [obscured]);

  useEffect(() => {
    if (seekToSeconds == null || !videoRef.current) return;
    try {
      videoRef.current.currentTime = seekToSeconds;
    } catch {
      /* ignore */
    }
  }, [seekToSeconds]);

  // HLS setup
  useEffect(() => {
    if (!isNativeVideo || !videoRef.current) return;
    const video = videoRef.current;
    let destroyed = false;

    const setup = async () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      setQualities([]);
      setQuality(-1);

      if (isHls) {
        try {
          const Hls = (await import("hls.js")).default;
          if (destroyed) return;
          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              maxBufferLength: 30,
            });
            hls.loadSource(embed.src);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              const levels = hls.levels ?? [];
              const opts: QualityOption[] = levels.map((l, i) => ({
                id: i,
                label: l.height ? `${l.height}p` : `${Math.round((l.bitrate || 0) / 1000)}kbps`,
              }));
              setQualities(opts);
            });
            hlsRef.current = hls as any;
            if (autoPlay) void video.play().catch(() => undefined);
            return;
          }
        } catch {
          /* fallback below */
        }
      }

      video.src = embed.src;
      if (autoPlay) void video.play().catch(() => undefined);
    };

    void setup();
    return () => {
      destroyed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [embed.src, isHls, isNativeVideo, autoPlay]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    if (quality === -1) {
      if (hlsRef.current) hlsRef.current.currentLevel = -1;
      return;
    }
    if (hlsRef.current) hlsRef.current.currentLevel = quality;
  }, [quality]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPlaying(true);
      onPlay?.();
    } else {
      v.pause();
      setPlaying(false);
    }
    bumpControls();
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const t = (Number(e.target.value) / 1000) * duration;
    v.currentTime = t;
    setCurrent(t);
  };

  const fmt = (s: number) => {
    if (!Number.isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (embed.kind === "none" || !embed.src) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-zinc-950 text-zinc-400">
        {emptyLabel ?? <span className="text-sm">لا يوجد فيديو.</span>}
      </div>
    );
  }

  // iframe (YouTube/Bunny embed) — حاوية نظيفة بدون أزرار إضافية فوقها
  if (embed.kind === "iframe") {
    return (
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        <iframe
          src={embed.src}
          title={title || "فيديو"}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        {obscured && <div className="absolute inset-0 bg-black/80" />}
      </div>
    );
  }

  const progressPct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div
      className="group relative aspect-video w-full overflow-hidden bg-black select-none"
      onMouseMove={bumpControls}
      onClick={togglePlay}
      onContextMenu={(e) => e.preventDefault()}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        playsInline
        controls={false}
        controlsList="nodownload noplaybackrate noremoteplayback"
        disablePictureInPicture
        onPlay={() => {
          setPlaying(true);
          onPlay?.();
        }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (!v) return;
          setCurrent(v.currentTime);
          setDuration(v.duration || 0);
          onTimeUpdate?.(v.currentTime, v.duration || 0);
        }}
        onEnded={() => {
          setPlaying(false);
          onEnded?.();
        }}
        onLoadedMetadata={() => {
          const v = videoRef.current;
          if (v) setDuration(v.duration || 0);
        }}
      />

      {obscured && <div className="absolute inset-0 z-20 bg-black/85" />}

      {/* زر تشغيل وسط الشاشة عند الإيقاف */}
      {!playing && !obscured && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="absolute inset-0 z-10 flex items-center justify-center"
          aria-label="تشغيل"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg backdrop-blur-sm transition hover:scale-105">
            <Play className="h-7 w-7 fill-current" />
          </span>
        </button>
      )}

      {/* شريط التحكم السفلي — صوت + جودة + سرعة فقط */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 pb-3 pt-10 transition-opacity duration-300 ${
          showControls || !playing ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* شريط التقدّم */}
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(progressPct * 10)}
          onChange={onSeek}
          className="mb-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-primary [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
          aria-label="التقدّم"
        />

        <div className="flex items-center gap-2 text-white">
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"
            aria-label={playing ? "إيقاف" : "تشغيل"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          </button>

          <span className="min-w-[5.5rem] text-[11px] font-semibold tabular-nums text-white/90">
            {fmt(current)} / {fmt(duration)}
          </span>

          <div className="flex-1" />

          {/* الصوت */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"
              aria-label={muted || volume === 0 ? "تشغيل الصوت" : "كتم"}
            >
              {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={muted ? 0 : Math.round(volume * 100)}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                setVolume(v);
                setMuted(v === 0);
              }}
              className="hidden h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/25 accent-primary sm:block"
              aria-label="مستوى الصوت"
            />
          </div>

          {/* السرعة */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowSpeed((s) => !s);
                setShowQuality(false);
              }}
              className="flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-bold hover:bg-white/10"
              aria-label="سرعة التشغيل"
            >
              <Gauge className="h-4 w-4" />
              {speed === 1 ? "1x" : `${speed}x`}
            </button>
            {showSpeed && (
              <div className="absolute bottom-11 left-0 min-w-[5.5rem] overflow-hidden rounded-xl border border-white/10 bg-zinc-900/95 py-1 shadow-xl backdrop-blur">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSpeed(s);
                      setShowSpeed(false);
                    }}
                    className={`block w-full px-3 py-1.5 text-left text-xs font-bold hover:bg-white/10 ${
                      speed === s ? "bg-white/10 text-primary" : "text-white"
                    }`}
                  >
                    {s === 1 ? "عادي" : `${s}x`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* الجودة */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowQuality((q) => !q);
                setShowSpeed(false);
              }}
              className="flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-bold hover:bg-white/10"
              aria-label="جودة الفيديو"
            >
              <Settings2 className="h-4 w-4" />
              {quality === -1 ? "تلقائي" : qualities.find((q) => q.id === quality)?.label ?? "جودة"}
            </button>
            {showQuality && (
              <div className="absolute bottom-11 left-0 min-w-[6.5rem] overflow-hidden rounded-xl border border-white/10 bg-zinc-900/95 py-1 shadow-xl backdrop-blur">
                <button
                  type="button"
                  onClick={() => {
                    setQuality(-1);
                    setShowQuality(false);
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-xs font-bold hover:bg-white/10 ${
                    quality === -1 ? "bg-white/10 text-primary" : "text-white"
                  }`}
                >
                  تلقائي
                </button>
                {qualities.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setQuality(q.id);
                      setShowQuality(false);
                    }}
                    className={`block w-full px-3 py-1.5 text-left text-xs font-bold hover:bg-white/10 ${
                      quality === q.id ? "bg-white/10 text-primary" : "text-white"
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
                {qualities.length === 0 && (
                  <p className="px-3 py-1.5 text-[11px] text-white/50">الجودة من المصدر</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
