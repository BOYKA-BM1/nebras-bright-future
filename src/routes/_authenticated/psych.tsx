import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { HeartHandshake, Loader2, Send, Phone, ArrowLeft, CheckCircle2, XCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { useProfile } from "@/hooks/use-profile";
import {
  usePsychMessages,
  useSendPsychMessage,
  usePsychThreads,
  useMyCallRequests,
  useAllCallRequests,
  useCreateCallRequest,
  useUpdateCallRequest,
} from "@/hooks/use-community";

export const Route = createFileRoute("/_authenticated/psych")({
  head: () => ({
    meta: [
      { title: "الغرفة النفسية — نبراس" },
      { name: "description", content: "غرفة دعم نفسي سرّية للطلاب مع دكتور متخصص داخل منصة نبراس." },
      { property: "og:title", content: "الغرفة النفسية — نبراس" },
      { property: "og:description", content: "تكلّم بسرّية تامة مع دكتور نفسي، أو اطلب مكالمة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PsychRoom,
});

function PsychRoom() {
  const { isPsychologist, isAdmin, isLoading } = useRoles();
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return isPsychologist || isAdmin ? <DoctorPanel /> : <StudentRoom />;
}

/* ============ فقاعة رسالة بستايل واتساب ============ */

function ChatBubble({
  body,
  at,
  fromDoctor,
  showLabel,
}: {
  body: string;
  at: string;
  fromDoctor: boolean;
  showLabel?: boolean;
}) {
  return (
    // في الاتجاه من اليمين لليسار: flex-start = يمين (الدكتورة) و flex-end = شمال (الطالب)
    <div className={`flex ${fromDoctor ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[80%] px-4 py-2 text-sm leading-relaxed shadow-sm ${
          fromDoctor
            ? "rounded-2xl rounded-tr-md border border-emerald-500/25 bg-emerald-500/12 text-foreground"
            : "rounded-2xl rounded-tl-md bg-primary text-primary-foreground"
        }`}
      >
        {showLabel && fromDoctor && (
          <p className="mb-1 text-xs font-bold text-emerald-500">الدكتورة النفسية</p>
        )}
        <p className="whitespace-pre-wrap">{body}</p>
        <p className={`mt-1 text-[10px] ${fromDoctor ? "text-muted-foreground" : "opacity-70"}`} dir="ltr">
          {new Date(at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

/* ================= الطالب ================= */


function StudentRoom() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: messages = [], isLoading } = usePsychMessages(user?.id ?? null);
  const send = useSendPsychMessage();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const submit = () => {
    if (!text.trim() || !user) return;
    const body = text;
    setText("");
    send.mutate(
      { studentId: user.id, body },
      { onError: () => toast.error("تعذّر إرسال الرسالة، حاول تاني.") },
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link to="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> رجوع للوحة
        </Link>

        <header className="rounded-2xl border border-primary/30 bg-primary/10 p-5">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            <HeartHandshake className="h-6 w-6 text-primary" /> الغرفة النفسية
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            مكان آمن وسرّي — كلامك بيوصل للدكتور النفسي بس. محدّش من الطلاب يشوف محادثتك.
          </p>
        </header>

        <section className="mt-6 flex h-[60vh] flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                ابدأ الكلام… احكي اللي جواك وإحنا معاك.
              </p>
            ) : (
              messages.map((m) => (
                <ChatBubble
                  key={m.id}
                  body={m.body}
                  at={m.created_at}
                  fromDoctor={m.sender_id !== user?.id}
                  showLabel
                />
              ))

            )}
            <div ref={endRef} />
          </div>
          <div className="flex items-end gap-2 border-t border-border p-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
              }}
              rows={1}
              maxLength={2000}
              placeholder="اكتب رسالتك بسرّية…"
              className="max-h-32 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={submit}
              disabled={send.isPending || !text.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold disabled:opacity-50"
            >
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </section>

        <CallRequestForm defaultName={profile?.full_name ?? ""} defaultPhone={profile?.phone ?? ""} />
      </div>
    </div>
  );
}

function CallRequestForm({ defaultName, defaultPhone }: { defaultName: string; defaultPhone: string }) {
  const create = useCreateCallRequest();
  const { data: mine = [] } = useMyCallRequests();
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [topic, setTopic] = useState("");
  const [when, setWhen] = useState("");

  const submit = () => {
    if (!name.trim() || !phone.trim()) { toast.error("اكتب اسمك ورقم تليفونك."); return; }
    create.mutate(
      { full_name: name, phone, topic, preferred_time: when },
      {
        onSuccess: () => { toast.success("تم إرسال طلب المكالمة للدكتور."); setTopic(""); setWhen(""); },
        onError: () => toast.error("تعذّر إرسال الطلب."),
      },
    );
  };

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <Phone className="h-5 w-5 text-primary" /> اطلب مكالمة مع الدكتور
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="اسمك" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} placeholder="رقم التليفون" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        <input value={when} onChange={(e) => setWhen(e.target.value)} maxLength={100} placeholder="الوقت المناسب (اختياري)" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={300} placeholder="الموضوع باختصار (اختياري)" className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
      </div>
      <button onClick={submit} disabled={create.isPending} className="mt-4 rounded-xl bg-gradient-gold px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-gold disabled:opacity-70">
        {create.isPending ? "جاري الإرسال…" : "إرسال الطلب"}
      </button>

      {mine.length > 0 && (
        <ul className="mt-5 space-y-2 text-sm">
          {mine.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
              <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar-EG")}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${r.status === "done" ? "bg-emerald-500/15 text-emerald-400" : r.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
                {r.status === "done" ? "تم التواصل" : r.status === "rejected" ? "مرفوض" : "قيد الانتظار"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ================= الدكتور النفسي / الإدارة ================= */

function DoctorPanel() {
  const { user } = useAuth();
  const { data: threads = [], isLoading } = usePsychThreads();
  const { data: calls = [] } = useAllCallRequests();
  const updateCall = useUpdateCallRequest();
  const [active, setActive] = useState<string | null>(null);
  const { data: messages = [] } = usePsychMessages(active);
  const send = useSendPsychMessage();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const submit = () => {
    if (!text.trim() || !active) return;
    const body = text;
    setText("");
    send.mutate({ studentId: active, body }, { onError: () => toast.error("تعذّر الإرسال.") });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <HeartHandshake className="h-6 w-6 text-primary" /> لوحة الغرفة النفسية
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">محادثات الطلاب السرّية وطلبات المكالمات.</p>

        <div className="mt-6 grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-2xl border border-border bg-card p-3">
            <p className="flex items-center gap-2 px-2 py-1 text-sm font-bold"><Users className="h-4 w-4 text-primary" /> المحادثات</p>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : threads.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">مفيش محادثات لسه.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {threads.map((th) => (
                  <li key={th.student_id}>
                    <button
                      onClick={() => setActive(th.student_id)}
                      className={`w-full rounded-xl px-3 py-2 text-right text-sm transition-colors ${active === th.student_id ? "bg-gradient-gold text-primary-foreground" : "hover:bg-accent"}`}
                    >
                      <span className="block font-bold">{th.name}</span>
                      <span className="block truncate text-xs opacity-70">{th.last}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section className="flex h-[60vh] flex-col overflow-hidden rounded-2xl border border-border bg-card">
            {!active ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">اختر محادثة من الجانب.</div>
            ) : (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.map((m) => (
                    <ChatBubble
                      key={m.id}
                      body={m.body}
                      at={m.created_at}
                      fromDoctor={m.sender_id !== active}
                    />
                  ))}

                  <div ref={endRef} />
                </div>
                <div className="flex items-end gap-2 border-t border-border p-3">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                    rows={1}
                    maxLength={2000}
                    placeholder="ردّك للطالب…"
                    className="max-h-32 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <button onClick={submit} disabled={send.isPending || !text.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold disabled:opacity-50">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </section>
        </div>

        <h2 className="mt-10 text-xl font-extrabold">طلبات المكالمات</h2>
        {calls.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">مفيش طلبات.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {calls.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                <div>
                  <p className="font-bold">{r.full_name} — <span dir="ltr">{r.phone}</span></p>
                  <p className="text-xs text-muted-foreground">
                    {r.topic || "بدون موضوع"} · {r.preferred_time || "أي وقت"} · {new Date(r.created_at).toLocaleString("ar-EG")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${r.status === "done" ? "bg-emerald-500/15 text-emerald-400" : r.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
                    {r.status === "done" ? "تم" : r.status === "rejected" ? "مرفوض" : "قيد الانتظار"}
                  </span>
                  <button onClick={() => updateCall.mutate({ id: r.id, status: "done" })} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold hover:bg-accent">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> تم
                  </button>
                  <button onClick={() => updateCall.mutate({ id: r.id, status: "rejected" })} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10">
                    <XCircle className="h-3.5 w-3.5" /> رفض
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
