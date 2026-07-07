import { useRef, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Send, Loader2, Bot, User as UserIcon, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { askTutor } from "@/lib/ai-tutor.functions";

export const Route = createFileRoute("/_authenticated/ai")({
  component: AiTutorPage,
});

type ChatMsg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "اشرحلي أصعب جزء في آخر محاضرة",
  "لخّصلي المحاضرة في نقاط",
  "اديني تمرين على الدرس وصحّحلي",
  "اسألني أسئلة مراجعة على المحاضرة",
];

function stageLabel(grade?: string | null): string {
  if (!grade) return "";
  if (grade.includes("الابتدائي")) return "المرحلة الابتدائية";
  if (grade.includes("الإعدادي")) return "المرحلة الإعدادية";
  if (grade.includes("الثانوي")) return "المرحلة الثانوية";
  return "";
}

function AiTutorPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { user } = useAuth();
  const callTutor = useServerFn(askTutor);

  // سجل المدرّس له الأولوية لو المستخدم مدرّس (ممكن يكون عنده ملف طالب قديم)
  const { data: teacherRow, isLoading: teacherLoading } = useQuery({
    queryKey: ["my-teacher-grade", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("teachers")
        .select("grade, stage")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | null>(null);

  useEffect(() => () => { if (typingTimer.current) clearTimeout(typingTimer.current); }, []);

  const grade = (teacherRow?.grade?.trim() || profile?.grade?.trim() || "");
  const hasGrade = !!grade;
  const loading = profileLoading || teacherLoading;


  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  // تأثير الكتابة الحيّة: يظهر الرد حرفًا حرفًا زي شات جي بي تي
  const typeReply = (reply: string) =>
    new Promise<void>((resolve) => {
      const chars = Array.from(reply);
      // نضيف رسالة مساعد فاضية ونملاها تدريجيًا
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      let i = 0;
      const step = () => {
        // نكتب كذا حرف في المرة عشان السرعة تبقى طبيعية
        i = Math.min(chars.length, i + 2);
        const shown = chars.slice(0, i).join("");
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: shown };
          return copy;
        });
        if (i < chars.length) {
          typingTimer.current = window.setTimeout(step, 16);
        } else {
          resolve();
        }
      };
      step();
    });

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;

    const next: ChatMsg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setTyping(false);
    try {
      const { reply } = await callTutor({ data: { messages: next.slice(-12) } });
      setTyping(true);
      await typeReply(reply);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حصل خطأ، حاول تاني.");
      setMessages((m) => m.slice(0, -1));
      setInput(content);
    } finally {
      setBusy(false);
      setTyping(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 pb-4 pt-24 sm:px-6">
        {/* رأس */}
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold sm:text-2xl">المساعد الذكي</h1>
              <p className="text-xs text-muted-foreground">بيجاوبك من محاضرات ومذكرات مدرّسينك بس — على قد منهجك بالظبط.</p>
            </div>
          </div>

          {hasGrade && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                <GraduationCap className="h-3.5 w-3.5" /> {grade}
              </span>
              {stageLabel(grade) && (
                <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-muted-foreground">{stageLabel(grade)}</span>
              )}
            </div>
          )}
        </div>

        {/* لازم يختار مرحلته وصفّه أولًا */}
        {!loading && !hasGrade ? (
          <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary"><GraduationCap className="h-7 w-7" /></span>
            <h2 className="text-lg font-extrabold">اختر مرحلتك وصفّك الأول</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              المساعد الذكي بيفتح نسخة مخصّصة لمرحلتك وصفّك تلقائيًا. كمّل بياناتك واختر صفّك من صفحة حسابك عشان نبدأ.
            </p>
            <Link to="/onboarding" className="rounded-xl bg-gradient-gold px-6 py-3 text-sm font-bold text-primary-foreground shadow-gold">
              أكمل بياناتي
            </Link>
          </div>
        ) : (
          <>
            {/* المحادثة */}
            <div ref={scrollRef} className="mt-4 flex-1 space-y-4 overflow-y-auto rounded-2xl border border-border bg-card/40 p-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-5 py-10 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Bot className="h-7 w-7" /></span>
                  <p className="max-w-sm text-sm text-muted-foreground">اسألني أي حاجة في محاضراتك واختار من الاقتراحات دي عشان نبدأ:</p>
                  <div className="grid w-full max-w-lg gap-2 sm:grid-cols-2">
                    {STARTERS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-accent"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${m.role === "user" ? "bg-secondary" : "bg-gradient-gold text-primary-foreground"}`}>
                      {m.role === "user" ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </span>
                    <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-gradient-gold text-primary-foreground" : "border border-border bg-card"}`}>
                      {m.content}
                    </div>
                  </div>
                ))
              )}
              {busy && (
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-gold text-primary-foreground"><Bot className="h-4 w-4" /></span>
                  <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> بيفكّر...
                  </div>
                </div>
              )}
            </div>

            {/* الإدخال */}
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-4 flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
                }}
                rows={1}
                placeholder="اكتب سؤالك هنا..."
                className="max-h-40 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary/50"
              />
              <Button type="submit" disabled={busy || !input.trim()} className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
