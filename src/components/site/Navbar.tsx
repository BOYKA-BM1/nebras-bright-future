import { useState } from "react";
import { Menu, X, LogOut, LayoutDashboard, HeartHandshake, MessagesSquare } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "./Logo";
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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo />

        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <li key={link.href}>
              <button
                onClick={() => handleNav(link.href, link.gated)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </button>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 sm:flex">
          {user ? (
            <>
              {showRooms && (
                <>
                  <Link
                    to="/psych"
                    className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold text-foreground transition-colors hover:bg-accent"
                    aria-label="الغرفة النفسية"
                    title="الغرفة النفسية"
                  >
                    <HeartHandshake className="h-4 w-4 text-primary" />
                    <span className="hidden md:inline">الغرفة النفسية</span>
                  </Link>
                  <Link
                    to="/community"
                    className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold text-foreground transition-colors hover:bg-accent"
                    aria-label="غرفة صفّي"
                    title="غرفة صفّي"
                  >
                    <MessagesSquare className="h-4 w-4 text-primary" />
                    <span className="hidden md:inline">غرفة صفّي</span>
                  </Link>
                </>
              )}
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/20"
                aria-label="لوحتي"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">لوحتي</span>
              </Link>
              <Link
                to={accountTo}
                className="flex items-center gap-2 rounded-full border border-border p-0.5 pl-3 text-sm font-bold text-foreground transition-colors hover:bg-accent"
                aria-label="حسابي"
              >
                {avatar ? (
                  <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-gold text-sm font-extrabold text-primary-foreground">{initial}</span>
                )}
                <span className="hidden max-w-[8rem] truncate md:inline">{profile?.full_name || "حسابي"}</span>
              </Link>
              <button
                onClick={() => confirmSignOut()}
                className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-bold transition-colors hover:bg-accent"
                aria-label="خروج"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="rounded-xl bg-gradient-gold px-5 py-2 text-sm font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.03]"
            >
              تسجيل الدخول
            </Link>
          )}
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-2 text-foreground lg:hidden"
          aria-label="القائمة"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-border/60 bg-background/95 px-4 py-4 lg:hidden">
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <button
                  onClick={() => handleNav(link.href, link.gated)}
                  className="block w-full rounded-lg px-3 py-2.5 text-right text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {link.label}
                </button>
              </li>
            ))}
          </ul>
          {showRooms && (
            <div className="mt-3 flex gap-2">
              <Link
                to="/psych"
                onClick={() => setOpen(false)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-bold"
              >
                <HeartHandshake className="h-4 w-4 text-primary" /> الغرفة النفسية
              </Link>
              <Link
                to="/community"
                onClick={() => setOpen(false)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-bold"
              >
                <MessagesSquare className="h-4 w-4 text-primary" /> غرفة صفّي
              </Link>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-center text-sm font-bold text-primary"
                >
                  <LayoutDashboard className="h-4 w-4" /> لوحتي
                </Link>
                <Link
                  to={accountTo}
                  onClick={() => setOpen(false)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-center text-sm font-bold"
                >
                  حسابي
                </Link>
                <button
                  onClick={() => { setOpen(false); confirmSignOut(); }}
                  className="flex-1 rounded-xl bg-secondary px-4 py-2 text-center text-sm font-bold"
                >
                  خروج
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl bg-gradient-gold px-4 py-2 text-center text-sm font-bold text-primary-foreground"
              >
                تسجيل الدخول
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
