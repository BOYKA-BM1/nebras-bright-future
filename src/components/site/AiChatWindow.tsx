import { useRef, useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Send,
  Loader2,
  Bot,
  User as UserIcon,
  Square,
  Mic,
  Volume2,
  VolumeX,
  ImagePlus,
  X,
  Sparkles,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { askTutor } from "@/lib/ai-tutor.functions";
import { useSpeechRecognition, useSpeech } from "@/hooks/use-voice";
import { useMessages, useConversationActions } from "@/hooks/use-ai-chat";

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  imageDataUrl?: string | null;
};

const STARTERS = [
  "اشرحلي أصعب جزء في آخر محاضرة",
  "لخّصلي المحاضرة في نقاط",
  "اديني تمرين على الدرس وصحّحلي",
  "اسألني أسئلة مراجعة على المحاضرة",
];

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

async function fileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("الملف لازم يكون صورة.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("الصورة كبيرة (الحد 4 ميجا).");
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("تعذّر قراءة الصورة."));
    reader.readAsDataURL(file);
  });
}

export function AiChatWindow({ conversationId }: { conversationId: string | null }) {
  const callTutor = useServerFn(askTutor);
  const navigate = useNavigate();
  const { createConversation, saveMessage } = useConversationActions();
  const voice = useSpeechRecognition();
  const tts = useSpeech();
  const [autoSpeak, setAutoSpeak] = useState(false);

  const { data: loaded } = useMessages(conversationId);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<number | null>(null);
  const loadedFor = useRef<string | null | undefined>(undefined);
  const stickToBottom = useRef(true);
  const stoppedRef = useRef(false);
  const shownRef = useRef("");

  useEffect(() => {
    if (conversationId === null) {
      if (loadedFor.current !== null) {
        setMessages([]);
        loadedFor.current = null;
      }
      return;
    }
    if (loaded && loadedFor.current !== conversationId) {
      setMessages(
        loaded.map((m) => ({
          role: m.role,
          content: m.content,
          imageDataUrl: m.content.startsWith("![صورة]") ? null : null,
        })),
      );
      loadedFor.current = conversationId;
    }
  }, [conversationId, loaded]);

  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!stickToBottom.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, typing]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const typeOut = (full: string) =>
    new Promise<void>((resolve) => {
      setTyping(true);
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      const chars = Array.from(full);
      let i = 0;
      shownRef.current = "";
      const step = () => {
        if (stoppedRef.current) {
          setTyping(false);
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
          typingTimer.current = window.setTimeout(step, 14);
        } else {
          setTyping(false);
          resolve();
        }
      };
      step();
    });

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

  const toggleMic = () => {
    if (voice.listening) {
      voice.stop();
      return;
    }
    if (!voice.supported) {
      toast.error("متصفحك مش بيدعم الإدخال الصوتي.");
      return;
    }
    tts.cancel();
    tts.prime();
    voice.start((text) => void send(text));
  };

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setPendingImage(dataUrl);
    } catch (e: any) {
      toast.error(e?.message || "تعذّر إرفاق الصورة.");
    }
  };

  const send = async (text: string) => {
    const content = text.trim() || (pendingImage ? "اشرحلي المسألة اللي في الصورة دي بالتفصيل." : "");
    if ((!content && !pendingImage) || busy) return;

    const imageDataUrl = pendingImage;
    const history: ChatMsg[] = [...messages, { role: "user", content, imageDataUrl }];
    stickToBottom.current = true;
    stoppedRef.current = false;
    shownRef.current = "";
    setMessages(history);
    setInput("");
    setPendingImage(null);
    setBusy(true);
    setTyping(false);

    try {
      let id = conversationId;
      if (!id) {
        id = await createConversation(content.slice(0, 60) || "محادثة بصورة");
        loadedFor.current = id;
      }

      const storeText = imageDataUrl ? `${content}\n\n[مرفقة صورة للمسألة]` : content;
      await saveMessage(id, "user", storeText);

      const payload = history.slice(-12).map((m) => ({
        role: m.role,
        content: m.content,
        imageDataUrl: m.imageDataUrl ?? null,
      }));

      const { reply } = await callTutor({ data: { messages: payload } });
      if (stoppedRef.current) return;

      await typeOut(reply);
      await saveMessage(id, "assistant", shownRef.current || reply);

      if (autoSpeak && !stoppedRef.current) {
        tts.speak(shownRef.current || reply);
      }

      if (!conversationId && id) {
        navigate({ to: "/ai/$threadId", params: { threadId: id } });
      }
    } catch (e: any) {
      toast.error(e?.message || "حصل خطأ أثناء الرد.");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setBusy(false);
      setTyping(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-primary/[0.04] via-background to-background">
      {/* شريط علوي أنيق */}
      <div className="shrink-0 border-b border-border/60 bg-card/70 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-gold text-primary-foreground shadow-gold">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-extrabold sm:text-lg">Edu Mindly المساعد الذكي</h2>
            <p className="truncate text-xs text-muted-foreground">
              اسأل بالكتابة أو ارفع صورة مسألة — هشرحلك خطوة بخطوة
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAutoSpeak((v) => !v)}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
              autoSpeak ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-background text-muted-foreground"
            }`}
            title={autoSpeak ? "إيقاف القراءة الصوتية" : "تفعيل القراءة الصوتية"}
          >
            {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* الرسائل */}
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center px-2 py-10 text-center">
              <div className="relative mb-5">
                <div className="absolute inset-0 rounded-3xl bg-primary/20 blur-2xl" />
                <span className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-gold text-primary-foreground shadow-gold">
                  <Bot className="h-10 w-10" />
                </span>
              </div>
              <h3 className="text-xl font-extrabold">جاهز نذاكر مع بعض؟</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                اكتب سؤالك، أو ارفع صورة لمسألة/واجب، والمساعد هيقرأ الصورة ويشرحلك الحل بأسلوب مناسب لمرحلتك.
              </p>
              <div className="mt-6 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-2xl border border-border bg-card/90 px-4 py-3 text-start text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/15"
              >
                <ImagePlus className="h-4 w-4" />
                ارفع صورة مسألة
              </button>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    m.role === "user" ? "bg-secondary" : "bg-gradient-gold text-primary-foreground shadow-sm"
                  }`}
                >
                  {m.role === "user" ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </span>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                    m.role === "user"
                      ? "bg-gradient-gold text-primary-foreground"
                      : "border border-border/80 bg-card/95"
                  }`}
                >
                  {m.imageDataUrl && (
                    <img
                      src={m.imageDataUrl}
                      alt="صورة مرفقة"
                      className="mb-2 max-h-56 w-auto rounded-xl border border-black/10 object-contain"
                    />
                  )}
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  {typing && m.role === "assistant" && i === messages.length - 1 && (
                    <span className="ms-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-primary align-middle" />
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
                <Loader2 className="h-4 w-4 animate-spin" /> بيفكّر في سؤالك...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* الإدخال */}
      <div className="shrink-0 border-t border-border/70 bg-card/80 p-3 backdrop-blur-xl sm:p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="mx-auto max-w-3xl"
        >
          {pendingImage && (
            <div className="mb-2 flex items-start gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-2">
              <img src={pendingImage} alt="معاينة" className="h-20 w-20 rounded-xl object-cover" />
              <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                <p className="font-bold text-foreground">صورة جاهزة للإرسال</p>
                <p className="mt-0.5">اكتب تعليقًا أو ابعت مباشرة والمساعد هيقرأ المسألة.</p>
              </div>
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="إزالة الصورة"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2 rounded-2xl border border-border bg-background p-2 shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-primary disabled:opacity-50"
              title="إرفاق صورة"
            >
              <ImagePlus className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={toggleMic}
              disabled={busy}
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl disabled:opacity-50 ${
                voice.listening ? "bg-destructive/15 text-destructive" : "text-muted-foreground hover:bg-accent"
              }`}
              title="إدخال صوتي"
            >
              <Mic className="h-5 w-5" />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder={pendingImage ? "علّق على الصورة أو ابعت مباشرة..." : "اكتب سؤالك هنا..."}
              className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
              disabled={busy}
            />
            {busy ? (
              <button
                type="button"
                onClick={stop}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground"
                title="إيقاف"
              >
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && !pendingImage}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold disabled:opacity-40"
                title="إرسال"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <Paperclip className="h-3 w-3" />
            يدعم رفع صور المسائل (JPG / PNG / WEBP) حتى 4 ميجا
          </p>
        </form>
      </div>
    </div>
  );
}
