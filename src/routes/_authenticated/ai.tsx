import { useMemo, useRef, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Send, Loader2, Bot, User as UserIcon, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/site/Navbar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfile } from "@/hooks/use-profile";
import { gradesByLevel, type Level } from "@/data/grades";
import { askTutor } from "@/lib/ai-tutor.functions";

export const Route = createFileRoute("/_authenticated/ai")({
  component: AiTutorPage,
});

type ChatMsg = { role: "user" | "assistant"; content: string };

const LEVELS: { id: Level; label: string }[] = [
  { id: "primary", label: "المرحلة الابتدائية" },
  { id: "prep", label: "المرحلة الإعدادية" },
  { id: "secondary", label: "المرحلة الثانوية" },
];

const STARTERS = [
  "اشرحلي أصعب درس في المنهج ببساطة",
  "اعملي خطة مذاكرة للأسبوع الجاي",
  "اديني تمرين على آخر درس وصحّحلي",
  "لخّصلي الفصل ده في نقاط",
];

function levelFromGrade(grade?: string | null): Level {
  if (!grade) return "secondary";
  if (grade.includes("الابتدائي")) return "primary";
  if (grade.includes("الإعدادي")) return "prep";
  return "secondary";
}

function AiTutorPage() {
  const { data: profile } = useProfile();
  const callTutor = useServerFn(askTutor);

  const [level, setLevel] = useState<Level>("secondary");
  const [grade, setGrade] = useState<string>("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inited = useRef(false);

  // ضبط المرحلة والصف من ملف الطالب تلقائيًا أول مرة
  useEffect(() => {
    if (inited.current || !profile) return;
    inited.current = true;
    const lvl = (["primary", "prep", "secondary"].includes(profile.level ?? "")
      ? (profile.level as Level)
      : levelFromGrade(profile.grade)) as Level;
    setLevel(lvl);
    setGrade(profile.grade && gradesByLevel[lvl].includes(profile.grade) ? profile.grade : gradesByLevel[lvl][0]);
  }, [profile]);

  const grades = useMemo(() => gradesByLevel[level], [level]);

  useEffect(() => {
    if (!grades.includes(grade)) setGrade(grades[0]);
  }, [grades, grade]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    if (!grade) { toast.error("اختر صفّك الدراسي الأول."); return; }

    const next: ChatMsg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const { reply } = await callTutor({
        data: { stage: level, grade, messages: next.slice(-12) },
      });
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حصل خطأ، حاول تاني.");
      setMessages((m) => m.slice(0, -1));
      setInput(content);
    } finally {
      setBusy(false);
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
            <div>
              <h1 className="text-xl font-extrabold sm:text-2xl">المساعد الذكي</h1>
              <p className="text-xs text-muted-foreground">نموذج مخصّص لكل مرحلة وكل صف دراسي — بيشرحلك على قد منهجك بالظبط.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><GraduationCap className="h-3.5 w-3.5" /> المرحلة</label>
              <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">الصف الدراسي</label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger><SelectValue placeholder="اختر الصف" /></SelectTrigger>
                <SelectContent>
                  {grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* المحادثة */}
        <div ref={scrollRef} className="mt-4 flex-1 space-y-4 overflow-y-auto rounded-2xl border border-border bg-card/40 p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Bot className="h-7 w-7" /></span>
              <p className="max-w-sm text-sm text-muted-foreground">اسألني أي حاجة في منهجك واختار من الاقتراحات دي عشان نبدأ:</p>
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
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="mt-4 flex items-end gap-2"
        >
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
      </main>
    </div>
  );
}
