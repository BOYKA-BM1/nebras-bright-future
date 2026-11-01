import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Loader2, LogOut, ShieldAlert, Home, Film, MessageCircle, Users, AlertOctagon, Camera, Menu, X,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { Logo } from "@/components/site/Logo";
import { ThemeToggle } from "@/components/site/ThemeToggle";

export const Route = createFileRoute("/_authenticated/staff")({
  component: StaffLayout,
});

const ROLE_LABEL: Record<string, string> = {
  montage: "لوحة المونتاج",
  customer_service: "خدمة العملاء",
  secretary: "السكرتارية",
  photographer: "لوحة المصوّر",
};

function StaffLayout() {
  const [open, setOpen] = useState(false);
  const { confirmSignOut } = useAuth();
  const { isAdmin, isMontage, isCustomerService, isSecretary, isPhotographer, isLoading } = useRoles();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const allowed = isAdmin || isMontage || isCustomerService || isSecretary || isPhotographer;
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
  if (isPhotographer || isAdmin) nav.push({ to: "/staff/photographer", label: "التصوير", icon: Camera });
  if (isMontage || isAdmin) nav.push({ to: "/staff/montage", label: "المونتاج", icon: Film });
  if (isCustomerService || isSecretary || isAdmin) nav.push({ to: "/staff/students", label: "الطلاب", icon: Users });
  if (isCustomerService || isAdmin) nav.push({ to: "/staff/support", label: "الاستفسارات", icon: MessageCircle });
  if (isSecretary || isAdmin) nav.push({ to: "/staff/complaints", label: "الشكاوى", icon: AlertOctagon });

  const label =
    (isMontage && ROLE_LABEL.montage) ||
    (isCustomerService && ROLE_LABEL.customer_service) ||
    (isSecretary && ROLE_LABEL.secretary) ||
    (isPhotographer && ROLE_LABEL.photographer) ||
    "لوحة الطاقم";

  const handleSignOut = () => {
    confirmSignOut(() => navigate({ to: "/" }));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card shadow-sm hover:bg-accent"
              aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
              aria-expanded={open}
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <Logo />
            <span className="hidden rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary sm:inline">
              {label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <Link to="/" className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">الموقع</span>
            </Link>
            <button type="button" onClick={handleSignOut} className="flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-sm font-bold hover:bg-accent">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </header>

      {open && (
        <button type="button" className="fixed inset-0 z-[60] bg-black/45" aria-label="إغلاق" onClick={() => setOpen(false)} />
      )}

      <aside
        style={{ transform: open ? "translateX(0)" : "translateX(var(--drawer-hide, -110%))" }}
        className={`fixed inset-y-0 z-[70] flex w-[min(20rem,88vw)] flex-col overflow-y-auto border-sidebar-border bg-sidebar p-4 shadow-lg transition-transform duration-300 start-0 ${
          open ? "translate-x-0" : "pointer-events-none opacity-0"
        }`}
        aria-label="قائمة الطاقم"
        aria-hidden={!open}
      >
        <div className="mb-6 flex items-center justify-between px-1">
          <Logo showTagline />
          <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border hover:bg-accent" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors ${
                  active
                    ? "bg-gradient-gold text-primary-foreground shadow-gold"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
