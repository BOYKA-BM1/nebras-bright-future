import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Camera, Loader2, Upload, ArrowLeft, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  usePhotoTeachers,
  usePhotoCourses,
  usePhotoLessons,
  useUploadPhotoVideo,
  useAddPhotoLesson,
} from "@/hooks/use-photographer";

export const Route = createFileRoute("/_authenticated/staff/photographer")({
  component: PhotographerPage,
});

function PhotographerPage() {
  const { data: teachers = [], isLoading } = usePhotoTeachers();
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const { data: courses = [], isLoading: loadingCourses } = usePhotoCourses(teacherId);
  const { data: lessons = [] } = usePhotoLessons(courseId);

  const upload = useUploadPhotoVideo();
  const addLesson = useAddPhotoLesson();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const teacher = teachers.find((t) => t.id === teacherId) ?? null;
  const course = courses.find((c) => c.id === courseId) ?? null;

  const submit = async () => {
    if (!courseId) return toast.error("اختر الدورة أولًا.");
    if (!title.trim()) return toast.error("اكتب عنوان الفيديو.");
    if (!file) return toast.error("اختر ملف الفيديو.");
    try {
      const videoUrl = await upload.mutateAsync(file);
      await addLesson.mutateAsync({
        courseId,
        title: title.trim(),
        description: description.trim(),
        durationMinutes: Math.max(0, Number(duration) || 0),
        videoUrl,
      });
      setTitle("");
      setDescription("");
      setDuration("");
      setFile(null);
      toast.success("تم رفع الفيديو وإرساله للمونتاج للمراجعة.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر رفع الفيديو.");
    }
  };

  const busy = upload.isPending || addLesson.isPending;

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <header className="rounded-2xl border border-border bg-card p-5">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <Camera className="h-6 w-6 text-primary" /> لوحة المصوّر
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          اختر المدرّس ثم الدورة، وارفع فيديو الشرح مع بياناته. الفيديو يروح للمونتاج للمراجعة قبل النشر —
          وما فيش أي صلاحية تعديل أو حذف.
        </p>
      </header>

      {/* المدرسون */}
      <h2 className="mt-8 text-lg font-extrabold">المدرسون ({teachers.length})</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teachers.map((t) => {
          const active = t.id === teacherId;
          return (
            <button
              key={t.id}
              onClick={() => { setTeacherId(t.id); setCourseId(null); }}
              className={`flex items-center gap-3 rounded-2xl border p-3 text-right transition-colors ${
                active ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent"
              }`}
            >
              {t.image_url ? (
                <img src={t.image_url} alt={t.name} className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-sm font-extrabold">
                  {t.name.slice(0, 1)}
                </span>
              )}
              <span className="flex-1">
                <span className="block font-bold">{t.name}</span>
                <span className="block text-xs text-muted-foreground">{t.subject}</span>
              </span>
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </button>
          );
        })}
        {teachers.length === 0 && <p className="text-sm text-muted-foreground">مفيش مدرسين في المنصة لسه.</p>}
      </div>

      {/* الدورات */}
      {teacher && (
        <>
          <h2 className="mt-10 text-lg font-extrabold">دورات {teacher.name}</h2>
          {loadingCourses ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : courses.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">المدرّس ده مالوش دورات لسه.</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => {
                const active = c.id === courseId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCourseId(c.id)}
                    className={`rounded-2xl border p-4 text-right transition-colors ${
                      active ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent"
                    }`}
                  >
                    <span className="block font-bold">{c.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {c.grade || c.subject || "—"} · {c.is_published ? "منشورة" : "غير منشورة"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* رفع فيديو */}
      {course && (
        <section className="mt-10 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-extrabold">رفع فيديو جديد — {course.title}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان الفيديو *"
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={duration}
              onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))}
              placeholder="المدة بالدقائق"
              inputMode="numeric"
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف الفيديو / ملاحظات للمونتاج"
              rows={3}
              className="sm:col-span-2 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <label className="sm:col-span-2 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-border px-3 py-3 text-sm hover:bg-accent">
              <span className="flex items-center gap-2 font-bold">
                <Upload className="h-4 w-4 text-primary" /> {file ? file.name : "اختر ملف الفيديو (بالجودة الأصلية)"}
              </span>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span>}
            </label>
          </div>
          <button
            onClick={submit}
            disabled={busy}
            className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-gold px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-gold disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? "جاري الرفع…" : "رفع وإرسال للمونتاج"}
          </button>

          <h3 className="mt-8 text-sm font-extrabold text-muted-foreground">دروس الدورة ({lessons.length})</h3>
          <ul className="mt-3 space-y-2">
            {lessons.map((l) => (
              <li key={l.id} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                {l.review_status === "approved" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Clock className="h-4 w-4 text-orange-400" />
                )}
                <span className="flex-1 font-bold">{l.title}</span>
                <span className="text-xs text-muted-foreground">
                  {l.review_status === "approved" ? "معتمد" : "قيد المونتاج"}
                </span>
              </li>
            ))}
            {lessons.length === 0 && <li className="text-sm text-muted-foreground">مفيش دروس لسه.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
