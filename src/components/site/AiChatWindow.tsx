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
  ImagePlus,
  X,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { askTutor, generateTutorImage } from "@/lib/ai-tutor.functions";
import { useSpeechRecognition } from "@/hooks/use-voice";
import { useMessages, useConversationActions } from "@/hooks/use-ai-chat";

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  imageDataUrl?: string | null;
  generatedImageUrl?: string | null;
};

const STARTERS = [
  "اشرحلي أصعب جزء في آخر محاضرة",
  "لخّصلي المحاضرة في نقاط",
  "اديني تمرين على الدرس وصحّحلي",
  "ارسملي مخطط توضيحي للدرس",
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

function wantsImageGen(text: string) {
  const t = text.trim();
  return /^(ارسم|ولّد|ولد|ولدّ|generate|draw|صورة|صمم|صمّم)/i.test(t) || /توليد\s*صورة|ارسملي|ارسم لي/i.test(t);
}

export function AiChatWindow({ conversationId }: { conversationId: string | null }) {
  const callTutor = useServerFn(askTutor);
  const callImage = useServerFn(generateTutorImage);
  const navigate = useNavigate();
  const { createConversation, saveMessage } = useConversationActions();
  const voice = useSpeechRecognition();

  const { data: loaded } = useMessages(conversationId);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
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
      setMessages(loaded.map((m) => ({ role: m.role, content: m.content })));
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
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
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
        i = Math.min(chars.length, i + 3);
        const shown = chars.slice(0, i).join("");
        shownRef.current = shown;
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: shown };
          return copy;
        });
        if (i < chars.length) typingTimer.current = window.setTimeout(step, 12);
        else {
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
    voice.start((text) => void send(text));
  };

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    try {
      setPendingImage(await fileToDataUrl(file));
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

      const storeText = imageDataUrl ? `${content}\n\n[مرفقة صورة]` : content;
      await saveMessage(id, "user", storeText);

      // توليد صورة
      if (!imageDataUrl && wantsImageGen(content)) {
        const result = await callImage({ data: { prompt: content } });
        if (stoppedRef.current) return;
        if (result.kind === "image") {
          const msg: ChatMsg = {
            role: "assistant",
            content: "اتفضّل الصورة حسب طلبك 👇",
            generatedImageUrl: result.content,
          };
          setMessages((m) => [...m, msg]);
          await saveMessage(id, "assistant", `${msg.content}\n${result.content}`);
        } else {
          await typeOut(result.content);
          await saveMessage(id, "assistant", shownRef.current || result.content);
        }
      } else {
        const payload = history.slice(-12).map((m) => ({
          role: m.role,
          content: m.content,
          imageDataUrl: m.imageDataUrl ?? null,
        }));
        const { reply } = await callTutor({ data: { messages: payload } });
        if (stoppedRef.current) return;
        await typeOut(reply);
        await saveMessage(id, "assistant", shownRef.current || reply);
      }

      if (!conversationId && id) {
        navigate({ to: "/ai/$threadId", params: { threadId: id } });
      }
    } catch (e: any) {
      toast.error(e?.message || "حصل خطأ أثناء الرد.");
      setMessages((m) => (m[m.length - 1]?.role === "user" ? m.slice(0, -1) : m));
    } finally {
      setBusy(false);
      setTyping(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* الرسائل — بدون هيدر إضافي */}
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-3xl flex-col px-3 py-6 sm:px-4">
          {messages.length === 0 ? (
            <div className="my-auto flex flex-col items-center px-2 pb-16 pt-8 text-center">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Sparkles className="h-7 w-7" />
              </span>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">كيف أقدر أساعدك؟</h1>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                اسأل عن درسك، ارفع صورة مسألة، أو اطلب رسمة توضيحية.
              </p>
              <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-2xl border border-border bg-card px-4 py-3 text-start text-sm font-medium transition hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 pb-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && (
                    <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <Bot className="h-4 w-4" />
                    </span>
                  )}
                  <div
                    className={`max-w-[min(100%,36rem)] rounded-3xl px-4 py-3 text-[15px] leading-7 ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/60 text-foreground"
                    }`}
                  >
                    {m.imageDataUrl && (
                      <img
                        src={m.imageDataUrl}
                        alt=""
                        className="mb-2 max-h-64 w-auto rounded-2xl object-contain"
                      />
                    )}
                    {m.generatedImageUrl && (
                      <img
                        src={m.generatedImageUrl}
                        alt="صورة مولّدة"
                        className="mb-2 max-h-80 w-auto rounded-2xl object-contain"
                      />
                    )}
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    {typing && m.role === "assistant" && i === messages.length - 1 && (
                      <span className="ms-0.5 inline-block h-4 w-[2px] animate-pulse bg-primary align-middle" />

                    )}
                  </div>
                  {m.role === "user" && (
                    <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <UserIcon className="h-4 w-4" />
                    </span>
                  )}
                </div>
              ))}
              {busy && !typing && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري التفكير…
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* شريط الإدخال — ستايل ChatGPT/Grok */}
      <div className="shrink-0 px-3 pb-4 pt-1 sm:px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="mx-auto max-w-3xl"
        >
          <div className="rounded-[28px] border border-border bg-card shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
            {/* معاينة الصورة المرفقة — شريحة مضغوطة زي Grok */}
            {pendingImage && (
              <div className="flex items-center gap-2 border-b border-border/60 px-3 pt-3">
                <div className="relative">
                  <img src={pendingImage} alt="" className="h-14 w-14 rounded-xl object-cover ring-1 ring-border" />
                  <button
                    type="button"
                    onClick={() => setPendingImage(null)}
                    className="absolute -end-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background shadow"
                    aria-label="إزالة"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">صورة مرفقة</span>
              </div>
            )}

            <div className="flex items-end gap-1 px-2 py-2">
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
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                title="إرفاق صورة"
              >
                <ImagePlus className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={toggleMic}
                disabled={busy}
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-50 ${
                  voice.listening ? "bg-destructive/15 text-destructive" : "text-muted-foreground hover:bg-accent"
                }`}
                title="صوت"
              >
                <Mic className="h-5 w-5" />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                placeholder="اسأل أي شيء..."
                className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] outline-none placeholder:text-muted-foreground"
                disabled={busy}
              />
              {busy ? (
                <button
                  type="button"
                  onClick={stop}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary"
                  title="إيقاف"
                >
                  <Square className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() && !pendingImage}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-30"
                  title="إرسال"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            يمكن أن يخطئ المساعد — راجع الإجابات المهمة
          </p>
        </form>
      </div>
    </div>
  );
}
