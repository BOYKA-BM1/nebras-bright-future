import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MessagesSquare, Loader2, Send, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { useProfile } from "@/hooks/use-profile";
import { useMyRoom, useClassMessages, useSendClassMessage, useDeleteClassMessage } from "@/hooks/use-community";

export const Route = createFileRoute("/_authenticated/community")({
  head: () => ({
    meta: [
      { title: "غرفة صفّي — نبراس" },
      { name: "description", content: "دردشة جماعية بين طلاب نفس الصف الدراسي داخل منصة نبراس." },
      { property: "og:title", content: "غرفة صفّي — نبراس" },
      { property: "og:description", content: "اتكلم مع زمايلك في نفس الصف وذاكروا مع بعض." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunityRoom,
});

function CommunityRoom() {
  const { user } = useAuth();
  const { isAdmin } = useRoles();
  const { data: profile } = useProfile();
  const room = useMyRoom();
  const { data: messages = [], isLoading } = useClassMessages(room);
  const send = useSendClassMessage();
  const del = useDeleteClassMessage();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const submit = () => {
    if (!text.trim() || !room) return;
    const body = text;
    setText("");
    send.mutate(
      { room, body },
      {
        onError: (e: unknown) =>
          toast.error(e instanceof Error ? e.message : "تعذّر إرسال الرسالة."),
      },
    );
  };

  const roomLabel = (profile?.grade ?? "").trim() || "الغرفة العامة";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link to="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> رجوع للوحة
        </Link>

        <header className="rounded-2xl border border-border bg-card p-5">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            <MessagesSquare className="h-6 w-6 text-primary" /> غرفة {roomLabel}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            الغرفة دي لطلاب صفّك بس — الرسايل بتظهر لكل طلاب الصف فورًا. ممنوع أي ألفاظ خارجة أو سباب،
            والرسالة اللي فيها كلام غير لائق مش هتتبعت أصلًا.
          </p>
        </header>

        <section className="mt-6 flex h-[65vh] flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">مفيش رسايل لسه — ابدأ الكلام أنت.</p>
            ) : (
              messages.map((m) => {
                const mine = m.user_id === user?.id;
                return (
                  <div key={m.id} className={`group flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                    {(mine || isAdmin) && !m.id.startsWith("tmp-") && (
                      <button
                        onClick={() => del.mutate(m.id)}
                        title="حذف الرسالة"
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    )}
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                      <p className={`mb-1 text-xs font-extrabold ${mine ? "text-primary-foreground/80" : "text-primary"}`}>
                        {mine ? "أنا" : m.name}
                      </p>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </div>

                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>
          <div className="flex items-end gap-2 border-t border-border p-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={1}
              maxLength={1000}
              placeholder="اكتب رسالتك لزمايلك…"
              className="max-h-32 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button onClick={submit} disabled={send.isPending || !text.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold disabled:opacity-50">
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
