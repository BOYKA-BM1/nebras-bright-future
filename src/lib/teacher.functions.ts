import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TeacherCourseStat = {
  id: string;
  title: string;
  price: number;
  income: number;
  subscribers: number;
  lessons: number;
  subject: string | null;
  image_url: string | null;
  is_published: boolean;
};

export type TeacherDashboard = {
  isTeacher: boolean;
  teacherId: string | null;
  name: string | null;
  rating: number;
  profitPercentage: number;
  revenue: number; // إجمالي دخل دوراته المدفوع
  profit: number; // ربح المدرّس بعد النسبة
  students: number; // عدد الطلاب الفعليين (فريد)
  activeEnrollments: number; // عدد الاشتراكات النشطة
  lessons: number; // إجمالي الدروس
  exams: number; // إجمالي الامتحانات
  courses: TeacherCourseStat[]; // مرتّبة بالأكثر مبيعًا
};

/**
 * لوحة المدرّس: أرباحه، عدد طلابه، تقييمه، والكورسات الأكثر مبيعًا.
 * تُحسب على الخادم من بيانات دوراته فقط، ولا تكشف أي بيانات لغيره.
 */
export const getMyTeacherDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TeacherDashboard> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;

    const empty: TeacherDashboard = {
      isTeacher: false,
      teacherId: null,
      name: null,
      rating: 0,
      profitPercentage: 0,
      revenue: 0,
      profit: 0,
      students: 0,
      activeEnrollments: 0,
      lessons: 0,
      exams: 0,
      courses: [],
    };

    const { data: teacher } = await supabaseAdmin
      .from("teachers")
      .select("id, name, rating, profit_percentage")
      .eq("user_id", uid)
      .maybeSingle();

    if (!teacher) return empty;

    const { data: courses } = await supabaseAdmin
      .from("courses")
      .select("id, title, price, lessons_count, subject, image_url, is_published")
      .eq("teacher_id", teacher.id);

    const courseList = courses ?? [];
    const courseIds = courseList.map((c) => c.id);

    let exams = 0;
    let payments: Array<{ amount: number | null; course_id: string | null; status: string | null }> = [];
    let enrollments: Array<{ course_id: string; user_id: string; status: string | null }> = [];

    if (courseIds.length) {
      const [payRes, enrRes, quizRes] = await Promise.all([
        supabaseAdmin.from("payments").select("amount, course_id, status").in("course_id", courseIds),
        supabaseAdmin.from("enrollments").select("course_id, user_id, status").in("course_id", courseIds),
        supabaseAdmin.from("quizzes").select("id", { count: "exact", head: true }).in("course_id", courseIds),
      ]);
      exams = quizRes.count ?? 0;
      payments = (payRes.data ?? []).filter((p) => p.status === "paid");
      enrollments = (enrRes.data ?? []).filter((e) => e.status === "active");
    }

    const incomeByCourse = new Map<string, number>();
    for (const p of payments) {
      if (!p.course_id) continue;
      incomeByCourse.set(p.course_id, (incomeByCourse.get(p.course_id) ?? 0) + Number(p.amount || 0));
    }
    const subsByCourse = new Map<string, number>();
    for (const e of enrollments) {
      subsByCourse.set(e.course_id, (subsByCourse.get(e.course_id) ?? 0) + 1);
    }

    const courseStats: TeacherCourseStat[] = courseList
      .map((c) => ({
        id: c.id,
        title: c.title,
        price: Number(c.price || 0),
        income: incomeByCourse.get(c.id) ?? 0,
        subscribers: subsByCourse.get(c.id) ?? 0,
        lessons: Number(c.lessons_count || 0),
        subject: c.subject ?? null,
        image_url: c.image_url ?? null,
        is_published: !!c.is_published,
      }))
      .sort((a, b) => b.income - a.income || b.subscribers - a.subscribers);

    const revenue = courseStats.reduce((s, c) => s + c.income, 0);
    const pct = Number(teacher.profit_percentage ?? 50);
    const profit = Math.round((revenue * pct) / 100);
    const students = new Set(enrollments.map((e) => e.user_id)).size;
    const lessons = courseStats.reduce((s, c) => s + c.lessons, 0);

    return {
      isTeacher: true,
      teacherId: teacher.id,
      name: teacher.name,
      rating: Number(teacher.rating ?? 0),
      profitPercentage: pct,
      revenue,
      profit,
      students,
      activeEnrollments: enrollments.length,
      lessons,
      exams,
      courses: courseStats,
    };
  });

/* =========================================================
   📈 تحليلات مشاهدة الفيديو لدورة معيّنة (Dashboard للمدرّس)
   - للمدرّس مالك الدورة أو الأدمن فقط
   - يحسب لكل درس: مكتمل / بدأ ولم يكمل / لم يبدأ + متوسط نسبة المشاهدة
   - ويرصد "الطلاب المحتاجين متابعة" (ضعف مشاهدة أو ضعف نتائج)
========================================================= */

