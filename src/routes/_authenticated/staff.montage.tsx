import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Film, CheckCircle2, Clock, Video, FileText, ExternalLink, Save, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { useMontageQueue, useMontageActions, useUploadMontageVideo, type MontageLesson } from "@/hooks/use-staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/staff/montage")({
  component: MontagePage,
});

function MontagePage() {
  const [tab, setTab] = useState<"pending" | "approved">("pending");
  const { data: lessons = [], isLoading } = useMontageQueue(tab);

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Film className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">لوحة المونتاج</h1>
          <p className="text-sm text-muted-foreground">راجع فيديوهات المدرّسين وانشرها بعد التعديل.</p>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setTab("pending")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${tab === "pending" ? "bg-gradient-gold text-primary-foreground shadow-gold" : "border border-border hover:bg-accent"}`}
        >
          <Clock className="h-4 w-4" /> قيد الانتظار
        </button>
        <button
          onClick={() => setTab("approved")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${tab === "approved" ? "bg-gradient-gold text-primary-foreground shadow-gold" : "border border-border hover:bg-accent"}`}
        >
          <CheckCircle2 className="h-4 w-4" /> المنشورة
        </button>
      </div>

      {isLoading ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : lessons.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">
          {tab === "pending" ? "لا يوجد دروس بانتظار المونتاج حاليًا 🎬" : "لا يوجد دروس منشورة بعد."}
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {lessons.map((l) => (
            <MontageCard key={l.id} lesson={l} isPending={tab === "pending"} />
          ))}
        </div>
      )}
    </div>
  );
}

function MontageCard({ lesson, isPending }: { lesson: MontageLesson; isPending: boolean }) {
  const { publish, updateVideo } = useMontageActions();
  const uploadVideo = useUploadMontageVideo();
  const fileRef = useRef<HTMLInputElement>(null);
  const [videoUrl, setVideoUrl] = useState(lesson.video_url ?? "");
  const dirty = videoUrl !== (lesson.video_url ?? "");

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) { toast.error("اختر ملف فيديو صالح."); return; }
    uploadVideo.mutate(file, {
      onSuccess: (url) => { setVideoUrl(url); toast.success("تم رفع الفيديو المعدّل بنفس الجودة ✅ اضغط نشر."); },
      onError: () => toast.error("تعذّر رفع الفيديو، حاول تاني."),
    });
  };

  const handlePublish = () => {
    publish.mutate(
      { id: lesson.id, video_url: videoUrl.trim() || null },
      { onSuccess: () => toast.success("تم نشر الدرس على صفحة المدرّس ✅"), onError: () => toast.error("تعذّر النشر.") },
    );
  };
  const handleSave = () => {
    updateVideo.mutate(
      { id: lesson.id, video_url: videoUrl.trim() || null },
      { onSuccess: () => toast.success("تم حفظ رابط الفيديو المعدّل."), onError: () => toast.error("تعذّر الحفظ.") },
    );
  };

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold">{lesson.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {lesson.courseTitle} {lesson.teacherName ? `• ${lesson.teacherName}` : ""}
          </p>
        </div>
        {isPending ? (
          <span className="flex items-center gap-1.5 rounded-full bg-orange-500/15 px-3 py-1 text-xs font-bold text-orange-400">
            <Clock className="h-3.5 w-3.5" /> قيد الانتظار
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-xs font-bold text-green-500">
            <CheckCircle2 className="h-3.5 w-3.5" /> منشور
          </span>
        )}
      </div>

      {lesson.description && <p className="mt-3 text-sm text-muted-foreground">{lesson.description}</p>}

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Video className="h-3.5 w-3.5 text-primary" /> {lesson.duration_minutes} دقيقة</span>
        {lesson.pdf_url && (
          <a href={lesson.pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
            <FileText className="h-3.5 w-3.5" /> ملف PDF
          </a>
        )}
        {lesson.video_url && (
          <a href={lesson.video_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
            <ExternalLink className="h-3.5 w-3.5" /> الفيديو الأصلي
          </a>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <label className="text-xs font-bold text-muted-foreground">رابط الفيديو بعد المونتاج</label>
        <Input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="ألصق رابط الفيديو المعدّل هنا"
          dir="ltr"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleUpload} />
        {lesson.video_url && (
          <Button asChild variant="outline" className="gap-2">
            <a href={lesson.video_url} target="_blank" rel="noreferrer" download>
              <Download className="h-4 w-4" /> تحميل الفيديو الأصلي
            </a>
          </Button>
        )}
        <Button onClick={() => fileRef.current?.click()} variant="outline" disabled={uploadVideo.isPending} className="gap-2">
          {uploadVideo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploadVideo.isPending ? "جارٍ الرفع..." : "رفع الفيديو المعدّل"}
        </Button>
        {dirty && (
          <Button onClick={handleSave} variant="outline" disabled={updateVideo.isPending} className="gap-2">
            <Save className="h-4 w-4" /> حفظ التعديل
          </Button>
        )}
        {isPending && (
          <Button onClick={handlePublish} disabled={publish.isPending} className="gap-2 bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
            {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} نشر الدرس
          </Button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">حمّل الفيديو الأصلي، عدّله على جهازك (قص / إضافة)، ثم ارفعه هنا — يُحفظ بنفس الدقة والجودة بدون أي ضغط، وبعد الرفع اضغط «نشر الدرس».</p>
    </article>
  );
}
