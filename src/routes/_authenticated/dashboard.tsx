import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Loader2,
  BookOpen,
  ArrowLeft,
  AlertCircle,
  MessageCircle,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { useCourses } from "@/hooks/use-catalog";
import { useMyEnrollments } from "@/hooks/use-content";
import { useMyTickets, useCreateTicket } from "@/hooks/use-staff";
import { useProfile, profileCompletion } from "@/hooks/use-profile";
import { GamificationPanel } from "@/components/site/GamificationPanel";
import { resolveImage } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    isAdmin,
    isTeacher,
    isMontage,
    isCustomerService,
    isSecretary,
    isPsychologist,
    isParent,
    isLoading: rolesLoading,
  } = useRoles();
  const { data: courses = [] } = useCourses();
  const { data: enrollments = [], isLoading } = useMyEnrollments();
  const { data: profile, isLoading: profileLoading } = useProfile();

  const roleHome = rolesLoading
    ? null
    : isAdmin
      ? "/admin"
      : isTeacher
        ? "/teacher"
        : isParent
          ? "/parent"
          : isPsychologist
            ? "/psych"
            : isMontage
              ? "/staff/montage"
              : isCustomerService
                ? "/staff/support"
                : isSecretary
                  ? "/staff/students"
                  : null;

  useEffect(() => {
    if (roleHome) navigate({ to: roleHome });
  }, [roleHome, navigate]);

  const isStaffRole = isTeacher || isMontage || isCustomerService || isSecretary || isParent;

  const accountType = user?.user_metadata?.account_type as string | undefined;
  useEffect(() => {
    if (rolesLoading || isAdmin || isStaffRole || isPsychologist) return;
    if (!accountType) {
      navigate({ to: "/account-type" });
      return;
    }
    if (accountType === "parent") {
      navigate({ to: "/parent-link" });
      return;
    }
    if (!profileLoading && profile && !profile.onboarded) {
      navigate({ to: "/onboarding" });
    }
  }, [
    rolesLoading,
    isAdmin,
    isStaffRole,
    isPsychologist,
    accountType,
    profileLoading,
    profile,
    navigate,
  ]);

  const completion = profileCompletion(profile);

  const myCourses = useMemo(
    () =>
      enrollments
        .map((e) => courses.find((c) => c.id === e.course_id))
        .filter(Boolean) as typeof courses,
    [enrollments, courses],
  );

  if (rolesLoading || roleHome) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        {!completion.complete && (
          <Link
            to="/profile"
            className="mb-6 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 transition-colors hover:bg-primary/15"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">أكمل ملفك الشخصي ({completion.percent}%)</p>
              <p className="text-sm text-muted-foreground">
                لازم تكمّل بياناتك علشان تقدر تحجز وتشترك في الدورات.
              </p>
            </div>
            <ArrowLeft className="h-4 w-4 shrink-0 text-primary" />
          </Link>
        )}
<section className="mt-10" aria-labelledby="dash-gamification">
          <h2 id="dash-gamification" className="text-xl font-extrabold tracking-tight">
            إنجازاتي ونقاطي
          </h2>
          <div className="mt-4">
            <GamificationPanel courses={myCourses.length} />
          </div>
        </section>

        <section className="mt-10" aria-labelledby="dash-my-courses">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="dash-my-courses" className="text-xl font-extrabold tracking-tight">
              كمّل التعلّم
            </h2>
            <Link to="/courses" className="text-sm font-bold text-primary hover:text-primary/80">
              تصفّح كل الدورات
            </Link>
          </div>

          {isLoading ? (
            <div className="mt-8 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : myCourses.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">
              لسه مشترك في ولا دورة. ابدأ من كتالوج الدورات.
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myCourses.map((c) => {
                const img = resolveImage(c.image_url);
                return (
                  <article
                    key={c.id}
                    className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
                  >
                    {img ? (
                      <img src={img} alt="" className="h-36 w-full object-cover" />
                    ) : (
                      <div className="flex h-36 items-center justify-center bg-primary/10 text-primary">
                        <BookOpen className="h-8 w-8" />
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="line-clamp-2 font-extrabold">{c.title}</h3>
                      <Link
                        to="/learn/$courseId"
                        params={{ courseId: c.id }}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-2 text-sm font-bold text-primary-foreground shadow-gold"
                      >
                        كمّل التعلّم <ArrowLeft className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <SupportSection />
      </main>
    </div>
  );
}

function SupportSection() {
  const { data: tickets = [] } = useMyTickets();
  const createTicket = useCreateTicket();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const submit = () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("اكتب الموضوع والرسالة.");
      return;
    }
    createTicket.mutate(
      { subject: subject.trim(), message: message.trim() },
      {
        onSuccess: () => {
          toast.success("تم إرسال استفسارك، هيتم الرد عليك قريبًا ✅");
          setSubject("");
          setMessage("");
        },
        onError: () => toast.error("تعذّر الإرسال."),
      },
    );
  };

  return (
    <section className="mt-12">
      <h2 className="flex items-center gap-2 text-xl font-extrabold">
        <MessageCircle className="h-5 w-5 text-primary" /> الدعم والاستفسارات
      </h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm font-bold">أرسل استفسار جديد</p>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="الموضوع"
            className="mt-3 w-full rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="اكتب استفسارك هنا..."
            rows={3}
            className="mt-3 w-full rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={submit}
            disabled={createTicket.isPending}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-gold disabled:opacity-70"
          >
            {createTicket.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            إرسال
          </button>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm font-bold">استفساراتك السابقة</p>
          {tickets.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">مفيش استفسارات لسه.</p>
          ) : (
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {tickets.slice(0, 10).map((t: { id: string; subject?: string; status?: string }) => (
                <li
                  key={t.id}
                  className="rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm"
                >
                  <p className="font-bold">{t.subject || "بدون موضوع"}</p>
                  <p className="text-xs text-muted-foreground">{t.status || "قيد المراجعة"}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
