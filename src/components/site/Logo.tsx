import { Sprout } from "lucide-react";

export function Logo({ className = "", showTagline = false }: { className?: string; showTagline?: boolean }) {
  return (
    <a href="#home" className={`flex items-center gap-2.5 ${className}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold">
        <Sprout className="h-5 w-5" />
      </span>
      <span className="leading-tight">
        <span className="block text-2xl font-extrabold tracking-tight">
          <span className="text-foreground">edu</span>
          <span className="text-gradient-gold">mindly</span>
        </span>
        {showTagline && <span className="block text-[11px] font-medium text-muted-foreground">Learn. Understand. Achieve.</span>}
      </span>
    </a>
  );
}
