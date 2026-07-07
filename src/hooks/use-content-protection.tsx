import { useEffect, useState } from "react";

/**
 * حماية المحتوى على مستوى الصفحة:
 * - تعطيل قائمة الزر الأيمن
 * - تعطيل اختصارات حفظ الصفحة / أدوات المطوّر / الطباعة
 * - محاولة إبطال نسخ الشاشة عبر مفتاح PrintScreen (مسح الحافظة)
 * - رصد إخفاء التبويب / فقدان التركيز (يُستخدم لتعتيم الفيديو)
 *
 * ملاحظة: منع تسجيل الشاشة بشكل كامل غير ممكن تقنيًا على الويب،
 * لكن هذه الإجراءات تصعّب التصوير وتجعل أي تسريب قابلًا للتتبّع
 * عبر العلامة المائية المرتبطة بهوية الطالب.
 */
export function useContentProtection() {
  const [obscured, setObscured] = useState(false);

  useEffect(() => {
    const blockContextMenu = (e: MouseEvent) => e.preventDefault();

    const blockKeys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      // PrintScreen: امسح الحافظة وعتّم مؤقتًا
      if (e.key === "PrintScreen") {
        navigator.clipboard?.writeText("").catch(() => {});
        setObscured(true);
        window.setTimeout(() => setObscured(false), 1400);
        return;
      }
      // أدوات المطوّر ومصدر الصفحة
      if (e.key === "F12") {
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(k)) {
        e.preventDefault();
        return;
      }
      // حفظ / طباعة / عرض المصدر
      if ((e.ctrlKey || e.metaKey) && ["s", "p", "u"].includes(k)) {
        e.preventDefault();
      }
    };

    const onVisibility = () => setObscured(document.hidden);
    const onBlur = () => setObscured(true);
    const onFocus = () => setObscured(false);
    const onBeforePrint = () => setObscured(true);
    const onAfterPrint = () => setObscured(false);

    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("keydown", blockKeys, true);
    document.addEventListener("keyup", blockKeys, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);

    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("keydown", blockKeys, true);
      document.removeEventListener("keyup", blockKeys, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

  return { obscured };
}
