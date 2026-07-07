import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TeacherEarning = {
  id: string;
  name: string;
  subject: string | null;
  image_url: string | null;
  profit_percentage: number;
  income: number; // إجمالي الدخل من دورات المدرّس (المدفوع)
  profit: number; // ربح المدرّس = الدخل × النسبة
  platformShare: number; // نصيب المنصة
  subscribers: number; // عدد المشتركين في دورات المدرّس
  courses: {
    id: string;
    title: string;
    price: number;
    income: number;
    subscribers: number;
  }[];
};

export type FinanceData = {
  revenue: number; // إجمالي الإيرادات المدفوعة
  buyers: number; // عدد الأشخاص اللي اشتروا
  transactions: number; // عدد عمليات الدفع الناجحة
  enrollments: number; // عدد الاشتراكات النشطة
  teacherProfitTotal: number; // إجمالي أرباح المدرّسين
  teachers: TeacherEarning[];
};

/** يحسب كل الأرقام المالية الحقيقية من الداتا بيز (مدفوعات + اشتراكات). */
export function useFinance() {
  return useQuery({
    queryKey: ["admin-finance"],
    queryFn: async (): Promise<FinanceData> => {
      const [payRes, enrRes, courseRes, teacherRes] = await Promise.all([
        supabase.from("payments").select("amount,status,course_id,user_id"),
        supabase.from("enrollments").select("course_id,user_id,status"),
        supabase.from("courses").select("id,title,price,teacher_id"),
        (supabase.rpc as any)("admin_teachers"),
      ]);

      const payments = (payRes.data ?? []).filter((p) => p.status === "paid");
      const enrollments = (enrRes.data ?? []).filter((e) => e.status === "active");
      const courses = courseRes.data ?? [];
      const teachers = (teacherRes.data ?? []) as Array<{
        id: string;
        name: string;
        subject: string | null;
        image_url: string | null;
        profit_percentage: number | null;
      }>;

      const revenue = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const buyers = new Set(payments.map((p) => p.user_id)).size;

      const courseTeacher = new Map(courses.map((c) => [c.id, c.teacher_id]));

      // دخل + مشتركين لكل دورة
      const courseIncome = new Map<string, number>();
      for (const p of payments) {
        if (!p.course_id) continue;
        courseIncome.set(p.course_id, (courseIncome.get(p.course_id) ?? 0) + Number(p.amount || 0));
      }
      const courseSubs = new Map<string, number>();
      for (const e of enrollments) {
        courseSubs.set(e.course_id, (courseSubs.get(e.course_id) ?? 0) + 1);
      }

      const teacherEarnings: TeacherEarning[] = teachers.map((t) => {
        const tCourses = courses.filter((c) => c.teacher_id === t.id);
        const courseRows = tCourses.map((c) => ({
          id: c.id,
          title: c.title,
          price: Number(c.price || 0),
          income: courseIncome.get(c.id) ?? 0,
          subscribers: courseSubs.get(c.id) ?? 0,
        }));
        const income = courseRows.reduce((s, c) => s + c.income, 0);
        const subscribers = courseRows.reduce((s, c) => s + c.subscribers, 0);
        const pct = Number(t.profit_percentage ?? 50);
        const profit = Math.round((income * pct) / 100);
        return {
          id: t.id,
          name: t.name,
          subject: t.subject,
          image_url: t.image_url,
          profit_percentage: pct,
          income,
          profit,
          platformShare: income - profit,
          subscribers,
          courses: courseRows.sort((a, b) => b.income - a.income),
        };
      });

      const teacherProfitTotal = teacherEarnings.reduce((s, t) => s + t.profit, 0);

      return {
        revenue,
        buyers,
        transactions: payments.length,
        enrollments: enrollments.length,
        teacherProfitTotal,
        teachers: teacherEarnings.sort((a, b) => b.income - a.income),
      };
    },
    staleTime: 30_000,
  });
}

export type EnrollmentDetail = {
  courseId: string;
  title: string;
  price: number;
  teacherName: string | null;
  subscribers: {
    userId: string;
    name: string | null;
    phone: string | null;
    code: string | null;
    enrolledAt: string;
  }[];
};

/** تفاصيل المشتركين في كل دورة. */
export function useEnrollmentsDetail() {
  return useQuery({
    queryKey: ["admin-enrollments-detail"],
    queryFn: async (): Promise<EnrollmentDetail[]> => {
      const [enrRes, courseRes, teacherRes, profRes] = await Promise.all([
        supabase.from("enrollments").select("course_id,user_id,code,enrolled_at,status"),
        supabase.from("courses").select("id,title,price,teacher_id"),
        supabase.from("teachers").select("id,name"),
        supabase.from("profiles").select("id,full_name,phone"),
      ]);

      const enrollments = (enrRes.data ?? []).filter((e) => e.status === "active");
      const courses = courseRes.data ?? [];
      const teacherName = new Map((teacherRes.data ?? []).map((t) => [t.id, t.name]));
      const profileMap = new Map((profRes.data ?? []).map((p) => [p.id, p]));

      const byCourse = new Map<string, EnrollmentDetail>();
      for (const c of courses) {
        byCourse.set(c.id, {
          courseId: c.id,
          title: c.title,
          price: Number(c.price || 0),
          teacherName: c.teacher_id ? teacherName.get(c.teacher_id) ?? null : null,
          subscribers: [],
        });
      }
      for (const e of enrollments) {
        const row = byCourse.get(e.course_id);
        if (!row) continue;
        const p = profileMap.get(e.user_id) as { full_name?: string; phone?: string } | undefined;
        row.subscribers.push({
          userId: e.user_id,
          name: p?.full_name ?? null,
          phone: p?.phone ?? null,
          code: e.code,
          enrolledAt: e.enrolled_at,
        });
      }

      return Array.from(byCourse.values())
        .filter((c) => c.subscribers.length > 0)
        .sort((a, b) => b.subscribers.length - a.subscribers.length);
    },
    staleTime: 30_000,
  });
}
