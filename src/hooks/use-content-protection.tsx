import { useEffect, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { reportBrowserProtectionSignal } from "@/lib/content-protection.functions";

/**
 * حماية محتوى على مستوى المتصفح فقط.
 * - لا تمنع Screenshot/Screen Recording بشكل كامل.
 * - لا ترسل confidence أو confirmed_native من العميل.
 * - التسجيل عبر Server Function فقط.
 */
export function useContentProtection(meta?: {
  courseId?: string | null;
  lessonId?: string | null;
}) {
  const [obscured, setObscured] = useState(false);
  const reportFn = useServerFn(reportBrowserProtectionSignal);
  const lastReport = useRef<Record<string, number>>({});

  const report = useCallback(
    (signal: "printscreen_key" | "devtools_shortcut" | "beforeprint" | "visibilitychange" | "window_blur" | "context_menu_block") => {
      const now = Date.now();
      if (lastReport.current[signal] && now - lastReport.current[signal] < 30_000) return;
      lastReport.current[signal] = now;
      void reportFn({
        data: {
          signal,
          courseId: meta?.courseId ?? null,
          lessonId: meta?.lessonId ?? null,
        },
      }).catch(() => {
        /* لا تعطل التعلم */
      });
    },
    [reportFn, meta?.courseId, meta?.lessonId],
  );

  useEffect(() => {
    const blockContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      report("context_menu_block");
    };

    const blockKeys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.key === "PrintScreen") {
        navigator.clipboard?.writeText("").catch(() => {});
        setObscured(true);
        window.setTimeout(() => setObscured(false), 1400);
        report("printscreen_key");
        return;
      }
      if (e.key === "F12") {
        e.preventDefault();
        report("devtools_shortcut");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(k)) {
        e.preventDefault();
        report("devtools_shortcut");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && ["s", "p", "u"].includes(k)) {
        e.preventDefault();
      }
    };

    const onVisibility = () => {
      const hidden = document.hidden;
      setObscured(hidden);
      if (hidden) report("visibilitychange");
    };
    const onBlur = () => {
      setObscured(true);
      report("window_blur");
    };
    const onFocus = () => setObscured(false);
    const onBeforePrint = () => {
      setObscured(true);
      report("beforeprint");
    };
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
  }, [report]);

  return { obscured };
}
