import { Star, BookOpen } from "lucide-react";
import { teachers } from "@/data/site";

export function Teachers() {
  return (
    <section id="teachers" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-widest text-primary">المدرسون</span>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            مدرّسونا <span className="text-gradient-gold">المتخصّصون</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            تعرّف على فريقنا من أفضل المدرّسين المتخصّصين في مختلف المواد الدراسية.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {teachers.map((t) => (
            <article
              key={t.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card text-center shadow-card transition-all hover:-translate-y-1.5 hover:border-primary/50"
            >
              <div className="relative mx-auto mt-8 h-32 w-32">
                <div className="absolute inset-0 rounded-full bg-gradient-gold blur-md opacity-60 transition-opacity group-hover:opacity-90" />
                <img
                  src={t.image}
                  alt={t.name}
                  loading="lazy"
                  width={512}
                  height={512}
                  className="relative h-32 w-32 rounded-full border-4 border-card object-cover"
                />
              </div>

              <div className="p-6">
                <h3 className="text-xl font-bold">{t.name}</h3>
                <p className="mt-1 text-sm text-primary">{t.subject}</p>

                <div className="mt-4 flex items-center justify-center gap-5 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-primary" />
                    {t.courses} دورات
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-primary text-primary" />
                    {t.rating}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
