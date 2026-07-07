import { useEffect, useState, type ReactNode } from "react";
import { MonitorSmartphone, LogOut } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { collectFingerprint } from "@/lib/fingerprint";
import { recordSession } from "@/lib/security.functions";

const DEVICE_KEY = "nebras_device_id";

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/**
 * يقفل حساب الطالب على جهاز واحد فقط.
 * أول جهاز يفتح الحساب يتربط بيه، وأي جهاز جديد يتمنع لحد ما الأدمن يعيد التعيين.
 * القفل بيطبّق على الطلاب فقط (مش الأدمن ولا المدرّسين ولا الطاقم).
 */
export function DeviceGuard({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { isAdmin, isTeacher, isStaff, isLoading: rolesLoading } = useRoles();
  const [blocked, setBlocked] = useState(false);
  const [shared, setShared] = useState(false);
  const record = useServerFn(recordSession);

  useEffect(() => {
    if (loading || rolesLoading) return;
    if (!user) {
      setBlocked(false);
      setShared(false);
      return;
    }
    // القفل للطلاب فقط
    const isStudent = !isAdmin && !isTeacher && !isStaff;
    if (!isStudent) {
      setBlocked(false);
      setShared(false);
      return;
    }
    let cancelled = false;
    const deviceId = getDeviceId();
    const label = (navigator.userAgent || "جهاز غير معروف").slice(0, 250);
    supabase
      .rpc("bind_device", { _device_id: deviceId, _label: label })
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setBlocked(data === "blocked");
      });

    // بصمة الجهاز + كشف مشاركة الحساب (يعمل مرة واحدة لكل جلسة)
    const fp = collectFingerprint();
    record({
      data: {
        fingerprint: fp.fingerprint,
        deviceType: fp.deviceType,
        browser: fp.browser,
        screen: fp.screen,
        timezone: fp.timezone,
        hardware: fp.hardware,
      },
    })
      .then((res) => {
        if (cancelled) return;
        if (res?.block) {
          setShared(true);
          // طرد تلقائي بعد لحظة عشان يشوف الرسالة
          setTimeout(() => signOut(), 3500);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, isAdmin, isTeacher, isStaff, rolesLoading]);

  if (shared) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
          <MonitorSmartphone className="h-8 w-8" />
        </span>
        <h1 className="text-2xl font-extrabold">تم رصد نشاط مشبوه على حسابك</h1>
        <p className="max-w-md text-muted-foreground">
          حسابك اتفتح من جهاز أو مكان مختلف في نفس الوقت، وده مخالف لسياسة الاستخدام. تم تسجيل
          خروجك تلقائيًا وتنبيه الإدارة. لو ده انت فعلًا، تواصل مع إدارة المنصة.
        </p>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-2 rounded-xl bg-gradient-gold px-6 py-3 text-sm font-bold text-primary-foreground shadow-gold"
        >
          <LogOut className="h-4 w-4" /> تسجيل الخروج
        </button>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
          <MonitorSmartphone className="h-8 w-8" />
        </span>
        <h1 className="text-2xl font-extrabold">الحساب مفتوح على جهاز آخر</h1>
        <p className="max-w-md text-muted-foreground">
          حسابك مربوط بجهاز واحد فقط، ومش هينفع تفتحه من جهاز تاني. لو عايز تغيّر الجهاز،
          تواصل مع إدارة المنصة علشان يعيدوا تعيين جهازك.
        </p>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-2 rounded-xl bg-gradient-gold px-6 py-3 text-sm font-bold text-primary-foreground shadow-gold"
        >
          <LogOut className="h-4 w-4" /> تسجيل الخروج
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
