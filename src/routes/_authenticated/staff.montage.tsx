import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Loader2, Film, CheckCircle2, Clock, Video, FileText, ExternalLink, Save, Download, Upload,
  Lock, Send, RotateCcw, AlertTriangle, User,
} from "lucide-react";
import { toast } from "sonner";
import { useMontageQueue, useMontageActions, useUploadMontageVideo, useLessonVideoVersions, type MontageLesson, type MontageStatus } from "@/hooks/use-staff";
import { getMontageStatusCounts } from "@/lib/montage.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";

const TABS: { key: MontageStatus; label: string; icon: typeof Clock }[] = [
  { key: "pending", label: "يحتاج مونتاج", icon: Clock },
  { key: "claimed", label: "قيد التنفيذ", icon: Film },
  { key: "in_review", label: "قيد المراجعة", icon: AlertTriangle },
  { key: "needs_changes", label: "يحتاج تعديلات", icon: RotateCcw },
  { key: "approved", label: "منشورة", icon: CheckCircle2 },
];

export const Route = createFileRoute("/_authenticated/staff/montage")({
  component: MontagePage,
});

function MontagePage() {
  const [tab, setTab] = useState<MontageStatus>("pending");
  const { isAdmin } = useRoles();
  const { data: lessons = [], isLoading } = useMontageQueue([tab]);
  // عدادات سريعة لكل حالة — للوحة أعلى الصفحة
  const counts = useCounts();

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Film className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">لوحة المونتاج</h1>
          <p className="text-sm text-muted-foreground">استلم فيديو، عدّله، ابعته للمراجعة، وبعد الاعتماد يتنشر تلقائيًا.</p>
        </div>
      </div>

      {/* لوحة أرقام سريعة */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {TABS.map((t) => (
          <div key={t.key} className="rounded-xl border border-border/60 bg-card px-3 py-2.5 text-center">
            <p className="text-xl font-extrabold text-gradient-gold">{counts[t.key] ?? "—"}</p>
            <p className="text-[11px] text-muted-foreground">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              tab === t.key ? "bg-gradient-gold text-primary-foreground shadow-gold" : "border border-border hover:bg-accent"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : lessons.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">
          {tab === "pending" && "لا يوجد فيديوهات متاحة للاستلام حاليًا 🎬"}
          {tab === "claimed" && "لا يوجد فيديوهات قيد التنفيذ حاليًا."}
          {tab === "in_review" && "لا يوجد فيديوهات بانتظار المراجعة حاليًا."}
          {tab === "needs_changes" && "لا يوجد فيديوهات تحتاج تعديلات حاليًا."}
          {tab === "approved" && "لا يوجد دروس منشورة بعد."}
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {lessons.map((l) => (
            <MontageCard key={l.id} lesson={l} status={tab} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}

/** عدّاد سريع لكل حالة — نداء واحد بدل 5 نداءات كاملة كانت بتُعمل قبل كده */
function useCounts(): Partial<Record<MontageStatus, number>> {
  const call = useServerFn(getMontageStatusCounts);
  const { data = {} } = useQuery({
    queryKey: ["montage-status-counts"],
    queryFn: () => call(),
    staleTime: 10_000,
  });
  return data;
}

function statusBadge(status: MontageStatus) {
  const map: Record<MontageStatus, { label: string; cls: string; icon: typeof Clock }> = {
    pending: { label: "يحتاج مونتاج", cls: "bg-orange-500/15 text-orange-400", icon: Clock },
    claimed: { label: "قيد التنفيذ", cls: "bg-blue-500/15 text-blue-400", icon: Film },
    in_review: { label: "قيد المراجعة", cls: "bg-purple-500/15 text-purple-400", icon: AlertTriangle },
    needs_changes: { label: "يحتاج تعديلات", cls: "bg-destructive/15 text-destructive", icon: RotateCcw },
    approved: { label: "منشور", cls: "bg-green-500/15 text-green-500", icon: CheckCircle2 },
  };
  const b = map[status];
  return (
    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${b.cls}`}>
      <b.icon className="h-3.5 w-3.5" /> {b.label}
    </span>
  );
}

function MontageCard({ lesson, status, isAdmin }: { lesson: MontageLesson; status: MontageStatus; isAdmin: boolean }) {
  const { user } = useAuth();
  const { claim, submitForReview, requestChanges, resumeEditing, publish, updateVideo } = useMontageActions();
  const uploadVideo = useUploadMontageVideo();
  const fileRef = useRef<HTMLInputElement>(null);
  const [videoUrl, setVideoUrl] = useState(lesson.video_url ?? "");
  const [downloading, setDownloading] = useState(false);
  const [changeNotes, setChangeNotes] = useState("");
  const dirty = videoUrl !== (lesson.video_url ?? "");

  const isMine = !!user && lesson.editorId === user.id;
  const isEditable = status === "claimed" && isMine;
  const showVersions = status !== "pending";
  const { data: versions = [] } = useLessonVideoVersions(showVersions ? lesson.id : null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) { toast.error("اختر ملف فيديو صالح."); return; }
    uploadVideo.mutate(file, {
      onSuccess: (url) => { setVideoUrl(url); toast.success("تم رفع الفيديو المعدّل بنفس الجودة ✅"); },
      onError: () => toast.error("تعذّر رفع الفيديو، حاول تاني."),
    });
  };

  const handleDownload = async () => {
    const url = lesson.video_url;
    if (!url) return;
    setDownloading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const ext = (url.split("?")[0].split(".").pop() || "mp4").slice(0, 5);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${lesson.title || "lesson"}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success("جارٍ تحميل الفيديو الأصلي على جهازك ✅");
    } catch {
      toast.error("تعذّر تحميل الفيديو، افتح الرابط وحمّله يدويًا.");
    } finally {
      setDownloading(false);
    }
  };

  const handleClaim = () => {
    claim.mutate(lesson.id, {
      onSuccess: () => toast.success("تم استلام الفيديو ✅ — الفيديو مقفول عليك الآن ولن يقدر مونتير آخر ياخده."),
      onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الاستلام."),
    });
  };

  const handleSubmitReview = () => {
    submitForReview.mutate(
      { id: lesson.id, video_url: videoUrl.trim() || null },
      { onSuccess: () => toast.success("تم إرسال الفيديو للمراجعة ✅"), onError: () => toast.error("تعذّر الإرسال.") },
    );
  };

  const handleSave = () => {
    updateVideo.mutate(
      { id: lesson.id, video_url: videoUrl.trim() || null },
      { onSuccess: () => toast.success("تم حفظ رابط الفيديو المعدّل."), onError: () => toast.error("تعذّر الحفظ.") },
    );
  };

  const handleRequestChanges = () => {
    if (!changeNotes.trim()) { toast.error("اكتب ملاحظات المراجعة أولًا."); return; }
    requestChanges.mutate(
      { id: lesson.id, notes: changeNotes.trim() },
      { onSuccess: () => { toast.success("تم إرجاع الفيديو للمونتير مع الملاحظات."); setChangeNotes(""); }, onError: () => toast.error("تعذّرت العملية.") },
    );
  };

  const handleResume = () => {
    resumeEditing.mutate(lesson.id, {
      onSuccess: () => toast.success("رجع الفيديو لك للتعديل."),
      onError: () => toast.error("تعذّرت العملية."),
    });
  };

  const handlePublish = () => {
    publish.mutate(
      { id: lesson.id, video_url: videoUrl.trim() || null },
      { onSuccess: () => toast.success("تم اعتماد ونشر الدرس على صفحة المدرّس ✅"), onError: () => toast.error("تعذّر النشر.") },
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
          {lesson.editorName && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5" /> {isMine ? "معك أنت" : `قيد التنفيذ بواسطة ${lesson.editorName}`}
              {!isMine && status !== "approved" && status !== "pending" && (
                <span className="mr-1 flex items-center gap-1 text-destructive"><Lock className="h-3 w-3" /> مقفول</span>
              )}
            </p>
          )}
        </div>
        {statusBadge(status)}
      </div>

      {status === "needs_changes" && lesson.reviewNotes && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{lesson.reviewNotes}</p>
        </div>
      )}

      {lesson.description && <p className="mt-3 text-sm text-muted-foreground">{lesson.description}</p>}

      {versions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {versions.map((v) => (
            <span
              key={v.id}
              title={v.notes ?? undefined}
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                v.status === "approved" ? "bg-green-500/15 text-green-500"
                : v.status === "rejected" ? "bg-destructive/15 text-destructive"
                : v.status === "submitted" ? "bg-purple-500/15 text-purple-400"
                : "bg-secondary text-muted-foreground"
              }`}
            >
              V{v.version_number}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Video className="h-3.5 w-3.5 text-primary" /> {lesson.duration_minutes} دقيقة</span>
        {lesson.pdf_url && (
          <a href={lesson.pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
            <FileText className="h-3.5 w-3.5" /> ملف PDF
          </a>
        )}
        {lesson.video_url && (
          <a href={lesson.video_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
            <ExternalLink className="h-3.5 w-3.5" /> الفيديو الحالي
          </a>
        )}
      </div>

      {/* pending: استلام فقط */}
      {status === "pending" && (
        <div className="mt-4">
          <Button onClick={handleClaim} disabled={claim.isPending} className="gap-2 bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
            {claim.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />} استلام الفيديو
          </Button>
        </div>
      )}

      {/* needs_changes: لو أنا صاحبه، أقدر أستأنف التعديل */}
      {status === "needs_changes" && isMine && (
        <div className="mt-4">
          <Button onClick={handleResume} disabled={resumeEditing.isPending} className="gap-2 bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
            {resumeEditing.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} استئناف التعديل
          </Button>
        </div>
      )}

      {/* claimed by me: تحميل / رفع / إرسال للمراجعة */}
      {isEditable && (
        <>
          <div className="mt-4 space-y-2">
            <label className="text-xs font-bold text-muted-foreground">رابط الفيديو بعد المونتاج</label>
            <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="ألصق رابط الفيديو المعدّل هنا" dir="ltr" />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleUpload} />
            {lesson.video_url && (
              <Button onClick={handleDownload} variant="outline" disabled={downloading} className="gap-2">
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {downloading ? "جارٍ التحميل..." : "تحميل الفيديو الأصلي"}
              </Button>
            )}
            <Button onClick={() => fileRef.current?.click()} variant="outline" disabled={uploadVideo.isPending} className="gap-2">
              {uploadVideo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploadVideo.isPending ? "جارٍ الرفع..." : "رفع الفيديو المعدّل"}
            </Button>
            {dirty && (
              <Button onClick={handleSave} variant="outline" disabled={updateVideo.isPending} className="gap-2">
                <Save className="h-4 w-4" /> حفظ بدون إرسال
              </Button>
            )}
            <Button onClick={handleSubmitReview} disabled={submitForReview.isPending} className="gap-2 bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
              {submitForReview.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} إرسال للمراجعة
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">حمّل الفيديو الأصلي، عدّله على جهازك، ثم ارفعه هنا بنفس الدقة، وبعدين اضغط «إرسال للمراجعة».</p>
        </>
      )}

      {/* in_review: أدوات المراجعة للأدمن فقط */}
      {status === "in_review" && isAdmin && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={handlePublish} disabled={publish.isPending} className="gap-2 bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
            {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} اعتماد ونشر
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 text-destructive"><RotateCcw className="h-4 w-4" /> طلب تعديلات</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>طلب تعديلات على «{lesson.title}»</DialogTitle>
              </DialogHeader>
              <Textarea value={changeNotes} onChange={(e) => setChangeNotes(e.target.value)} placeholder="اكتب الملاحظات المطلوبة للمونتير..." rows={4} />
              <DialogFooter>
                <Button onClick={handleRequestChanges} disabled={requestChanges.isPending} className="gap-2">
                  {requestChanges.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} إرسال الملاحظات
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
      {status === "in_review" && !isAdmin && (
        <p className="mt-4 text-xs text-muted-foreground">الفيديو بانتظار مراجعة واعتماد الإدارة.</p>
      )}
    </article>
  );
}
