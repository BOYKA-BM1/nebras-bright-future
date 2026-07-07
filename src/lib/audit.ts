// مساعد بسيط لتسجيل أحداث التدقيق من العميل بدون تعطيل الإجراء الأساسي.
import { logAudit } from "@/lib/security.functions";

export function auditEvent(
  action: string,
  entity?: string,
  metadata?: Record<string, unknown>,
): void {
  void logAudit({ data: { action, entity, metadata } }).catch(() => {});
}
