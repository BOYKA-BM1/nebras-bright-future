import { useRoles } from "@/hooks/use-roles";

/**
 * الصفحة الرئيسية الخاصة بكل نوع حساب.
 * الطالب مالوش صفحة خاصة (بيستخدم المنصة كلها) فبيرجع null.
 */
export function useRoleHome() {
  const {
    isAdmin,
    isTeacher,
    isPsychologist,
    isMontage,
    isCustomerService,
    isSecretary,
    isLoading,
  } = useRoles();

  const path = isAdmin
    ? "/admin"
    : isTeacher
      ? "/teacher"
      : isPsychologist
        ? "/psych"
        : isMontage
          ? "/staff/montage"
          : isCustomerService
            ? "/staff/support"
            : isSecretary
              ? "/staff/students"
              : null;

  // الأدمن مسموح له يتفرّج على المنصة كلها، باقي الحسابات لا
  const lockedToPanel = !!path && !isAdmin;

  return { path, lockedToPanel, isLoading };
}
