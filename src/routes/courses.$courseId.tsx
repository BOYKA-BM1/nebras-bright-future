import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Loader2, BookOpen, Clock, Video, PlayCircle, Lock, Check, Heart,
  ArrowRight, GraduationCap, ChevronLeft, FileText, Ticket, X, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/site/Logo";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { useCourse, useCourseContent, useEnrollment, useEnroll, useUnenroll, useFavorites } from "@/hooks/use-content";
import { useMyPaymentRequests } from "@/hooks/use-payments";
import { PaymentDialog } from "@/components/site/PaymentDialog";
import { useProfile, profileCompletion } from "@/hooks/use-profile";
import { resolveImage, levelLabel } from "@/lib/catalog";

export const Route = createFileRoute("/courses/$courseId")({
  component: CourseDetail,
  errorComponent: () => (
    <Centered>
      <p className="text-muted-foreground">حصل خطأ في تحميل الدورة.</p>
      <Link to="/" className="text-primary underline">الرجوع للرئيسية</Link>
    </Centered>
  ),
  notFoundComponent: () => (
    <Centered>
      <p className="text-muted-foreground">الدورة مش موجودة.</p>
      <Link to="/" className="text-primary underline">الرجوع للرئيسية</Link>
    </Centered>
  ),
});

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">{children}</div>;
}

