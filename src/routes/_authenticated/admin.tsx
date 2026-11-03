import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Loader2,
  LayoutDashboard,
  BookOpen,
  Users,
  GraduationCap,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  UsersRound,
  Percent,
  Wallet,
  MonitorSmartphone,
  Database,
  Film,
  MessageCircle,
  HeartHandshake,
  Menu,
  X,
  Megaphone,
  Library,
  CreditCard,
  Camera,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const navItems = [
  { to: "/admin", label: "نظرة عامة", icon: LayoutDashboard, exact: true },
  { to: "/admin/payments", label: "الدفع", icon: Wallet, exact: false },
  { to: "/admin/subscriptions", label: "الاشتراكات", icon: CreditCard, exact: false },
  { to: "/admin/earnings", label: "دخل المدرّسين", icon: Percent, exact: false },
  { to: "/admin/courses", label: "الدورات", icon: BookOpen, exact: false },
  { to: "/admin/teachers", label: "المدرّسون", icon: Users, exact: false },
  { to: "/admin/accounts", label: "الحسابات", icon: UsersRound, exact: false },
  { to: "/admin/devices", label: "الأجهزة", icon: MonitorSmartphone, exact: false },
  { to: "/admin/security", label: "الأمان", icon: ShieldCheck, exact: false },
  { to: "/admin/stages", label: "المراحل", icon: GraduationCap, exact: false },
  { to: "/admin/education", label: "التعليم", icon: Library, exact: false },
  { to: "/admin/knowledge", label: "معرفة الذكاء", icon: Database, exact: false },
  { to: "/admin/coupons", label: "الكوبونات", icon: Ticket, exact: false },
  { to: "/admin/broadcast", label: "البث الإداري", icon: Megaphone, exact: false },
  { to: "/psych", label: "الغرفة النفسية", icon: HeartHandshake, exact: false },
  { to: "/staff/montage", label: "المونتاج", icon: Film, exact: false },
  { to: "/staff/photographer", label: "التصوير", icon: Camera, exact: false },
  { to: "/staff/students", label: "الطلاب (سكرتارية)", icon: Users, exact: false },
  { to: "/staff/support", label: "خدمة العملاء", icon: MessageCircle, exact: false },
  { to: "/staff/complaints", label: "الشكاوى", icon: AlertTriangle, exact: false },
];

function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { isAdmin, isLoading } = useRoles();
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

  if (!isAdmin) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </span>
        <h1 className="text-2xl font-extrabold">غير مصرّح لك</h1>
        <p className="max-w-md text-muted-foreground">هذه الصفحة مخصّصة للإدارة فقط.</p>
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
      {/* بدون شريط علوي مكرر — Navbar الأب موجود */}
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card shadow-sm hover:bg-accent"
          aria-label="فتح قائمة الإدارة"
          aria-expanded={open}
        >
          <Menu className="h-6 w-6" />
        </button>
        <div>
          <p className="text-sm font-extrabold">لوحة الإدارة</p>
          <p className="text-xs text-muted-foreground">كل الأقسام من القائمة الجانبية</p>
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
        aria-label="قائمة الإدارة"
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="font-extrabold">أقسام الإدارة</p>
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
