import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Loader2, LayoutDashboard, BookOpen, Users, GraduationCap, LogOut, ShieldAlert, ShieldCheck,
  Home, Ticket, UsersRound, Percent, Wallet, MonitorSmartphone, Database, Film, MessageCircle,
  HeartHandshake, Menu, X,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { Logo } from "@/components/site/Logo";
import { ThemeToggle } from "@/components/site/ThemeToggle";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const navItems = [
  { to: "/admin", label: "نظرة عامة", icon: LayoutDashboard, exact: true },
  { to: "/admin/payments", label: "الدفع", icon: Wallet, exact: false },
  { to: "/admin/earnings", label: "دخل المدرّسين", icon: Percent, exact: false },
  { to: "/admin/courses", label: "الدورات", icon: BookOpen, exact: false },
  { to: "/admin/teachers", label: "المدرّسون", icon: Users, exact: false },
  { to: "/admin/accounts", label: "الحسابات", icon: UsersRound, exact: false },
  { to: "/admin/devices", label: "الأجهزة", icon: MonitorSmartphone, exact: false },
  { to: "/admin/security", label: "الأمان", icon: ShieldCheck, exact: false },
  { to: "/admin/stages", label: "المراحل", icon: GraduationCap, exact: false },
  { to: "/admin/knowledge", label: "معرفة الذكاء", icon: Database, exact: false },
  { to: "/admin/coupons", label: "الكوبونات", icon: Ticket, exact: false },
  { to: "/psych", label: "الغرفة النفسية", icon: HeartHandshake, exact: false },
  // لوحات الطاقم — الأدمن يقدر يفتحها ويتابعها مباشرة
  { to: "/staff/montage", label: "المونتاج", icon: Film, exact: false },
  { to: "/staff/students", label: "الطلاب (سكرتارية)", icon: Users, exact: false },
  { to: "/staff/support", label: "خدمة العملاء", icon: MessageCircle, exact: false },
];


function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { confirmSignOut } = useAuth();
  const { isAdmin, isFullAdmin, isLoading } = useRoles();
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

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </span>
        <h1 className="text-2xl font-extrabold">غير مصرّح لك</h1>
        <p className="max-w-md text-muted-foreground">
          الصفحة دي مخصّصة لإدارة المنصة فقط. لو محتاج صلاحية أدمن تواصل مع المسؤول.
        </p>
        <Link to="/" className="rounded-xl bg-gradient-gold px-6 py-3 text-sm font-bold text-primary-foreground shadow-gold">
          الرجوع للرئيسية
        </Link>
      </div>
    );
  }

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
              {isFullAdmin ? "لوحة الإدارة" : "لوحة إدارة (ثانوي)"}
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
        aria-label="قائمة الإدارة"
        aria-hidden={!open}
      >
        <div className="mb-6 flex items-center justify-between px-1">
          <Logo showTagline />
          <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border hover:bg-accent" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
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
                aria-current={active ? "page" : undefined}
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
