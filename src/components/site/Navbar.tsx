import { useEffect, useState } from "react";
import {
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  HeartHandshake,
  MessagesSquare,
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
} from "lucide-react";
import { SearchBar } from "./SearchBar";
import { NotificationBell } from "./NotificationBell";
import { Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
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

/** Seções exclusivas do aluno — todas pela barra lateral principal, sem menu duplicado */
const STUDENT_LINKS = [
  { label: "واجباتي", href: "/assignments", icon: ClipboardList },
  { label: "شهاداتي", href: "/certificates", icon: Award },
  { label: "المواعيد", href: "/calendar", icon: CalendarDays },
  { label: "ملاحظاتي", href: "/notes", icon: StickyNote },
  { label: "المفضّلة", href: "/bookmarks", icon: Bookmark },
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, confirmSignOut } = useAuth();
  const { isAdmin, isTeacher, isMontage, isCustomerService, isSecretary, isPhotographer } =
    useRoles();
  const { data: profile } = useProfile();
  const navigate = useNavigate();

  const isStaffAccount =
    !isAdmin && (isTeacher || isMontage || isCustomerService || isSecretary || isPhotographer);
  const showRooms = !!user && !isStaffAccount;
  const links = isStaffAccount
    ? navLinks.filter((l) => l.href !== "/courses" && l.href !== "/lectures")
    : navLinks;

  const accountTo = isAdmin ? "/admin" : isTeacher ? "/teacher" : "/profile";
  const avatar = resolveImage(profile?.avatar_url);
  const initial = (profile?.full_name || user?.email || "ط").trim().charAt(0).toUpperCase();

  // إغلاق عند Escape
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
    navigate({ to: href });
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
        <nav
          className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6"
          aria-label="شريط التنقل العلوي"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
              aria-expanded={open}
              aria-controls="app-side-drawer"
            >
              {open ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
            </button>
            <Logo />
          </div>

          <div className="hidden flex-1 justify-center md:flex">
            <div className="w-full max-w-md">
              <SearchBar />
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            {user ? (
              <Link
                to={accountTo}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-sm font-bold"
                aria-label="الحساب"
              >
                {avatar ? (
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  initial
                )}
              </Link>
            ) : (
              <Link
                to="/auth"
                className="rounded-xl bg-gradient-gold px-4 py-2 text-sm font-bold text-primary-foreground shadow-gold"
              >
                دخول
              </Link>
            )}
          </div>
        </nav>
      </header>

      {/* Overlay + drawer (ثلاث شرط → تفتح القائمة) */}
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px]"
          aria-label="إغلاق القائمة"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        id="app-side-drawer"
        style={{
          transform: open ? "translateX(0)" : "translateX(var(--drawer-hide, -110%))",
        }}
        className={`fixed inset-y-0 z-[70] flex w-[min(20rem,88vw)] flex-col border-sidebar-border bg-sidebar p-4 shadow-lg transition-transform duration-300 ease-out start-0 ${
          open ? "" : "pointer-events-none"
        }`}
        aria-label="القائمة الجانبية"
        aria-hidden={!open}
      >
        <div className="mb-6 flex items-center justify-between gap-2 px-1">
          <Logo showTagline />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border hover:bg-accent"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {links.map((link) => {
            const Icon = ICONS[link.href] ?? Home;
            return (
              <button
                key={link.href}
                type="button"
                onClick={() => handleNav(link.href, link.gated)}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
              >
                <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                <span className="truncate">{link.label}</span>
              </button>
            );
          })}
          {showRooms && (
            <>
              <Link
                to="/psych"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-sidebar-foreground/80 hover:bg-sidebar-accent"
              >
                <HeartHandshake className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                الغرفة النفسية
              </Link>
              <Link
                to="/community"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-sidebar-foreground/80 hover:bg-sidebar-accent"
              >
                <MessagesSquare className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                غرفة صفّي
              </Link>
            </>
          )}
        </nav>

        <div className="mt-3 space-y-2 border-t border-sidebar-border pt-3">
          {user ? (
            <>
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-gold px-4 py-3 text-sm font-bold text-primary-foreground shadow-gold"
              >
                <LayoutDashboard className="h-4 w-4" aria-hidden />
                لوحتي
              </Link>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  confirmSignOut(() => navigate({ to: "/" }));
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-bold"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                خروج
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center rounded-2xl bg-gradient-gold px-4 py-3 text-sm font-bold text-primary-foreground"
            >
              تسجيل الدخول
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
