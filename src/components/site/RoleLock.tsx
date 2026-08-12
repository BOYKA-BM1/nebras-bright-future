import { useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";

/**
 * الحسابات الوظيفية (دكتور نفسي / مدرّس / مونتاج / خدمة عملاء / سكرتارية)
 * مقفولة على لوحتها بس — أي مسار تاني بيرجّعها للوحتها تلقائي.
 * الأدمن والطالب مش متأثرين.
 */
export function RoleLock({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const {
    isAdmin,
    isTeacher,
    isPsychologist,
    isMontage,
    isCustomerService,
    isSecretary,
    isLoading,
  } = useRoles();
  const location = useLocation();
  const navigate = useNavigate();

  let home: string | null = null;
  let allowed: string[] = [];

  if (!isAdmin) {
    if (isPsychologist) {
      home = "/psych";
      allowed = ["/psych"];
    } else if (isTeacher) {
      home = "/teacher";
      allowed = ["/teacher", "/manage"];
    } else if (isMontage) {
      home = "/staff/montage";
      allowed = ["/staff"];
    } else if (isCustomerService) {
      home = "/staff/support";
      allowed = ["/staff"];
    } else if (isSecretary) {
      home = "/staff/students";
      allowed = ["/staff"];
    }
  }

  const path = location.pathname;
  const outside =
    !!home && !allowed.some((p) => path === p || path.startsWith(p + "/"));

  useEffect(() => {
    if (user && home && outside) navigate({ to: home, replace: true });
  }, [user, home, outside, navigate]);

  if (user && !isLoading && home && outside) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
