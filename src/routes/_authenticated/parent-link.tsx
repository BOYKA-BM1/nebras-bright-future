import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, LinkIcon, Users, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/site/Logo";
import { useAuth } from "@/hooks/use-auth";
import { useLinkChild, useMyChildren } from "@/hooks/use-parent";

export const Route = createFileRoute("/_authenticated/parent-link")({
  component: ParentLinkPage,
});

function ParentLinkPage() {
  const navigate = useNavigate();
  const { confirmSignOut } = useAuth();
  const { data: children = [] } = useMyChildren();
  const [code, setCode] = useState("");
  const link = useLinkChild();

  const submit = () => {
    if (code.trim().length < 4) {
      toast.error("اكتب الكود اللي ظاهر في صفحة حساب ابنك.");
      return;
    }
    link.mutate(code.trim(), {
      onSuccess: () => {
        toast.success("تم ربط حسابك بحساب ابنك بنجاح ✅");
        navigate({ to: "/parent" });
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "الكود غير صحيح."),
    });
  };

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
        <div className="w-full max-w-md rounded-3xl border border-border bg-card/80 p-7 text-center shadow-card backdrop-blur-xl sm:p-9">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Users className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold">ربط حساب ولي الأمر</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            اطلب من ابنك كود المتابعة الظاهر في صفحة حسابه، واكتبه هنا لمتابعة تقدّمه وإشعاراته.
          </p>

          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="كود المتابعة"
            dir="ltr"
            className="mt-6 w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-center text-lg font-bold tracking-[0.3em] outline-none focus:border-primary"
          />

          <button
            onClick={submit}
            disabled={link.isPending}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3 text-sm font-bold text-primary-foreground shadow-gold disabled:opacity-60"
          >
            {link.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
            ربط الحساب
          </button>

          {children.length > 0 && (
            <button
              onClick={() => navigate({ to: "/parent" })}
              className="mt-5 text-sm font-bold text-primary hover:underline"
            >
              الانتقال إلى لوحة ولي الأمر ←
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
