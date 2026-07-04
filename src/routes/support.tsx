import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, MessageCircle, Send, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { useAuth } from "@/hooks/use-auth";
import { useMyTickets, useCreateTicket } from "@/hooks/use-staff";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "الاستفسارات والدعم | تواصل مع فريق نبراس" },
      {
        name: "description",
        content:
          "أرسل استفسارك لفريق منصة نبراس التعليمية وتابع الرد عليه. دعم سريع لكل الطلاب حول الدورات والاشتراكات والمحاضرات.",
      },
      { property: "og:title", content: "الاستفسارات والدعم | نبراس" },
      { property: "og:description", content: "تواصل مع فريق نبراس وأرسل استفساراتك وتابع الردود." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <header className="bg-hero pt-32 pb-8 text-center sm:pt-36">
        <span className="text-sm font-bold uppercase tracking-widest text-primary">الدعم</span>
        <h1 className="mx-auto mt-3 max-w-3xl px-4 text-3xl font-extrabold sm:text-5xl">
          الاستفسارات <span className="text-gradient-gold">والدعم</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl px-4 text-lg text-muted-foreground">
          عندك سؤال عن دورة أو اشتراك أو محاضرة؟ ابعتلنا استفسارك وفريقنا هيرد عليك في أقرب وقت.
        </p>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        {user ? <SupportInner /> : <GuestCta />}
      </main>
      <Footer />
    </div>
  );
}

function GuestCta() {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-card">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <MessageCircle className="h-7 w-7" />
      </span>
      <h2 className="mt-4 text-xl font-extrabold">سجّل الدخول لإرسال استفسارك</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        علشان نقدر نرد عليك ونتابع استفسارك، لازم تسجّل دخولك الأول.
      </p>
      <Link
        to="/auth"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-6 py-3 text-sm font-bold text-primary-foreground shadow-gold"
      >
        <LogIn className="h-4 w-4" /> تسجيل الدخول
      </Link>
    </div>
  );
}

function SupportInner() {
  const { data: tickets = [] } = useMyTickets();
  const createTicket = useCreateTicket();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const submit = () => {
    if (!subject.trim() || !message.trim()) { toast.error("اكتب الموضوع والرسالة."); return; }
    createTicket.mutate(
      { subject: subject.trim(), message: message.trim() },
      {
        onSuccess: () => { toast.success("تم إرسال استفسارك، هيتم الرد عليك قريبًا ✅"); setSubject(""); setMessage(""); },
        onError: () => toast.error("تعذّر الإرسال."),
      },
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><Send className="h-5 w-5 text-primary" /> استفسار جديد</h2>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="الموضوع"
          className="mt-4 w-full rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none focus:border-primary"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="اكتب استفسارك هنا..."
          rows={5}
          className="mt-3 w-full rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={submit}
          disabled={createTicket.isPending}
          className="mt-3 flex items-center gap-2 rounded-xl bg-gradient-gold px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-gold disabled:opacity-60"
        >
          {createTicket.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} إرسال
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><MessageCircle className="h-5 w-5 text-primary" /> استفساراتي ({tickets.length})</h2>
        {tickets.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">لا يوجد استفسارات بعد.</p>
        ) : (
          <div className="mt-4 space-y-3 max-h-[28rem] overflow-y-auto">
            {tickets.map((t) => (
              <div key={t.id} className="rounded-xl border border-border/60 bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">{t.subject}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${t.status === "answered" ? "bg-green-500/15 text-green-500" : "bg-orange-500/15 text-orange-400"}`}>
                    {t.status === "answered" ? "تم الرد" : "قيد المعالجة"}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{t.message}</p>
                {t.response && (
                  <div className="mt-2 rounded-lg bg-primary/10 p-2 text-xs">
                    <span className="font-bold text-primary">الرد: </span>{t.response}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
