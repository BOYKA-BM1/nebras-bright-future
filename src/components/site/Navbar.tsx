import { useEffect, useState } from "react";
import {
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  HeartHandshake,
  Home,
  BookOpen,
  PlayCircle,
  Bot,
  MessageCircle,
  LifeBuoy,
  ClipboardList,
  Award,
  CalendarDays,
  StickyNote,
  Bookmark,
  Wallet,
  Percent,
  Users,
  UsersRound,
  MonitorSmartphone,
  ShieldCheck,
  GraduationCap,
  Library,
  Database,
  Ticket,
  Megaphone,
  Film,
  Camera,
  AlertTriangle,
  CreditCard,
} from "lucide-react";
import { SearchBar } from "./SearchBar";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { navLinks } from "@/data/site";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { useProfile } from "@/hooks/use-profile";
import { resolveImage } from "@/lib/catalog";

const ICONS: Record<string, typeof Home> = {
  "/#home": Home,
  "/courses": BookOpen,
  "/lectures": PlayCircle,
  "/ai": Bot,
  "/support": MessageCircle,
  "/#help": LifeBuoy,
};

const ADMIN_NAV = [
  { to: "/admin", label: "نظرة عامة", icon: LayoutDashboard, exact: true },
  { to: "/admin/payments", label: "الدفع", icon: Wallet },
  { to: "/admin/subscriptions", label: "الاشتراكات", icon: CreditCard },
  { to: "/admin/earnings", label: "دخل المدرّسين", icon: Percent },
  { to: "/admin/courses", label: "الدورات", icon: BookOpen },
  { to: "/admin/teachers", label: "المدرّسون", icon: Users },
  { to: "/admin/accounts", label: "الحسابات", icon: UsersRound },
  { to: "/admin/devices", label: "الأجهزة", icon: MonitorSmartphone },
  { to: "/admin/security", label: "الأمان", icon: ShieldCheck },
  { to: "/admin/stages", label: "المراحل", icon: GraduationCap },
  { to: "/admin/education", label: "التعليم", icon: Library },
  { to: "/admin/knowledge", label: "معرفة الذكاء", icon: Database },
  { to: "/admin/coupons", label: "الكوبونات", icon: Ticket },
  { to: "/admin/broadcast", label: "البث الإداري", icon: Megaphone },
  { to: "/psych", label: "الغرفة النفسية", icon: HeartHandshake },
  { to: "/staff/montage", label: "المونتاج", icon: Film },
  { to: "/staff/photographer", label: "التصوير", icon: Camera },
  { to: "/staff/students", label: "الطلاب", icon: Users },
  { to: "/staff/support", label: "خدمة العملاء", icon: MessageCircle },
  { to: "/staff/complaints", label: "الشكاوى", icon: AlertTriangle },
];

function isNavActive(pathname: string, to: string, exact = false) {
  if (exact) return pathname === to;
  if (to === "/admin") return pathname === "/admin" || pathname === "/admin/";
  return pathname === to || pathname.startsWith(to + "/");
}

function navItemClass(active: boolean) {
  return active
    ? "flex items-center gap-3 rounded-2xl bg-primary/15 px-4 py-2.5 text-sm font-extrabold text-primary ring-1 ring-primary/30"
    : "flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-bold text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground";
}

