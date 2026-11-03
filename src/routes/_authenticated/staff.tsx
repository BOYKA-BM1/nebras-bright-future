import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Loader2,
  LayoutDashboard,
  Film,
  Users,
  MessageCircle,
  Camera,
  AlertTriangle,
  Menu,
  X,
  ShieldAlert,
} from "lucide-react";
import { useRoles } from "@/hooks/use-roles";

export const Route = createFileRoute("/_authenticated/staff")({
  component: StaffLayout,
});

const navItems = [
  { to: "/staff", label: "نظرة عامة", icon: LayoutDashboard, exact: true },
  { to: "/staff/montage", label: "المونتاج", icon: Film, exact: false },
  { to: "/staff/photographer", label: "التصوير", icon: Camera, exact: false },
  { to: "/staff/students", label: "الطلاب", icon: Users, exact: false },
  { to: "/staff/support", label: "خدمة العملاء", icon: MessageCircle, exact: false },
  { to: "/staff/complaints", label: "الشكاوى", icon: AlertTriangle, exact: false },
];

function StaffLayout() {
  const [open, setOpen] = useState(false);
  const { isStaff, isAdmin, isLoading } = useRoles();
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

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isStaff && !isAdmin) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </span>
        <h1 className="text-2xl font-extrabold">غير مصرّح لك</h1>
        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          className="rounded-xl bg-gradient-gold px-6 py-3 text-sm font-bold text-primary-foreground shadow-gold"
        >
          الرجوع للرئيسية
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card shadow-sm hover:bg-accent"
          aria-label="فتح قائمة الطاقم"
          aria-expanded={open}
        >
          <Menu className="h-6 w-6" />
        </button>
        <div>
          <p className="text-sm font-extrabold">لوحة الطاقم</p>
          <p className="text-xs text-muted-foreground">المونتاج · الطلاب · الدعم · الشكاوى</p>
        </div>
      </div>

      {open && (
        <button
          type="button"
          className="fixed inset-0 z-[60] bg-black/45"
          aria-label="إغلاق"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 z-[70] flex w-[min(20rem,88vw)] flex-col overflow-y-auto border-sidebar-border bg-sidebar p-4 shadow-lg transition-transform duration-300 start-0 ${
          open ? "translate-x-0" : "ltr:-translate-x-full rtl:translate-x-full"
        }`}
        aria-label="قائمة الطاقم"
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="font-extrabold">أقسام الطاقم</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border hover:bg-accent"
            aria-label="إغلاق"
          >
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
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <Outlet />
      </div>
    </div>
  );
}
