import { useRef, useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, Bot, User as UserIcon, Square, Mic, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { askTutor } from "@/lib/ai-tutor.functions";
import { useSpeechRecognition, useSpeech } from "@/hooks/use-voice";
import {
  useMessages,
  useConversationActions,
  type StoredMessage,
} from "@/hooks/use-ai-chat";

type ChatMsg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "اشرحلي أصعب جزء في آخر محاضرة",
  "لخّصلي المحاضرة في نقاط",
  "اديني تمرين على الدرس وصحّحلي",
  "اسألني أسئلة مراجعة على المحاضرة",
];

export function AiChatWindow({ conversationId }: { conversationId: string | null }) {
  const callTutor = useServerFn(askTutor);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { createConversation, saveMessage } = useConversationActions();
  const voice = useSpeechRecognition();
  const tts = useSpeech();
  const [autoSpeak, setAutoSpeak] = useState(false);

  const { data: loaded } = useMessages(conversationId);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<number | null>(null);
  const loadedFor = useRef<string | null | undefined>(undefined);
  // لو المستخدم عمل سكرول لفوق بنفسه، نوقّف المتابعة التلقائية لحد ما يرجع لتحت
  const stickToBottom = useRef(true);
  // إيقاف الرد + تتبّع النص اللي ظهر لحد لحظة الإيقاف
  const stoppedRef = useRef(false);
  const shownRef = useRef("");

  // مزامنة الرسائل عند تبديل المحادثة أو تحميلها من قاعدة البيانات
  useEffect(() => {
    if (conversationId === null) {
      if (loadedFor.current !== null) {
        setMessages([]);
        loadedFor.current = null;
      }
      return;
    }
    if (loaded && loadedFor.current !== conversationId) {
      setMessages(loaded.map((m) => ({ role: m.role, content: m.content })));
      loadedFor.current = conversationId;
    }
  }, [conversationId, loaded]);

  useEffect(() => () => { if (typingTimer.current) clearTimeout(typingTimer.current); }, []);

  // نتابع النزول فقط طالما المستخدم عايز يفضل تحت (stickToBottom)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy, typing]);

  // متابعة سكرول المستخدم: يوقف التتبع لو طلع لفوق، ويرجّعه لو نزل لآخر الشات
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };


  // إبقاء صندوق الكتابة نشطًا
  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy, conversationId]);

  // تأثير الكتابة الحيّة: يظهر الرد حرفًا حرفًا زي شات جي بي تي
  const typeReply = (reply: string) =>
    new Promise<void>((resolve) => {
      const chars = Array.from(reply);
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      let i = 0;
      const step = () => {
        if (stoppedRef.current) {
          resolve();
          return;
        }
        i = Math.min(chars.length, i + 2);
        const shown = chars.slice(0, i).join("");
        shownRef.current = shown;
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

  // إيقاف رد الذكاء الاصطناعي في أي وقت
  const stop = () => {
    stoppedRef.current = true;
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }
    tts.cancel();
    setTyping(false);
    setBusy(false);
  };

  // التسجيل الصوتي: يحوّل الكلام لنص ويبعته تلقائيًا
  const toggleMic = () => {
    if (voice.listening) {
      voice.stop();
      return;
    }
    if (!voice.supported) {
      toast.error("متصفحك مش بيدعم الإدخال الصوتي. جرّب Chrome على الكمبيوتر أو الموبايل.");
      return;
    }
    tts.cancel();
    voice.start((text) => send(text));
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;

    const history: ChatMsg[] = [...messages, { role: "user", content }];
    stickToBottom.current = true; // عند إرسال رسالة جديدة نرجع لآخر الشات
    stoppedRef.current = false;
    shownRef.current = "";
    setMessages(history);
    setInput("");
    setBusy(true);
    setTyping(false);

    try {
      // إنشاء المحادثة لو دي أول رسالة (وضع محادثة جديدة)
      let id = conversationId;
      let isNew = false;
      if (!id) {
        id = await createConversation(content.slice(0, 60));
        isNew = true;
        loadedFor.current = id; // نمنع إعادة المزامنة اللي تمسح الرسائل
      }

      await saveMessage(id, "user", content);

      const { reply } = await callTutor({ data: { messages: history.slice(-12) } });

      // لو المستخدم أوقف الرد وهو لسه بيفكّر، نتجاهل الرد بالكامل
      if (!stoppedRef.current) {
        setTyping(true);
        if (autoSpeak && reply) tts.speak(reply);
        await typeReply(reply);
        setTyping(false);
      }

      // النص النهائي المحفوظ: الكامل لو خلص، أو اللي ظهر لو اتوقف أثناء الكتابة
      const finalText = stoppedRef.current ? shownRef.current : reply;

      if (finalText) {
        await saveMessage(id, "assistant", finalText);
      }

      // نحدّث الكاش عشان صفحة المحادثة تفتح جاهزة من غير وميض
      const now = new Date().toISOString();
      const combined: ChatMsg[] = finalText
        ? [...history, { role: "assistant", content: finalText }]
        : history;
      const stored: StoredMessage[] = combined.map((m, idx) => ({
        id: `local-${idx}`,
        conversation_id: id!,
        role: m.role,
        content: m.content,
        created_at: now,
      }));
      qc.setQueryData(["ai-messages", id], stored);

      if (isNew) {
        navigate({ to: "/ai/$threadId", params: { threadId: id }, replace: true });
      }
    } catch (err) {
      if (!stoppedRef.current) {
        toast.error(err instanceof Error ? err.message : "حصل خطأ، حاول تاني.");
        setMessages((m) => m.slice(0, -1));
        setInput(content);
      }
    } finally {
      setBusy(false);
      setTyping(false);
    }
  };


  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* منطقة المحادثة القابلة للتمرير */}
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Bot className="h-7 w-7" />
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">
              اسألني أي حاجة في محاضراتك واختار من الاقتراحات دي عشان نبدأ:
            </p>
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
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  m.role === "user" ? "bg-secondary" : "bg-gradient-gold text-primary-foreground"
                }`}
              >
                {m.role === "user" ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </span>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user" ? "bg-gradient-gold text-primary-foreground" : "border border-border bg-card"
                }`}
              >
                {m.content}
                {typing && m.role === "assistant" && i === messages.length - 1 && (
                  <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-primary align-middle" />
                )}
              </div>
            </div>
          ))
        )}
        {busy && !typing && (
          <div className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-gold text-primary-foreground">
              <Bot className="h-4 w-4" />
            </span>
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> بيفكّر...
            </div>
          </div>
        )}
      </div>

      {/* صندوق الكتابة الثابت */}
      <div className="shrink-0 border-t border-border bg-background/95 p-4 backdrop-blur">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto flex max-w-3xl items-end gap-2"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="اكتب سؤالك هنا..."
            className="max-h-40 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary/50"
          />
          {busy ? (
            <Button
              type="button"
              onClick={stop}
              aria-label="إيقاف الرد"
              className="h-12 w-12 shrink-0 rounded-2xl bg-destructive text-destructive-foreground hover:opacity-90"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!input.trim()}
              className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90"
            >
              <Send className="h-5 w-5" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
