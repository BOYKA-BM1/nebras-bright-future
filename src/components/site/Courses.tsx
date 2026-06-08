import { BookOpen, PlayCircle } from "lucide-react";
import { courses } from "@/data/site";

export function Courses() {
  return (
    <section id="courses" className="relative py-24">
      <div className="pointer-events-none absolute inset-x-0 top-1/3 -z-10 mx-auto h-72 max-w-3xl rounded-full bg-primary/5 blur-3xl" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-widest text-primary">الدورات</span>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            أحدث <span className="text-gradient-gold">الدورات</span> المتاحة
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            دورات مصمّمة بعناية لتغطّي كل احتياجات الطالب وتضمن له التفوّق.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <article
              key={course.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all hover:-translate-y-1.5 hover:border-primary/50"
            >
              <div className="relative flex items-center gap-3 border-b border-border/60 bg-gradient-to-l from-primary/10 to-transparent p-5">
                <img
                  src={course.teacherImage}
                  alt={course.teacher}
                  loading="lazy"
                  width={512}
                  height={512}
                  className="h-14 w-14 rounded-full border-2 border-primary/50 object-cover"
                />
                <div>
                  <p className="text-sm font-bold text-foreground">{course.teacher}</p>
                  <p className="text-xs text-muted-foreground">مدرّس</p>
                </div>
                <span className="absolute left-4 top-4 rounded-full bg-gradient-gold px-3 py-1 text-xs font-bold text-primary-foreground">
                  {course.badge}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-bold leading-snug">{course.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{course.details}</p>

                <div className="mt-5 flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-primary" />
                    {course.lessons} درس
                  </span>
                  <span className="flex items-center gap-1.5">
                    <PlayCircle className="h-4 w-4 text-primary" />
                    {course.videos} فيديو
                  </span>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
                  <span className="text-xl font-extrabold text-gradient-gold">
                    {course.price} ج.م
                  </span>
                  <button className="rounded-xl bg-gradient-gold px-4 py-2 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.04]">
                    اشترك الآن
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
