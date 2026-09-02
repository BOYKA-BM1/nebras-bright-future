import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, ShieldCheck, ShieldAlert, Award, Calendar, BookOpen, User } from "lucide-react";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { useVerifyCertificate } from "@/hooks/use-certificates";

export const Route = createFileRoute("/verify/$number")({
  component: VerifyCertificatePage,
  head: () => ({
    meta: [
      { title: "التحقق من شهادة | Edu Mindly التعليمية" },
      { name: "description", content: "تحقّق من صحة شهادة إتمام دورة صادرة عن منصة Edu Mindly التعليمية." },
    ],
  }),
});

function VerifyCertificatePage() {
  const { number } = Route.useParams();
  const { data: cert, isLoading } = useVerifyCertificate(number);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        {isLoading ? (
          <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : !cert ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 p-10 text-center">
            <ShieldAlert className="h-10 w-10 text-destructive" />
            <p className="font-extrabold text-destructive">شهادة غير موجودة</p>
            <p className="text-sm text-muted-foreground">الرقم "{number}" غير مطابق لأي شهادة صادرة من المنصة.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-primary/30 bg-card p-8 text-center shadow-card">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-gold text-primary-foreground shadow-gold">
              <Award className="h-8 w-8" />
            </span>

            {cert.status === "issued" ? (
              <p className="mt-4 flex items-center justify-center gap-2 font-extrabold text-green-500">
                <ShieldCheck className="h-5 w-5" /> شهادة صحيحة ومُعتمدة
              </p>
            ) : (
              <p className="mt-4 flex items-center justify-center gap-2 font-extrabold text-destructive">
                <ShieldAlert className="h-5 w-5" /> هذه الشهادة مُلغاة
              </p>
            )}

            <h1 className="mt-4 text-xl font-extrabold">{cert.student_name}</h1>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-muted-foreground">
              <BookOpen className="h-4 w-4" /> أتمّ دورة "{cert.course_title}"
            </p>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" /> {new Date(cert.issued_at).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}
            </p>

            <div dir="ltr" className="mt-6 rounded-xl bg-secondary px-4 py-2 text-xs font-bold tracking-widest text-muted-foreground">
              {cert.certificate_number}
            </div>
          </div>
        )}

        <Link to="/" className="mt-6 block text-center text-sm text-primary hover:underline">العودة للصفحة الرئيسية</Link>
      </main>
      <Footer />
    </div>
  );
}
