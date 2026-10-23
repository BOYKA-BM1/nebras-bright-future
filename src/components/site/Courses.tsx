import { useMemo, useState } from "react";
import { BookOpen, PlayCircle, Video, Clock, Check, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { tracks, resolveImage, type TrackId } from "@/lib/catalog";
import { useCourses } from "@/hooks/use-catalog";
import { useMyEnrollments } from "@/hooks/use-content";
import { useRoles } from "@/hooks/use-roles";
import { useProfile } from "@/hooks/use-profile";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/ui-states";

export function Courses({ hideHeader = false }: { hideHeader?: boolean }) {
  const { data: allCourses = [], isLoading, isError, refetch } = useCourses();
  const { data: enrollments = [] } = useMyEnrollments();
  const { isAdmin, isTeacher, isMontage, isCustomerService, isSecretary } = useRoles();
  const { data: profile } = useProfile();
  const enrolledIds = useMemo(() => new Set(enrollments.map((e) => e.course_id)), [enrollments]);
  const [level, setLevel] = useState<string>("all");
  const [track, setTrack] = useState<TrackId>("all");

  // الطالب يشوف دورات مرحلته وسنته فقط
  const isStudent = !isAdmin && !isTeacher && !isMontage && !isCustomerService && !isSecretary;
  const scoped = isStudent && !!profile?.stage_id;
  const courses = useMemo(() => {
    if (!scoped) return allCourses;
    return allCourses.filter(
      (c) =>
        c.stage_id === profile!.stage_id &&
        (!profile!.grade || !c.grade || c.grade === profile!.grade),
    );
  }, [allCourses, scoped, profile]);


  const stageFilters = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of courses) {
      if (c.stage) seen.set(c.stage.level, c.stage.short ?? c.stage.name);
    }
    return [{ id: "all", label: "كل المراحل" }, ...[...seen].map(([id, label]) => ({ id, label }))];
  }, [courses]);

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      if (level !== "all" && c.stage?.level !== level) return false;
      if (level === "secondary" && track !== "all") {
        if (c.track !== track && c.track !== "all") return false;
      }
      return true;
    });
  }, [courses, level, track]);

  return (
    <section id="courses" className="relative py-24">
      <div className="pointer-events-none absolute inset-x-0 top-1/3 -z-10 mx-auto h-72 max-w-3xl rounded-full bg-primary/5 blur-3xl" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {!hideHeader && (
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-bold uppercase tracking-widest text-primary">الدورات</span>
            <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
              احجز <span className="text-gradient-gold">دورتك</span> دلوقتي
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              اختر مرحلتك وشعبتك، واحجز الدورة بحصصها المباشرة والمسجّلة.
            </p>
          </div>
        )}

        {/* فلاتر المراحل — تُخفى للطالب لأنه يرى مرحلته فقط */}
        {!scoped && (
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {stageFilters.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setLevel(f.id);
                  if (f.id !== "secondary") setTrack("all");
                }}
                className={`rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
                  level === f.id
                    ? "bg-gradient-gold text-primary-foreground shadow-gold"
                    : "border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}


        {/* فلاتر الشُّعب للثانوي */}
        {!scoped && level === "secondary" && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {tracks.map((t) => (

              <button
                key={t.id}
                onClick={() => setTrack(t.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  track === t.id
                    ? "border border-primary bg-primary/15 text-primary"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {isError ? (
          <ErrorState
            className="mt-12"
            title="تعذّر تحميل الدورات"
            description="حصل خطأ أثناء جلب قائمة الدورات من الخادم."
            onRetry={() => void refetch()}
          />
        ) : isLoading ? (
          <LoadingState className="mt-12" label="جاري تحميل الدورات…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            className="mt-12"
            title="لا توجد دورات مطابقة"
            description="جرّب تغيير المرحلة أو الشعبة، أو راجع لاحقًا عند إضافة دورات جديدة."
          />
        ) : (
          <div className="mt-8 grid gap-4 min-[400px]:gap-5 sm:mt-12 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {filtered.map((course) => {
              const isEnrolled = enrolledIds.has(course.id);
              const teacherImg = resolveImage(course.teacher?.image_url);
              return (
                <article
                  key={course.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="relative flex items-center gap-3 border-b border-border/60 bg-gradient-to-l from-primary/10 to-transparent p-4 sm:p-5">
                    {teacherImg ? (
                      <img
                        src={teacherImg}
                        alt=""
                        loading="lazy"
                        width={56}
                        height={56}
                        className="h-12 w-12 shrink-0 rounded-full border-2 border-primary/50 object-cover sm:h-14 sm:w-14"
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-primary/50 bg-primary/15 text-lg font-extrabold text-primary sm:h-14 sm:w-14">
                        {(course.teacher?.name ?? "؟").trim().charAt(0)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">
                        {course.teacher?.name ?? "مدرّس"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{course.subject}</p>
                    </div>
                    {course.badge && (
                      <span className="absolute start-auto end-3 top-3 rounded-full bg-gradient-gold px-2.5 py-1 text-[11px] font-bold text-primary-foreground sm:end-4 sm:top-4 sm:px-3 sm:text-xs">
                        {course.badge}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <h3 className="text-base font-bold leading-snug sm:text-lg">{course.title}</h3>
                    <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {course.description}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
                      {course.live_sessions > 0 && (
                        <span className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          <Video className="h-3.5 w-3.5" aria-hidden />
                          {course.live_sessions} حصة مباشرة
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold">
                        <PlayCircle className="h-3.5 w-3.5 text-primary" aria-hidden />
                        مسجّلة بالكامل
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground sm:mt-4 sm:gap-4">
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="h-4 w-4 text-primary" aria-hidden />
                        {course.lessons_count} درس
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-primary" aria-hidden />
                        {course.hours} ساعة
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 sm:mt-5">
                      <div className="flex flex-col">
                        {course.old_price ? (
                          <span className="text-xs text-muted-foreground line-through">
                            {course.old_price} ج.م
                          </span>
                        ) : null}
                        <span className="text-lg font-extrabold text-gradient-gold sm:text-xl">
                          {course.price} ج.م
                        </span>
                      </div>
                      {isEnrolled ? (
                        <Link
                          to="/learn/$courseId"
                          params={{ courseId: course.id }}
                          className="flex items-center gap-1.5 rounded-xl bg-primary/15 px-4 py-2 text-sm font-bold text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          <Check className="h-4 w-4" aria-hidden />
                          ادخل الدورة
                        </Link>
                      ) : (
                        <Link
                          to="/courses/$courseId"
                          params={{ courseId: course.id }}
                          className="flex items-center gap-2 rounded-xl bg-gradient-gold px-4 py-2 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.04]"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          التفاصيل
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