export function Navbar() {

  const [open, setOpen] = useState(false);
  const { user, confirmSignOut } = useAuth();
  const {
    isAdmin,
    isTeacher,
    isMontage,
    isCustomerService,
    isSecretary,
    isPhotographer,
    isPsychologist,
  } = useRoles();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isOpsRole =
    !isAdmin &&
    (isTeacher ||
      isMontage ||
      isCustomerService ||
      isSecretary ||
      isPhotographer ||
      isPsychologist);

  /** أدوار التشغيل: بدون قائمة جانبية */
  const hideDrawer = isOpsRole;
  const showStudentLinks = !!user && !isOpsRole && !isAdmin;
  const links = isOpsRole
    ? []
    : navLinks.filter((l) => !(isAdmin && (l.href === "/courses" || l.href === "/lectures")));

  const avatar = resolveImage(profile?.avatar_url);
  const initial = (profile?.full_name || user?.email || "ط").trim().charAt(0).toUpperCase();

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

  const handleNav = (href: string, gated: boolean) => {
    setOpen(false);
    if (gated && !user) {
      navigate({ to: "/auth" });
      return;
    }
    if (href.startsWith("/#")) {
      if (window.location.pathname !== "/") {
        navigate({ to: "/" });
        setTimeout(() => {
          window.location.hash = href.slice(1);
        }, 50);
      } else {
        window.location.hash = href.slice(1);
      }
      return;
    }
    navigate({ to: href as "/" });
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[60px] max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-6">
          {/* زر قائمة واحد — طلاب: منيو · أدمن: لوحتي تفتح نفس القائمة */}
          {!hideDrawer && !isAdmin && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent"
              aria-label="فتح القائمة"
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
          {!hideDrawer && isAdmin && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-extrabold text-primary hover:bg-primary/15"
              aria-label="فتح لوحة الإدارة"
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <LayoutDashboard className="h-5 w-5" />}
              <span>لوحتي</span>
            </button>
          )}

          <Logo />

          <div className="mx-auto hidden min-w-0 flex-1 md:block md:max-w-md">
            {!isOpsRole && <SearchBar />}
          </div>

          <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
            {user && (
              <>
                <NotificationBell />
                <ThemeToggle />
                {user && !isOpsRole && !isAdmin && (
                  <Link
                    to="/profile"
                    className="hidden items-center gap-2 rounded-full border border-border bg-card px-2 py-1 text-sm font-bold hover:bg-accent sm:flex"
                  >
                    {avatar ? (
                      <img src={avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-extrabold text-primary">
                        {initial}
                      </span>
                    )}
                    <span className="max-w-[7rem] truncate">حسابي</span>
                  </Link>
                )}
                {isOpsRole && (
                  <button
                    type="button"
                    onClick={() => confirmSignOut(() => navigate({ to: "/" }))}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-sm font-bold hover:bg-accent"
                    title="تسجيل الخروج"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">خروج</span>
                  </button>
                )}
              </>
            )}
            {!user && (
              <>
                <ThemeToggle />
                <Link
                  to="/auth"
                  className="rounded-xl bg-gradient-gold px-4 py-2 text-sm font-bold text-primary-foreground shadow-gold"
                >
                  دخول
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {open && !hideDrawer && (
        <button
          type="button"
          className="fixed inset-0 z-[60] bg-black/45"
          aria-label="إغلاق"
          onClick={() => setOpen(false)}
        />
      )}

      {!hideDrawer && (
        <aside
          className={`fixed inset-y-0 z-[70] flex w-[min(20rem,88vw)] flex-col border-sidebar-border bg-sidebar p-4 shadow-lg transition-transform duration-300 start-0 ${
            open ? "translate-x-0" : "ltr:-translate-x-full rtl:translate-x-full"
          }`}
          aria-label="القائمة الجانبية"
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-extrabold">{isAdmin ? "أقسام الإدارة" : "القائمة"}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border hover:bg-accent"
              aria-label="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {isAdmin ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
                <p className="mb-2 px-2 text-xs font-bold text-muted-foreground">أقسام الإدارة</p>
                {ADMIN_NAV.map((item) => {
                  const active = isNavActive(pathname, item.to, !!(item as { exact?: boolean }).exact);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={navItemClass(active)}
                      aria-current={active ? "page" : undefined}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-auto border-t border-sidebar-border pt-3">
                <button
                  type="button"
                  onClick={() => { setOpen(false); confirmSignOut(() => navigate({ to: "/" })); }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-destructive/30 px-4 py-3 text-start text-sm font-bold text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  تسجيل الخروج
                </button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
                {links.map((l) => {
                  const Icon = ICONS[l.href] ?? Home;
                  return (
                    <button
                      key={l.href}
                      type="button"
                      onClick={() => handleNav(l.href, false)}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 text-start text-sm font-bold text-sidebar-foreground/80 hover:bg-sidebar-accent"
                    >
                      <Icon className="h-4 w-4" />
                      {l.label}
                    </button>
                  );
                })}
                {showStudentLinks && (
                  <>
                    <Link to="/assignments" onClick={() => setOpen(false)} className={navItemClass(isNavActive(pathname, "/assignments"))} aria-current={isNavActive(pathname, "/assignments") ? "page" : undefined}>
                      <ClipboardList className="h-4 w-4" /> واجباتي
                    </Link>
                    <Link to="/certificates" onClick={() => setOpen(false)} className={navItemClass(isNavActive(pathname, "/certificates"))} aria-current={isNavActive(pathname, "/certificates") ? "page" : undefined}>
                      <Award className="h-4 w-4" /> شهاداتي
                    </Link>
                    <Link to="/calendar" onClick={() => setOpen(false)} className={navItemClass(isNavActive(pathname, "/calendar"))} aria-current={isNavActive(pathname, "/calendar") ? "page" : undefined}>
                      <CalendarDays className="h-4 w-4" /> المواعيد
                    </Link>
                    <Link to="/notes" onClick={() => setOpen(false)} className={navItemClass(isNavActive(pathname, "/notes"))} aria-current={isNavActive(pathname, "/notes") ? "page" : undefined}>
                      <StickyNote className="h-4 w-4" /> ملاحظاتي
                    </Link>
                    <Link to="/bookmarks" onClick={() => setOpen(false)} className={navItemClass(isNavActive(pathname, "/bookmarks"))} aria-current={isNavActive(pathname, "/bookmarks") ? "page" : undefined}>
                      <Bookmark className="h-4 w-4" /> المفضلة
                    </Link>
                  </>
                )}
              </nav>

              {/* أسفل القائمة — زي الإصدارات القديمة */}
              {user && (
                <div className="mt-auto space-y-2 border-t border-sidebar-border pt-3">
                  <Link
                    to="/dashboard"
                    onClick={() => setOpen(false)}
                    className={
                      isNavActive(pathname, "/dashboard", true)
                        ? "flex w-full items-center gap-3 rounded-2xl bg-primary/20 px-4 py-3 text-sm font-extrabold text-primary ring-1 ring-primary/40"
                        : "flex w-full items-center gap-3 rounded-2xl bg-primary/15 px-4 py-3 text-sm font-extrabold text-primary hover:bg-primary/20"
                    }
                    aria-current={isNavActive(pathname, "/dashboard", true) ? "page" : undefined}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    لوحتي
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      confirmSignOut(() => navigate({ to: "/" }));
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-destructive/30 px-4 py-3 text-start text-sm font-bold text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                    تسجيل الخروج
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      )}
    </>
  );
}