export type DropOffBuckets = {
  /** 0% (لم يبدأ) — محسوبة بشكل منفصل كـ notStarted، مش هنا */
  b0to25: number;
  b25to50: number;
  b50to75: number;
  b75to99: number;
  completed: number;
};

export type LessonWatchStat = {
  lessonId: string;
  title: string;
  totalStudents: number;
  completed: number;
  partial: number;
  notStarted: number;
  avgWatchPercent: number;
  dropOff: DropOffBuckets;
};

export type StrugglingStudent = {
  userId: string;
  fullName: string;
  avgWatchPercent: number;
  avgQuizScore: number;
};

export type CourseWatchAnalytics = {
  authorized: boolean;
  totalStudents: number;
  avgCourseProgress: number;
  avgWatchPercent: number;
  avgQuizScore: number;
  lessons: LessonWatchStat[];
  strugglingStudents: StrugglingStudent[];
};

export const getCourseWatchAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ courseId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<CourseWatchAnalytics> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    const courseId = data.courseId;

    const empty: CourseWatchAnalytics = {
      authorized: false,
      totalStudents: 0,
      avgCourseProgress: 0,
      avgWatchPercent: 0,
      avgQuizScore: 0,
      lessons: [],
      strugglingStudents: [],
    };

    const [{ data: roles }, { data: course }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", uid),
      supabaseAdmin.from("courses").select("id, teacher_id").eq("id", courseId).maybeSingle(),
    ]);
    if (!course) return empty;
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    let ownsCourse = isAdmin;
    if (!ownsCourse && course.teacher_id) {
      const { data: teacher } = await supabaseAdmin
        .from("teachers")
        .select("id")
        .eq("id", course.teacher_id)
        .eq("user_id", uid)
        .maybeSingle();
      ownsCourse = !!teacher;
    }
    if (!ownsCourse) return empty;

    const [{ data: lessons }, { data: enrollments }, { data: progressRows }, { data: attempts }, { data: threshold }] =
      await Promise.all([
        supabaseAdmin
          .from("lessons")
          .select("id, title, sort_order")
          .eq("course_id", courseId)
          .order("sort_order", { ascending: true }),
        supabaseAdmin.from("enrollments").select("user_id").eq("course_id", courseId).eq("status", "active"),
        supabaseAdmin
          .from("lesson_progress")
          .select("lesson_id, user_id, completed, watch_percent")
          .eq("course_id", courseId),
        supabaseAdmin.from("quiz_attempts").select("user_id, score, total").eq("course_id", courseId),
        supabaseAdmin.from("platform_settings").select("value").eq("key", "video_completion_threshold_percent").maybeSingle(),
      ]);

    const completionThreshold = threshold ? Number(threshold.value) : 90;
    const lessonList = lessons ?? [];
    const totalStudents = new Set((enrollments ?? []).map((e) => e.user_id)).size;
    const progress = progressRows ?? [];

    const lessonStats: LessonWatchStat[] = lessonList.map((l) => {
      const rows = progress.filter((p) => p.lesson_id === l.id);
      const completed = rows.filter((p) => p.completed || Number(p.watch_percent) >= completionThreshold).length;
      const partial = rows.filter((p) => !p.completed && Number(p.watch_percent) > 0 && Number(p.watch_percent) < completionThreshold).length;
      const avgWatchPercent = rows.length ? rows.reduce((s, p) => s + Number(p.watch_percent || 0), 0) / rows.length : 0;

      // توزيع "أماكن التوقف" — طلاب بدأوا فعليًا (watch_percent > 0) لكن لسه ماوصلوش لعتبة الاكتمال،
      // مقسّمين حسب أقصى نسبة مشاهدة وصلوا لها (مسجّلة على الخادم عبر record_video_watch_event، مش من العميل مباشرة)
      const started = rows.filter((p) => !p.completed && Number(p.watch_percent) > 0 && Number(p.watch_percent) < completionThreshold);
      const dropOff: DropOffBuckets = {
        b0to25: started.filter((p) => Number(p.watch_percent) < 25).length,
        b25to50: started.filter((p) => Number(p.watch_percent) >= 25 && Number(p.watch_percent) < 50).length,
        b50to75: started.filter((p) => Number(p.watch_percent) >= 50 && Number(p.watch_percent) < 75).length,
        b75to99: started.filter((p) => Number(p.watch_percent) >= 75).length,
        completed,
      };

      return {
        lessonId: l.id,
        title: l.title,
        totalStudents,
        completed,
        partial,
        notStarted: Math.max(0, totalStudents - completed - partial),
        avgWatchPercent: Math.round(avgWatchPercent),
        dropOff,
      };
    });

    const avgWatchPercent = lessonStats.length
      ? Math.round(lessonStats.reduce((s, l) => s + l.avgWatchPercent, 0) / lessonStats.length)
      : 0;
    const avgCourseProgress = lessonStats.length && totalStudents
      ? Math.round((lessonStats.reduce((s, l) => s + l.completed, 0) / (lessonStats.length * totalStudents)) * 100)
      : 0;

    // متوسط الاختبارات لكل طالب مسجّل
    const quizByUser = new Map<string, { sum: number; n: number }>();
    for (const a of attempts ?? []) {
      if (!a.total) continue;
      const pct = (Number(a.score) / Number(a.total)) * 100;
      const cur = quizByUser.get(a.user_id) ?? { sum: 0, n: 0 };
      cur.sum += pct;
      cur.n += 1;
      quizByUser.set(a.user_id, cur);
    }
    const watchByUser = new Map<string, { sum: number; n: number }>();
    for (const p of progress) {
      const cur = watchByUser.get(p.user_id) ?? { sum: 0, n: 0 };
      cur.sum += Number(p.watch_percent || 0);
      cur.n += 1;
      watchByUser.set(p.user_id, cur);
    }
    const allQuizAvgs = [...quizByUser.values()].map((v) => v.sum / v.n);
    const avgQuizScore = allQuizAvgs.length ? Math.round(allQuizAvgs.reduce((s, v) => s + v, 0) / allQuizAvgs.length) : 0;

    const studentIds = [...new Set((enrollments ?? []).map((e) => e.user_id))];
    let strugglingStudents: StrugglingStudent[] = [];
    if (studentIds.length) {
      const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", studentIds);
      const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name || "طالب"]));
      strugglingStudents = studentIds
        .map((id) => {
          const w = watchByUser.get(id);
          const q = quizByUser.get(id);
          const avgW = w ? w.sum / w.n : 0;
          const avgQ = q ? q.sum / q.n : 0;
          return { userId: id, fullName: nameById.get(id) ?? "طالب", avgWatchPercent: Math.round(avgW), avgQuizScore: Math.round(avgQ) };
        })
        .filter((s) => s.avgWatchPercent < 50 || s.avgQuizScore < 50)
        .sort((a, b) => a.avgWatchPercent + a.avgQuizScore - (b.avgWatchPercent + b.avgQuizScore));
    }

    return {
      authorized: true,
      totalStudents,
      avgCourseProgress,
      avgWatchPercent,
      avgQuizScore,
      lessons: lessonStats,
      strugglingStudents,
    };
  });

