import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Loader2, Mail, Lock, User as UserIcon, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.3C29.3 35.1 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.5l6.3 5.3C41.2 36.4 44 30.7 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M16.36 1.43c.04 1.06-.36 2.1-1.05 2.87-.71.8-1.87 1.41-2.99 1.32-.06-1.02.43-2.08 1.08-2.79.73-.79 1.99-1.36 2.96-1.4zM20.3 17.1c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.93-1-4.02-.99-2.09.01-2.52 1.01-4.06.99-1.73-.01-3.05-1.76-4.04-3.32C-.27 16.6-.57 11.6 1.18 8.93c1.06-1.62 2.74-2.57 4.32-2.57 1.61 0 2.62 1.04 3.95 1.04 1.29 0 2.08-1.04 3.94-1.04 1.41 0 2.9.77 3.96 2.1-3.48 1.9-2.91 6.86 1.95 8.64z" />
    </svg>
  );
}

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [social, setSocial] = useState<"google" | "apple" | null>(null);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/dashboard" });
    }
  }, [user, loading, navigate]);

  const handleSocial = async (provider: "google" | "apple") => {
    setSocial(provider);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) {
      setSocial(null);
      toast.error("تعذّر تسجيل الدخول، حاول مرة أخرى.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
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
      if (/invalid login/i.test(message)) {
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
          <h1 className="text-center text-2xl font-extrabold">
            {mode === "login" ? "تسجيل الدخول" : "إنشاء حساب جديد"}
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {mode === "login"
              ? "أهلًا بعودتك! سجّل دخولك لمتابعة دوراتك."
              : "انضم لآلاف الطلاب وابدأ رحلتك نحو التفوّق."}
          </p>

          <div className="mt-7 grid gap-3">
            <button
              onClick={() => handleSocial("google")}
              disabled={!!social}
              className="flex items-center justify-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 text-sm font-bold transition-colors hover:bg-accent disabled:opacity-60"
            >
              {social === "google" ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
              المتابعة باستخدام Google
            </button>
            <button
              onClick={() => handleSocial("apple")}
              disabled={!!social}
              className="flex items-center justify-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 text-sm font-bold transition-colors hover:bg-accent disabled:opacity-60"
            >
              {social === "apple" ? <Loader2 className="h-5 w-5 animate-spin" /> : <AppleIcon />}
              المتابعة باستخدام Apple
            </button>
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            أو بالبريد الإلكتروني
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="grid gap-4">
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
