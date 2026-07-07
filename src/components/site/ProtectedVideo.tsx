import { useEffect, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";

export type VideoEmbed = { kind: "iframe" | "video" | "none"; src: string };

/**
 * مشغّل فيديو محمي:
 * - علامة مائية متحركة + مبلّطة تحمل هوية الطالب (يصعّب التسريب ويجعله قابلًا للتتبّع)
 * - منع التحميل والزر الأيمن و Picture-in-Picture على فيديوهات <video>
 * - تعتيم الفيديو فورًا عند إخفاء التبويب أو فقدان التركيز أو محاولة التصوير
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pos, setPos] = useState({ top: "12%", left: "10%" });

  // حرّك العلامة المائية الرئيسية دوريًا لمنع اقتصاصها
  useEffect(() => {
    const id = window.setInterval(() => {
      setPos({
        top: `${8 + Math.random() * 78}%`,
        left: `${6 + Math.random() * 72}%`,
      });
    }, 3500);
    return () => window.clearInterval(id);
  }, []);

  // عتّم الفيديو أوقفه عند فقدان التركيز / محاولة التصوير
  useEffect(() => {
    if (obscured && videoRef.current) videoRef.current.pause();
  }, [obscured]);

  return (
    <div
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
          src={embed.src}
          controls
          autoPlay={autoPlay}
          controlsList="nodownload noremoteplayback noplaybackrate"
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
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/95 text-center backdrop-blur-2xl">
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