/* =========================================================
   📅 النشاط/الحضور المبني على التقدّم الفعلي (Attendance)
   - المنصّة كورسات فيديو مسجّلة وليست حصص مباشرة، فـ"الحضور" هنا
     مبني على نشاط مشاهدة حقيقي (last_watched_at من lesson_progress،
     واللي بيتسجّل فقط عن طريق أحداث مشاهدة فعلية عبر record_video_watch_event
     — مش بمجرد فتح صفحة الدرس)، مش بضغطة "حاضر/غايب" يدوية من المدرّس.
========================================================= */

export type StudentActivity = {
  userId: string;
  fullName: string;
  lastActiveAt: string | null;
  activeLast7Days: boolean;
  lessonsWatched: number;
  totalLessons: number;
};

export const getCourseAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ courseId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<{ authorized: boolean; students: StudentActivity[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    const courseId = data.courseId;

    const [{ data: roles }, { data: course }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", uid),
      supabaseAdmin.from("courses").select("id, teacher_id").eq("id", courseId).maybeSingle(),
    ]);
    if (!course) return { authorized: false, students: [] };
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    let ownsCourse = isAdmin;
    if (!ownsCourse && course.teacher_id) {
      const { data: teacher } = await supabaseAdmin.from("teachers").select("id").eq("id", course.teacher_id).eq("user_id", uid).maybeSingle();
      ownsCourse = !!teacher;
    }
    if (!ownsCourse) return { authorized: false, students: [] };

    const [{ data: enrollments }, { data: lessons }, { data: progress }] = await Promise.all([
      supabaseAdmin.from("enrollments").select("user_id").eq("course_id", courseId).eq("status", "active"),
      supabaseAdmin.from("lessons").select("id").eq("course_id", courseId).eq("is_published", true),
      supabaseAdmin.from("lesson_progress").select("user_id, lesson_id, completed, last_watched_at").eq("course_id", courseId),
    ]);

    const totalLessons = (lessons ?? []).length;
    const studentIds = [...new Set((enrollments ?? []).map((e) => e.user_id))];
    const { data: profiles } = studentIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", studentIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "طالب"]));

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const students: StudentActivity[] = studentIds.map((id) => {
      const rows = (progress ?? []).filter((p) => p.user_id === id);
      const lastActiveAt = rows.reduce<string | null>((max, r) => {
        if (!r.last_watched_at) return max;
        if (!max || new Date(r.last_watched_at) > new Date(max)) return r.last_watched_at;
        return max;
      }, null);
      return {
        userId: id,
        fullName: nameMap.get(id) ?? "طالب",
        lastActiveAt,
        activeLast7Days: !!lastActiveAt && new Date(lastActiveAt).getTime() >= sevenDaysAgo,
        lessonsWatched: rows.filter((r) => r.completed).length,
        totalLessons,
      };
    });

    students.sort((a, b) => (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? ""));
    return { authorized: true, students };
  });
