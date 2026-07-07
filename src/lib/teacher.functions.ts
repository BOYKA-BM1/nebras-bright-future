import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TeacherCourseStat = {
  id: string;
  title: string;
  price: number;
  income: number;
  subscribers: number;
  lessons: number;
};

export type TeacherDashboard = {
  isTeacher: boolean;
  name: string | null;
  rating: number;
  profitPercentage: number;
  revenue: number; // إجمالي دخل دوراته المدفوع
  profit: number; // ربح المدرّس بعد النسبة
  students: number; // عدد الطلاب الفعليين (فريد)
  activeEnrollments: number; // عدد الاشتراكات النشطة
  lessons: number; // إجمالي الدروس
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
      name: null,
      rating: 0,
      profitPercentage: 0,
      revenue: 0,
      profit: 0,
      students: 0,
      activeEnrollments: 0,
      lessons: 0,
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
      .select("id, title, price, lessons_count")
      .eq("teacher_id", teacher.id);

    const courseList = courses ?? [];
    const courseIds = courseList.map((c) => c.id);

    let payments: Array<{ amount: number | null; course_id: string | null; status: string | null }> = [];
    let enrollments: Array<{ course_id: string; user_id: string; status: string | null }> = [];

    if (courseIds.length) {
      const [payRes, enrRes] = await Promise.all([
        supabaseAdmin.from("payments").select("amount, course_id, status").in("course_id", courseIds),
        supabaseAdmin.from("enrollments").select("course_id, user_id, status").in("course_id", courseIds),
      ]);
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
      }))
      .sort((a, b) => b.income - a.income || b.subscribers - a.subscribers);

    const revenue = courseStats.reduce((s, c) => s + c.income, 0);
    const pct = Number(teacher.profit_percentage ?? 50);
    const profit = Math.round((revenue * pct) / 100);
    const students = new Set(enrollments.map((e) => e.user_id)).size;
    const lessons = courseStats.reduce((s, c) => s + c.lessons, 0);

    return {
      isTeacher: true,
      name: teacher.name,
      rating: Number(teacher.rating ?? 0),
      profitPercentage: pct,
      revenue,
      profit,
      students,
      activeEnrollments: enrollments.length,
      lessons,
      courses: courseStats,
    };
  });
