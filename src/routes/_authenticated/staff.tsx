import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Loader2, LogOut, Home, ShieldAlert, Film, Users, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { Logo } from "@/components/site/Logo";

export const Route = createFileRoute("/_authenticated/staff")({
  component: StaffLayout,
});

const ROLE_LABEL: Record<string, string> = {
  montage: "لوحة المونتاج",
  customer_service: "خدمة العملاء",
  secretary: "السكرتارية",
};

function StaffLayout() {
  const { confirmSignOut } = useAuth();
  const { isAdmin, isMontage, isCustomerService, isSecretary, isLoading } = useRoles();
  const navigate = useNavigate();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const allowed = isAdmin || isMontage || isCustomerService || isSecretary;
  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </span>
        <h1 className="text-2xl font-extrabold">غير مصرّح لك</h1>
        <p className="max-w-md text-muted-foreground">هذه اللوحة مخصّصة لطاقم المنصة فقط.</p>
        <Link to="/" className="rounded-xl bg-gradient-gold px-6 py-3 text-sm font-bold text-primary-foreground shadow-gold">
          الرجوع للرئيسية
        </Link>
      </div>
    );
  }

  const nav: { to: string; label: string; icon: typeof Film }[] = [];
  if (isMontage || isAdmin) nav.push({ to: "/staff/montage", label: "المونتاج", icon: Film });
  if (isCustomerService || isSecretary || isAdmin) nav.push({ to: "/staff/students", label: "الطلاب", icon: Users });
  if (isCustomerService || isAdmin) nav.push({ to: "/staff/support", label: "الاستفسارات", icon: MessageCircle });

  const label =
    (isMontage && ROLE_LABEL.montage) ||
    (isCustomerService && ROLE_LABEL.customer_service) ||
    (isSecretary && ROLE_LABEL.secretary) ||
    "لوحة الطاقم";

  const handleSignOut = async () => { await signOut(); navigate({ to: "/" }); };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary sm:inline">
              {label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link to="/" className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent">
                <Home className="h-4 w-4" /> <span className="hidden sm:inline">الموقع</span>
              </Link>
            )}
            <button onClick={handleSignOut} className="flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-sm font-bold hover:bg-accent">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {nav.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                  active ? "bg-gradient-gold text-primary-foreground shadow-gold" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