function CourseDetail() {
  const { courseId } = Route.useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { data: course, isLoading } = useCourse(courseId);
  const { sections, lessons, isLoading: contentLoading } = useCourseContent(courseId);
  const { isEnrolled } = useEnrollment(courseId);
  const enroll = useEnroll();
  const unenroll = useUnenroll();
  const { favoriteIds, toggle } = useFavorites();
  const { data: profile } = useProfile();
  const { isAdmin, isTeacher, isStaff } = useRoles();
  const isStudentAccount = !isAdmin && !isTeacher && !isStaff;

  const [couponCode, setCouponCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [coupon, setCoupon] = useState<{ id: string; label: string; finalPrice: number } | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const { data: myRequests = [] } = useMyPaymentRequests();
  const pendingRequest = myRequests.find((r) => r.course_id === courseId && r.status === "pending");

  const totalMinutes = useMemo(() => lessons.reduce((s, l) => s + (l.duration_minutes || 0), 0), [lessons]);

  if (isLoading) return <Centered><Loader2 className="h-8 w-8 animate-spin text-primary" /></Centered>;
  if (!course) return <Centered><p className="text-muted-foreground">الدورة مش موجودة.</p><Link to="/" className="text-primary underline">الرجوع</Link></Centered>;

  const img = resolveImage(course.image_url) ?? resolveImage(course.teacher?.image_url);
  const isFav = favoriteIds.has(course.id);
  const finalPrice = coupon ? coupon.finalPrice : course.price;

  const applyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) return;
    if (!user) { toast.info("سجّل دخولك الأول علشان تستخدم الكوبون."); router.navigate({ to: "/auth" }); return; }
    setApplying(true);
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("id, code, course_id, teacher_id, discount_amount, discount_percent, is_active, expires_at, max_uses, used_count")
        .ilike("code", code)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) { toast.error("الكوبون غير صحيح."); return; }
      // لازم يكون كوبون الدورة دي أو كوبون المدرّس صاحب الدورة
      const matchesCourse = !data.course_id || data.course_id === course.id;
      const matchesTeacher = !data.teacher_id || data.teacher_id === course.teacher_id;
      if (!matchesCourse || !matchesTeacher) { toast.error("الكوبون ده مش صالح لهذه الدورة."); return; }
      if (data.expires_at && new Date(data.expires_at) < new Date()) { toast.error("انتهت صلاحية الكوبون."); return; }
      if (data.max_uses != null && data.used_count >= data.max_uses) { toast.error("تم استهلاك عدد مرات استخدام الكوبون."); return; }

      let discounted = course.price;
      let label = "";
      if (data.discount_percent) {
        discounted = Math.max(0, Math.round(course.price * (1 - data.discount_percent / 100)));
        label = `خصم ${data.discount_percent}%`;
      } else if (data.discount_amount) {
        discounted = Math.max(0, course.price - data.discount_amount);
        label = `خصم ${data.discount_amount} ج.م`;
      }
      setCoupon({ id: data.id, label, finalPrice: discounted });
      toast.success(`تم تطبيق الكوبون ✅ ${label}`);
    } catch {
      toast.error("تعذّر التحقق من الكوبون، حاول تاني.");
    } finally {
      setApplying(false);
    }
  };

  const clearCoupon = () => { setCoupon(null); setCouponCode(""); };

  const handleEnroll = () => {
    if (!user) {
      toast.info("سجّل دخولك الأول.");
      router.navigate({ to: "/auth" });
      return;
    }
    // لازم الطالب يكمّل ملفه الشخصي قبل الحجز
    if (!profileCompletion(profile).complete) {
      toast.info("أكمل بيانات ملفك الشخصي الأول علشان تقدر تحجز.");
      router.navigate({ to: "/profile" });
      return;
    }
    // الدورات المجانية تُفعّل مباشرة، والمدفوعة تفتح نافذة الدفع اليدوي
    if (finalPrice === 0) {
      enroll.mutate(
        { courseId: course.id, price: finalPrice, couponId: coupon?.id ?? null },
        {
          onSuccess: () => {
            toast.success("تم تفعيل اشتراكك! 🎉");
            router.navigate({ to: "/learn/$courseId", params: { courseId: course.id } });
          },
          onError: () => toast.error("تعذّر الاشتراك، حاول تاني."),
        },
      );
      return;
    }
    setShowPayment(true);
  };

  const handleUnenroll = () => {
    unenroll.mutate(course.id, {
      onSuccess: () => toast.success("تم إلغاء اشتراكك في الدورة."),
      onError: () => toast.error("تعذّر إلغاء الاشتراك، حاول تاني."),
    });
  };




  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <Link to="/" hash="courses" className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent">
            <ChevronLeft className="h-4 w-4" /> كل الدورات
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* المحتوى */}
          <div className="lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {course.stage && (
                <span className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 font-bold text-primary">
                  <GraduationCap className="h-3.5 w-3.5" /> {levelLabel(course.stage.level)}
                </span>
              )}
              {course.subject && <span className="rounded-full bg-secondary px-3 py-1 font-semibold">{course.subject}</span>}
            </div>

            <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">{course.title}</h1>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{course.description}</p>

            <div className="mt-5 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-primary" /> {lessons.length || course.lessons_count} درس</span>
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary" /> {totalMinutes ? `${Math.round(totalMinutes / 60)} ساعة` : `${course.hours} ساعة`}</span>
              {course.live_sessions > 0 && <span className="flex items-center gap-1.5"><Video className="h-4 w-4 text-primary" /> {course.live_sessions} حصة مباشرة</span>}
            </div>

            {course.teacher && (
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                {resolveImage(course.teacher.image_url) ? (
                  <img src={resolveImage(course.teacher.image_url)!} alt={course.teacher.name} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 font-extrabold text-primary">{course.teacher.name.charAt(0)}</span>
                )}
                <div>
                  <p className="font-bold">{course.teacher.name}</p>
                  <p className="text-sm text-muted-foreground">{course.teacher.subject}</p>
                </div>
              </div>
            )}

            {/* المنهج */}
            <h2 className="mt-10 text-xl font-extrabold">محتوى الدورة</h2>
            {contentLoading ? (
              <div className="mt-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : sections.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-muted-foreground">المحتوى لسه بيتجهّز.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {sections.map((s) => (
                  <div key={s.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="border-b border-border/60 bg-secondary/40 px-5 py-3 font-bold">{s.title}</div>
                    <ul className="divide-y divide-border/60">
                      {s.lessons.map((l) => {
                        const open = isEnrolled || l.is_free;
                        return (
                          <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                            {open ? <PlayCircle className="h-5 w-5 shrink-0 text-primary" /> : <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />}
                            <div className="flex-1">
                              <p className="text-sm font-semibold">{l.title}</p>
                              {l.duration_minutes > 0 && <p className="text-xs text-muted-foreground">{l.duration_minutes} دقيقة</p>}
                            </div>
                            {l.pdf_url && <FileText className="h-4 w-4 text-muted-foreground" />}
                            {l.is_free && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">مجاني</span>}
                          </li>
                        );
                      })}
                      {s.lessons.length === 0 && <li className="px-5 py-3 text-sm text-muted-foreground">لا توجد دروس بعد.</li>}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* بطاقة الشراء */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              {img ? (
                <img src={img} alt={course.title} className="h-44 w-full object-cover" />
              ) : (
                <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-primary/20 to-transparent"><BookOpen className="h-12 w-12 text-primary/50" /></div>
              )}
              <div className="p-5">
                <div className="flex items-end gap-2">
                  {(course.old_price || coupon) && (
                    <span className="text-sm text-muted-foreground line-through">{(coupon ? course.price : course.old_price)} ج.م</span>
                  )}
                  <span className="text-3xl font-extrabold text-gradient-gold">{finalPrice === 0 ? "مجانًا" : `${finalPrice} ج.م`}</span>
                </div>

                {/* إدخال كوبون الخصم */}
                {!isEnrolled && course.price > 0 && (
                  <div className="mt-4">
                    {coupon ? (
                      <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm font-bold text-primary">
                        <span className="flex items-center gap-1.5"><Ticket className="h-4 w-4" /> {coupon.label} مطبّق</span>
                        <button onClick={clearCoupon} className="text-muted-foreground hover:text-foreground" aria-label="إزالة الكوبون">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Ticket className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <input
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } }}
                            placeholder="كوبون الخصم"
                            className="w-full rounded-xl border border-border bg-background py-2.5 pr-9 pl-3 text-sm outline-none focus:border-primary/50"
                          />
                        </div>
                        <button
                          onClick={applyCoupon}
                          disabled={applying || !couponCode.trim()}
                          className="shrink-0 rounded-xl border border-primary/40 px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
                        >
                          {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : "تطبيق"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {isEnrolled ? (
                  <>
                    <Link
                      to="/learn/$courseId"
                      params={{ courseId: course.id }}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3 text-sm font-bold text-primary-foreground shadow-gold"
                    >
                      <Check className="h-4 w-4" /> ادخل الدورة
                    </Link>
                    {isStudentAccount && (
                      <button
                        onClick={handleUnenroll}
                        disabled={unenroll.isPending}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 px-4 py-2.5 text-sm font-bold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-70"
                      >
                        {unenroll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                        إلغاء الاشتراك
                      </button>
                    )}
                  </>
                ) : pendingRequest ? (
                  <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-sm font-bold text-amber-500">
                    طلب دفعك قيد المراجعة ⏳
                    <p className="mt-1 text-xs font-normal text-muted-foreground">
                      هيتم تفعيل اشتراكك بعد تأكيد الدفع من الإدارة.
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleEnroll}
                    disabled={enroll.isPending}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3 text-sm font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02] disabled:opacity-70"
                  >
                    {enroll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    {finalPrice === 0 ? "اشترك مجانًا" : "ادفع واشترك"}
                  </button>
                )}

                {user && (
                  <button
                    onClick={() => toggle.mutate(course.id)}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:bg-accent"
                  >
                    <Heart className={`h-4 w-4 ${isFav ? "fill-destructive text-destructive" : ""}`} />
                    {isFav ? "في المفضّلة" : "أضف للمفضّلة"}
                  </button>
                )}
              </div>

            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
