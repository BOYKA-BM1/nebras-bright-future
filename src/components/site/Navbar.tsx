import { useState } from "react";
import { Menu, X, LayoutDashboard, LogOut } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { navLinks } from "@/data/site";
import { useAuth } from "@/hooks/use-auth";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo />

        <ul className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 sm:flex">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-bold text-foreground transition-colors hover:bg-accent"
              >
                <LayoutDashboard className="h-4 w-4" />
                لوحة التحكم
              </Link>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-bold transition-colors hover:bg-accent"
              >
                <LogOut className="h-4 w-4" />
                خروج
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
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-border px-4 py-2 text-center text-sm font-bold"
                >
                  لوحة التحكم
                </Link>
                <button
                  onClick={() => {
                    setOpen(false);
                    signOut();
                  }}
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
