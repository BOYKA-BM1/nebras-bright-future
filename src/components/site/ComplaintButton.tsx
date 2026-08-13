import { useState } from "react";
import { MessageSquareWarning, Loader2, Send, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { useCreateTicket, useMyTickets } from "@/hooks/use-staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** زر إرسال شكوى للسكرتارية + متابعة كل الشكاوى والردود */
export function ComplaintButton() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"new" | "list">("new");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const create = useCreateTicket();
  const { data: tickets = [], isLoading } = useMyTickets();
  const answered = tickets.filter((t) => t.status === "answered").length;

  const submit = () => {
    if (!subject.trim() || !message.trim()) { toast.error("اكتب الموضوع وتفاصيل الشكوى."); return; }
    create.mutate(
      { subject: subject.trim(), message: message.trim() },
      {
        onSuccess: () => {
          toast.success("تم إرسال الشكوى للسكرتارية ✅");
          setSubject(""); setMessage(""); setTab("list");
        },
        onError: () => toast.error("تعذّر إرسال الشكوى."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="relative flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent">
          <MessageSquareWarning className="h-4 w-4" />
          <span className="hidden sm:inline">شكوى</span>
          {tickets.length > 0 && (
            <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-extrabold text-primary-foreground">
              {tickets.length}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>الشكاوى</DialogTitle>
          <DialogDescription>
            ابعت شكوتك للسكرتارية وتابع كل الشكاوى والردود ({tickets.length} شكوى · {answered} تم الرد عليها).
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          {(["new", "list"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${
                tab === t ? "bg-gradient-gold text-primary-foreground shadow-gold" : "border border-border hover:bg-accent"
              }`}
            >
              {t === "new" ? "شكوى جديدة" : `شكاويّ (${tickets.length})`}
            </button>
          ))}
        </div>

        {tab === "new" ? (
          <div className="space-y-3">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="موضوع الشكوى" />
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="تفاصيل الشكوى..." rows={4} />
            <Button onClick={submit} disabled={create.isPending} className="w-full gap-2 bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} إرسال
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : tickets.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
            لا يوجد شكاوى مُرسلة حتى الآن 📭
          </p>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => {
              const done = t.status === "answered";
              return (
                <article key={t.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h4 className="font-extrabold">{t.subject}</h4>
                    {done ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> تم الرد
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 rounded-full bg-orange-500/15 px-2.5 py-0.5 text-xs font-bold text-orange-400">
                        <Clock className="h-3.5 w-3.5" /> بانتظار الرد
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(t.created_at).toLocaleString("ar-EG")}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{t.message}</p>
                  {t.response && (
                    <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <p className="text-xs font-bold text-emerald-400">رد السكرتارية</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{t.response}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
