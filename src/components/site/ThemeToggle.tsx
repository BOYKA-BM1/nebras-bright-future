import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
      title={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
      className={`flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:scale-105 hover:bg-secondary hover:border-primary/30 ${className}`}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 text-primary" />
      ) : (
        <Moon className="h-4 w-4 text-primary" />
      )}
    </button>
  );
}
