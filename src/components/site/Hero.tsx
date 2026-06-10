import { Star, Users, BookOpen, PlayCircle } from "lucide-react";
import heroBanner from "@/assets/hero-banner.jpg";

const stats = [
  { value: "+50k", label: "طالب", icon: Users },
  { value: "+200", label: "دورة", icon: BookOpen },
  { value: "+3000", label: "فيديو", icon: PlayCircle },
];

export function Hero() {
  return (
    <section id="home" className="relative overflow-hidden bg-hero pt-28 pb-20 sm:pt-36">
      {/* glow orbs */}
      <div className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl animate-pulse-glow" />
      <div className="pointer-events-none absolute -left-24 top-64 h-72 w-72 rounded-full bg-primary/10 blur-3xl animate-pulse-glow" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div className="text-center lg:text-right">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
            <Star className="h-4 w-4 fill-primary" />
            أقوى منصة تعليمية في مصر
          </span>

          <h1 className="mt-6 text-4xl font-extrabold leading-tight sm:text-6xl">
            مرحبًا بك في
            <br />
            <span className="text-gradient-gold">منصة نبراس التعليمية</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground lg:mx-0">
            منصة تعليمية متطورة تجمع أحدث التقنيات مع نخبة من أفضل المدرسين في مصر،
            لتقديم تجربة تعليمية لا مثيل لها لكل المراحل الدراسية.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <a
              href="/courses"
              className="w-full rounded-xl bg-gradient-gold px-7 py-3.5 text-center text-base font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.03] sm:w-auto"
            >
              ابدأ التعلم الآن
            </a>
            <a
              href="#stages"
              className="w-full rounded-xl border border-border bg-card/60 px-7 py-3.5 text-center text-base font-bold text-foreground transition-colors hover:bg-accent sm:w-auto"
            >
              اختر مرحلتك
            </a>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-border bg-card/50 p-4 text-center">
                <s.icon className="mx-auto mb-2 h-6 w-6 text-primary" />
                <div className="text-2xl font-extrabold text-foreground">{s.value}</div>
                <div className="text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 -z-10 rounded-[2rem] bg-primary/20 blur-3xl" />
          <img
            src={heroBanner}
            alt="منصة نبراس التعليمية"
            width={1024}
            height={1024}
            className="animate-float-slow mx-auto w-full max-w-md rounded-[2rem] border border-border/60 shadow-card"
          />
        </div>
      </div>
    </section>
  );
}
