import { Mail, Phone, MessageCircle, MapPin } from "lucide-react";
import { Logo } from "./Logo";
import { navLinks } from "@/data/site";

const contacts = [
  { icon: Mail, label: "البريد الإلكتروني", value: "support@nibras.edu.eg" },
  { icon: Phone, label: "الهاتف", value: "+20 100 000 0000" },
  { icon: MessageCircle, label: "الدردشة المباشرة", value: "من 9 صباحًا إلى 6 مساءً" },
  { icon: MapPin, label: "العنوان", value: "القاهرة، مصر" },
];

export function Footer() {
  return (
    <footer id="contact" className="relative border-t border-border bg-card/40">
      {/* CTA */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="-mt-16 mb-16 rounded-3xl border border-primary/30 bg-gradient-to-l from-primary/15 via-card to-card p-8 text-center shadow-card sm:p-12">
          <h2 className="text-2xl font-extrabold sm:text-3xl">
            جاهز تبدأ رحلتك نحو <span className="text-gradient-gold">التفوّق؟</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            انضم إلى آلاف الطلاب الذين اختاروا نبراس لتحقيق أحلامهم التعليمية.
          </p>
          <a
            href="#courses"
            className="mt-6 inline-block rounded-xl bg-gradient-gold px-8 py-3.5 text-base font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.03]"
          >
            إنشاء حساب مجاني
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_2fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              نبراس — منصة تعليمية مصرية متطورة تجمع أفضل المدرسين وأحدث التقنيات
              لتقديم تجربة تعليمية استثنائية لكل طالب.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {contacts.map((c) => (
              <div key={c.label} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <c.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{c.label}</p>
                  <p className="text-sm text-muted-foreground">{c.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} منصة نبراس التعليمية. جميع الحقوق محفوظة.</p>
          <nav className="flex flex-wrap items-center gap-4">
            {navLinks.slice(0, 4).map((l) => (
              <a key={l.href} href={l.href} className="hover:text-foreground">
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
