import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { navLinks } from "@/data/site";

export function Navbar() {
  const [open, setOpen] = useState(false);

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
          <a
            href="#contact"
            className="rounded-xl border border-border px-4 py-2 text-sm font-bold text-foreground transition-colors hover:bg-accent"
          >
            تسجيل الدخول
          </a>
          <a
            href="#courses"
            className="rounded-xl bg-gradient-gold px-4 py-2 text-sm font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.03]"
          >
            إنشاء حساب جديد
          </a>
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
            <a
              href="#contact"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-xl border border-border px-4 py-2 text-center text-sm font-bold"
            >
              تسجيل الدخول
            </a>
            <a
              href="#courses"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-xl bg-gradient-gold px-4 py-2 text-center text-sm font-bold text-primary-foreground"
            >
              إنشاء حساب
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
