import { useState } from "react";
import { Menu, X, LogOut, LayoutDashboard, HeartHandshake, MessagesSquare, Home, BookOpen, PlayCircle, Bot, MessageCircle, LifeBuoy } from "lucide-react";
import { SearchBar } from "./SearchBar";

const ICONS: Record<string, typeof Home> = { "/#home": Home, "/courses": BookOpen, "/lectures": PlayCircle, "/ai": Bot, "/support": MessageCircle, "/#help": LifeBuoy };
import { Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { navLinks } from "@/data/site";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { useProfile } from "@/hooks/use-profile";
import { resolveImage } from "@/lib/catalog";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, confirmSignOut } = useAuth();
  const { isAdmin, isTeacher, isMontage, isCustomerService, isSecretary, isPhotographer } = useRoles();
  const { data: profile } = useProfile();
  const navigate = useNavigate();

  // المدرّس والطاقم لا يظهر لهم قسم الدورات ولا المحاضرات (خاص بالطلاب فقط)
  const isStaffAccount = !isAdmin && (isTeacher || isMontage || isCustomerService || isSecretary || isPhotographer);
  // الطالب يشوف الغرفة النفسية وغرفة صفّه في كل مكان
  const showRooms = !!user && !isStaffAccount;
  const links = isStaffAccount
    ? navLinks.filter((l) => l.href !== "/courses" && l.href !== "/lectures")
    : navLinks;

  // وجهة صورة المستخدم حسب الدور
  const accountTo = isAdmin ? "/admin" : isTeacher ? "/teacher" : "/profile";
  const avatar = resolveImage(profile?.avatar_url);
  const initial = (profile?.full_name || user?.email || "ط").trim().charAt(0).toUpperCase();

  const handleNav = (href: string, gated: boolean) => {
    setOpen(false);
    if (gated && !user) {
      navigate({ to: "/auth" });
      return;
    }
    if (href.startsWith("/#")) {
      // قسم داخل الصفحة الرئيسية
      if (window.location.pathname !== "/") {
        navigate({ to: "/" });
        setTimeout(() => { window.location.hash = href.slice(1); }, 50);
      } else {
        window.location.hash = href.slice(1);
      }
      return;
    }
    navigate({ to: href });
  };

  return (
    <>
      {/* Desktop sidebar — logical inline-start placement for RTL */}
      <aside
        className="app-sidebar fixed inset-y-0 z-40 hidden w-64 flex-col border-sidebar-border bg-sidebar p-4 lg:flex"
        aria-label="التنقل الرئيسي"
      >
        <div className="mb-8 px-2">
          <Logo showTagline />
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {links.map((link) => {
            const Icon = ICONS[link.href] ?? Home;
            return (
              <button
                key={link.href}
                type="button"
                onClick={() => handleNav(link.href, link.gated)}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
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
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
              >
                <HeartHandshake className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                الغرفة النفسية
              </Link>
              <Link
                to="/community"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
              >
                <MessagesSquare className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                غرفة صفّي
              </Link>
            </>
          )}
        </nav>
        {user && (
          <Link
            to="/dashboard"
            className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-gradient-gold px-4 py-3 text-sm font-bold text-primary-foreground shadow-gold transition-opacity hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden />
            لوحتي
          </Link>
        )}
      </aside>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75 lg:start-64">
        <nav
          className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6"
          aria-label="شريط التنقل العلوي"
        >
          <Logo className="lg:hidden" />

          <div className="hidden flex-1 justify-center md:flex">
            <div className="w-full max-w-md">
              <SearchBar />
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <div className="hidden items-center gap-2 sm:flex">
              {user ? (
                <>
                  {showRooms && (
                    <>
                      <Link
                        to="/psych"
                        className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold text-foreground transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        aria-label="الغرفة النفسية"
                        title="الغرفة النفسية"
                      >
                        <HeartHandshake className="h-4 w-4 text-primary" aria-hidden />
                        <span className="hidden md:inline">الغرفة النفسية</span>
                      </Link>
                      <Link
                        to="/community"
                        className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold text-foreground transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        aria-label="غرفة صفّي"
                        title="غرفة صفّي"
                      >
                        <MessagesSquare className="h-4 w-4 text-primary" aria-hidden />
                        <span className="hidden md:inline">غرفة صفّي</span>
                      </Link>
                    </>
                  )}
                  <Link
                    to="/dashboard"
                    className="flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    aria-label="لوحتي"
                  >
                    <LayoutDashboard className="h-4 w-4" aria-hidden />
                    <span className="hidden sm:inline">لوحتي</span>
                  </Link>
                  <Link
                    to={accountTo}
                    className="flex items-center gap-2 rounded-full border border-border py-0.5 ps-0.5 pe-3 text-sm font-bold text-foreground transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    aria-label="حسابي"
                  >
                    {avatar ? (
                      <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-gold text-sm font-extrabold text-primary-foreground">
                        {initial}
                      </span>
                    )}
                    <span className="hidden max-w-[8rem] truncate md:inline">
                      {profile?.full_name || "حسابي"}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => confirmSignOut()}
                    className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-bold transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    aria-label="خروج"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  className="rounded-xl bg-gradient-gold px-5 py-2 text-sm font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  تسجيل الدخول
                </Link>
              )}
            </div>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded-lg p-2 text-foreground transition-colors hover:bg-accent lg:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
              aria-expanded={open}
              aria-controls="mobile-nav-panel"
            >
              {open ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
            </button>
          </div>
        </nav>

        {/* Mobile navigation drawer */}
        {open && (
          <div
            id="mobile-nav-panel"
            className="max-h-[min(70vh,28rem)] overflow-y-auto border-t border-border/60 bg-background/95 px-4 py-4 backdrop-blur-xl lg:hidden"
          >
            <ul className="flex flex-col gap-1">
              {links.map((link) => (
                <li key={link.href}>
                  <button
                    type="button"
                    onClick={() => handleNav(link.href, link.gated)}
                    className="block w-full rounded-xl px-3 py-2.5 text-start text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
            {showRooms && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  to="/psych"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-bold transition-colors hover:bg-accent"
                >
                  <HeartHandshake className="h-4 w-4 text-primary" aria-hidden />
                  الغرفة النفسية
                </Link>
                <Link
                  to="/community"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-bold transition-colors hover:bg-accent"
                >
                  <MessagesSquare className="h-4 w-4 text-primary" aria-hidden />
                  غرفة صفّي
                </Link>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    onClick={() => setOpen(false)}
                    className="flex min-w-[7rem] flex-1 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-center text-sm font-bold text-primary"
                  >
                    <LayoutDashboard className="h-4 w-4" aria-hidden />
                    لوحتي
                  </Link>
                  <Link
                    to={accountTo}
                    onClick={() => setOpen(false)}
                    className="flex min-w-[7rem] flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-center text-sm font-bold"
                  >
                    حسابي
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      confirmSignOut();
                    }}
                    className="flex min-w-[5rem] flex-1 items-center justify-center rounded-xl bg-secondary px-4 py-2.5 text-center text-sm font-bold"
                  >
                    خروج
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setOpen(false)}
                  className="flex flex-1 items-center justify-center rounded-xl bg-gradient-gold px-4 py-2.5 text-center text-sm font-bold text-primary-foreground"
                >
                  تسجيل الدخول
                </Link>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
