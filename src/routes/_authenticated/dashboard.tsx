import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { useMyEnrollments } from "@/hooks/use-content";
import { useProfile } from "@/hooks/use-profile";
import { GamificationPanel } from "@/components/site/GamificationPanel";

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
  const { data: enrollments = [] } = useMyEnrollments();
  const { data: profile, isLoading: profileLoading } = useProfile();

  // كل حساب يروح لصفحته الخاصة على طول
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

  // الحساب الجديد يختار نوعه (طالب / ولي أمر) الأول، وبعدين الأونبوردنج
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
  }, [rolesLoading, isAdmin, isStaffRole, isPsychologist, accountType, profileLoading, profile, navigate]);

  // ماننتظر تحديد الدور قبل عرض اللوحة — علشان محصلش وميض للوحة الغلط
  if (rolesLoading || roleHome) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
        لوحتي — <span className="text-gradient-gold">إنجازاتي وأوسمتي</span>
      </h1>
      <p className="mt-2 text-muted-foreground">
        نقاطك، أوسمتك، ومكانك بين طلاب المنصة.
      </p>

      <div className="mt-6">
        <GamificationPanel courses={enrollments.length} />
      </div>
    </div>
  );
}
