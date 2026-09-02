import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Award, LogOut, ExternalLink, Calendar } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { NotificationBell } from "@/components/site/NotificationBell";
import { useAuth } from "@/hooks/use-auth";
import { useMyCertificates } from "@/hooks/use-certificates";

export const Route = createFileRoute("/_authenticated/certificates")({
  component: MyCertificates,
});

function MyCertificates() {
  const { confirmSignOut } = useAuth();
  const navigate = useNavigate();
  const { data: certificates = [], isLoading } = useMyCertificates();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button onClick={() => confirmSignOut(() => navigate({ to: "/" }))} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Award className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">شهاداتي</h1>
            <p className="text-sm text-muted-foreground">شهادات إتمام الدورات اللي خلّصتها.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : certificates.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">
            لسه معندكش شهادات. كمّل كل دروس أي دورة عشان تستحق شهادتك 🎓
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {certificates.map((c) => (
              <div key={c.id} className="rounded-2xl border border-primary/30 bg-card p-5 shadow-card">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold">
                  <Award className="h-6 w-6" />
                </span>
                <p className="mt-3 font-extrabold">{c.courseTitle}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" /> {new Date(c.issued_at).toLocaleDateString("ar-EG")}
                </p>
                {c.status === "revoked" && <p className="mt-2 text-xs font-bold text-destructive">هذه الشهادة مُلغاة</p>}
                <Link
                  to="/verify/$number"
                  params={{ number: c.certificate_number }}
                  target="_blank"
                  className="mt-4 flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
                >
                  عرض شهادة التحقق <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
