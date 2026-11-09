/**
 * مصفوفة صلاحيات للعرض في الواجهة فقط.
 * الحماية الحقيقية: Server Functions + RLS.
 *
 * سياسة Pass 3:
 * - Secondary ≈ Full في العمليات اليومية (حظر/حذف غير إداري/أجهزة/دفع/محتوى)
 * - Secondary ممنوع من تعيين/تعديل أدوار admin و admin_secondary
 * - Secondary لا يرى البريد أو IP الأصليين
 */

export const PERMISSIONS = {
  manageFullAdminRoles: "manageFullAdminRoles",
  manageUsers: "manageUsers",
  banUnbanDeleteUsers: "banUnbanDeleteUsers",
  resetDevices: "resetDevices",
  reviewPayments: "reviewPayments",
  managePaymentConfig: "managePaymentConfig",
  viewUnmaskedPII: "viewUnmaskedPII",
  viewSecurityEvents: "viewSecurityEvents",
  accessPsychMessages: "accessPsychMessages",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const FULL_ADMIN: Permission[] = Object.values(PERMISSIONS);

const SECONDARY_ADMIN: Permission[] = [
  PERMISSIONS.manageUsers,
  PERMISSIONS.banUnbanDeleteUsers,
  PERMISSIONS.resetDevices,
  PERMISSIONS.reviewPayments,
  PERMISSIONS.managePaymentConfig,
  PERMISSIONS.viewSecurityEvents,
  // no manageFullAdminRoles, no viewUnmaskedPII
];

export function permissionsForRoles(roles: readonly string[]): Set<Permission> {
  const set = new Set<Permission>();
  if (roles.includes("admin")) FULL_ADMIN.forEach((p) => set.add(p));
  if (roles.includes("admin_secondary")) SECONDARY_ADMIN.forEach((p) => set.add(p));
  return set;
}

export function can(roles: readonly string[], permission: Permission): boolean {
  return permissionsForRoles(roles).has(permission);
}

export function isPaymentMethodConfigured(m: {
  is_active?: boolean | null;
  number?: string | null;
  instructions?: string | null;
}): boolean {
  if (!m?.is_active) return false;
  const num = (m.number ?? "").trim();
  const instr = (m.instructions ?? "").trim();
  return num.length >= 3 || instr.length >= 8;
}
