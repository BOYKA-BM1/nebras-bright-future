import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Loader2, Mail, Lock, User as UserIcon, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/site/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | نبراس التعليمية" },
      {
        name: "description",
        content: "سجّل دخولك إلى منصة نبراس بالبريد الإلكتروني أو حساب جوجل أو آبل وابدأ التعلم.",
      },
    ],
  }),
  component: AuthPage,
});




function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  

  // استعادة كلمة السر بكود OTP
  const [reset, setReset] = useState(false);
  const [resetStep, setResetStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/dashboard" });
    }
  }, [user, loading, navigate]);

  const sendResetCode = async () => {
    if (!email) { toast.error("اكتب بريدك الإلكتروني الأول."); return; }
    setResetBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      toast.success("بعتنالك كود تأكيد على بريدك ✉️");
      setResetStep("code");
    } catch {
      toast.error("تعذّر إرسال الكود، تأكد من البريد وحاول تاني.");
    } finally {
      setResetBusy(false);
    }
  };

  const verifyResetCode = async () => {
    if (code.trim().length < 6) { toast.error("اكتب الكود المكوّن من 6 أرقام."); return; }
    if (newPassword.length < 8) { toast.error("كلمة السر الجديدة لازم تكون 8 أحرف على الأقل."); return; }
    setResetBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "recovery" });
      if (error) throw error;
      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updErr) throw updErr;
      toast.success("تم تغيير كلمة السر بنجاح! 🎉");
      navigate({ to: "/dashboard" });
    } catch {
      toast.error("الكود غير صحيح أو انتهت صلاحيته، حاول تاني.");
    } finally {
      setResetBusy(false);
    }
  };



  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("من فضلك أدخل البريد وكلمة المرور.");
      return;
    }
    if (password.length < 8) {
      toast.error("كلمة المرور لازم تكون 8 أحرف على الأقل.");
      return;
    }
    setSubmitting(true);
    try {
      // امنع البريد المحظور من التسجيل/الدخول
      const { data: banned } = await supabase.rpc("is_email_banned", { _email: email });
      if (banned) {
        toast.error("تم حظر هذا الحساب من المنصة. برجاء التواصل مع إدارة المنصة.");
        setSubmitting(false);
        return;
      }
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/dashboard",
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("تم إنشاء حسابك بنجاح! 🎉");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("أهلًا بعودتك! 👋");
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "حدث خطأ";
      if (/banned|blocked|محظور/i.test(message)) {
        toast.error("تم حظر هذا الحساب من المنصة. برجاء التواصل مع إدارة المنصة.");
      } else if (/invalid login/i.test(message)) {
        toast.error("البريد أو كلمة المرور غير صحيحة.");
      } else if (/already registered|user already/i.test(message)) {
        toast.error("هذا البريد مسجّل بالفعل، سجّل دخولك.");
      } else {
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-hero px-4 py-12">
      <div className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-3xl border border-border bg-card/80 p-7 shadow-card backdrop-blur-xl sm:p-9">
          {reset ? (
            <>
              <h1 className="text-center text-2xl font-extrabold">نسيت كلمة السر؟</h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {resetStep === "email"
                  ? "اكتب بريدك وهنبعتلك كود تأكيد من 6 أرقام."
                  : "اكتب الكود اللي وصلك على البريد وكلمة السر الجديدة."}
              </p>

              {resetStep === "email" ? (
                <div className="mt-7 grid gap-4">
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      placeholder="البريد الإلكتروني"
                      className="w-full rounded-xl border border-input bg-background/60 px-10 py-3 text-sm outline-none transition-colors focus:border-primary"
                    />
                  </div>
                  <button
                    onClick={sendResetCode}
                    disabled={resetBusy}
                    className="flex items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3 text-sm font-bold text-primary-foreground shadow-gold disabled:opacity-70"
                  >
                    {resetBusy && <Loader2 className="h-4 w-4 animate-spin" />} إرسال الكود
                  </button>
                </div>
              ) : (
                <div className="mt-7 grid gap-4">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    placeholder="كود التأكيد (6 أرقام)"
                    dir="ltr"
                    className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-center text-lg font-bold tracking-[0.4em] outline-none focus:border-primary"
                  />
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      type="password"
                      placeholder="كلمة السر الجديدة (8 أحرف على الأقل)"
                      className="w-full rounded-xl border border-input bg-background/60 px-10 py-3 text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <button
                    onClick={verifyResetCode}
                    disabled={resetBusy}
                    className="flex items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3 text-sm font-bold text-primary-foreground shadow-gold disabled:opacity-70"
                  >
                    {resetBusy && <Loader2 className="h-4 w-4 animate-spin" />} تأكيد وتغيير كلمة السر
                  </button>
                  <button
                    onClick={sendResetCode}
                    disabled={resetBusy}
                    className="text-center text-xs font-bold text-primary hover:underline"
                  >
                    إعادة إرسال الكود
                  </button>
                </div>
              )}

              <p className="mt-6 text-center text-sm">
                <button
                  onClick={() => { setReset(false); setResetStep("email"); setCode(""); setNewPassword(""); }}
                  className="font-bold text-primary hover:underline"
                >
                  ← الرجوع لتسجيل الدخول
                </button>
              </p>
            </>
          ) : (
            <>
          <h1 className="text-center text-2xl font-extrabold">
            {mode === "login" ? "تسجيل الدخول" : "إنشاء حساب جديد"}
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {mode === "login"
              ? "أهلًا بعودتك! سجّل دخولك لمتابعة دوراتك."
              : "انضم لآلاف الطلاب وابدأ رحلتك نحو التفوّق."}
          </p>

          <form onSubmit={handleEmail} className="mt-7 grid gap-4">

            {mode === "signup" && (
              <div className="relative">
                <UserIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  type="text"
                  placeholder="الاسم بالكامل"
                  className="w-full rounded-xl border border-input bg-background/60 px-10 py-3 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="البريد الإلكتروني"
                className="w-full rounded-xl border border-input bg-background/60 px-10 py-3 text-sm outline-none transition-colors focus:border-primary"
              />
            </div>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="كلمة المرور (8 أحرف على الأقل)"
                className="w-full rounded-xl border border-input bg-background/60 px-10 py-3 text-sm outline-none transition-colors focus:border-primary"
              />
            </div>

            {mode === "login" && (
              <button
                type="button"
                onClick={() => setReset(true)}
                className="justify-self-start text-xs font-bold text-primary hover:underline"
              >
                نسيت كلمة السر؟
              </button>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3 text-sm font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02] disabled:opacity-70"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "دخول" : "إنشاء الحساب"}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}{" "}
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="font-bold text-primary hover:underline"
            >
              {mode === "login" ? "أنشئ حساب جديد" : "سجّل دخولك"}
            </button>
          </p>
            </>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← العودة للصفحة الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
