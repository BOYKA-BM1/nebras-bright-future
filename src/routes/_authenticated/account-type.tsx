import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GraduationCap, Users, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { Logo } from "@/components/site/Logo";

export const Route = createFileRoute("/_authenticated/account-type")({
  component: AccountTypePage,
});

function AccountTypePage() {
  const navigate = useNavigate();
  const { user, confirmSignOut } = useAuth();
  const { isAdmin, isTeacher, isStaff, isPsychologist, isParent, isLoading: rolesLoading } = useRoles();
  const [busy, setBusy] = useState<"student" | "parent" | null>(null);

  const existing = user?.user_metadata?.account_type as string | undefined;

  // أي حساب له دور بالفعل أو اختار نوعه قبل كده يكمّل على طول
  useEffect(() => {
    if (rolesLoading) return;
    if (isAdmin || isTeacher || isStaff || isPsychologist) {
      navigate({ to: "/dashboard" });
      return;
    }
    if (isParent || existing === "parent") {
      navigate({ to: "/parent-link" });
      return;
    }
    if (existing === "student") navigate({ to: "/onboarding" });
  }, [rolesLoading, isAdmin, isTeacher, isStaff, isPsychologist, isParent, existing, navigate]);

  const pick = async (type: "student" | "parent") => {
    setBusy(type);
    try {
      const { error } = await supabase.auth.updateUser({ data: { account_type: type } });
      if (error) throw error;
      navigate({ to: type === "parent" ? "/parent-link" : "/onboarding" });
    } catch {
      toast.error("حصل خطأ، حاول تاني.");
      setBusy(null);
    }
  };

  if (rolesLoading || existing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-hero">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-6">
        <Logo />
        <button
          onClick={() => confirmSignOut(() => navigate({ to: "/" }))}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent"
        >
          <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">خروج</span>
        </button>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl text-center">
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            إنت داخل بصفتك <span className="text-gradient-gold">مين؟</span>
          </h1>
          <p className="mt-2 text-muted-foreground">اختر نوع حسابك مرة واحدة، وبعدها كل مرة تدخل على طول.</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <button
              onClick={() => pick("student")}
              disabled={!!busy}
              className="group flex flex-col items-start rounded-3xl border border-border bg-card p-6 text-right shadow-card transition-all hover:-translate-y-1 hover:border-primary/60 disabled:opacity-60"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-gold text-primary-foreground shadow-gold">
                {busy === "student" ? <Loader2 className="h-7 w-7 animate-spin" /> : <GraduationCap className="h-7 w-7" />}
              </span>
              <h2 className="mt-4 text-xl font-extrabold">طالب</h2>
              <p className="mt-1 text-sm text-muted-foreground">أكمل بياناتك واختر مرحلتك وابدأ التعلّم.</p>
            </button>

            <button
              onClick={() => pick("parent")}
              disabled={!!busy}
              className="group flex flex-col items-start rounded-3xl border border-border bg-card p-6 text-right shadow-card transition-all hover:-translate-y-1 hover:border-primary/60 disabled:opacity-60"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-gold text-primary-foreground shadow-gold">
                {busy === "parent" ? <Loader2 className="h-7 w-7 animate-spin" /> : <Users className="h-7 w-7" />}
              </span>
              <h2 className="mt-4 text-xl font-extrabold">ولي أمر</h2>
              <p className="mt-1 text-sm text-muted-foreground">اكتب كود المتابعة من حساب ابنك وتابع تقدّمه وإشعاراته.</p>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
