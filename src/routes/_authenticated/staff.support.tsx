import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, MessageCircle, Send, CheckCircle2, Clock, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { useSupportTickets, useRespondTicket, type Ticket } from "@/hooks/use-staff";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/staff/support")({
  component: SupportPage,
});

function SupportPage() {
  const { data: tickets = [], isLoading } = useSupportTickets();
  const [filter, setFilter] = useState<"all" | "open">("open");

  const shown = filter === "open" ? tickets.filter((t) => t.status !== "answered") : tickets;

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">استفسارات العملاء</h1>
          <p className="text-sm text-muted-foreground">ردّ على استفسارات الطلاب ({tickets.length}).</p>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <button onClick={() => setFilter("open")} className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === "open" ? "bg-gradient-gold text-primary-foreground shadow-gold" : "border border-border hover:bg-accent"}`}>غير مُجاب</button>
        <button onClick={() => setFilter("all")} className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === "all" ? "bg-gradient-gold text-primary-foreground shadow-gold" : "border border-border hover:bg-accent"}`}>الكل</button>
      </div>

      {isLoading ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : shown.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">
          لا يوجد استفسارات {filter === "open" ? "غير مُجاب عليها" : ""} حاليًا 📭
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {shown.map((t) => <TicketCard key={t.id} ticket={t} />)}
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const respond = useRespondTicket();
  const [reply, setReply] = useState(ticket.response ?? "");
  const answered = ticket.status === "answered";

  const handleReply = () => {
    if (!reply.trim()) { toast.error("اكتب الرد أولًا."); return; }
    respond.mutate(
      { id: ticket.id, response: reply.trim() },
      { onSuccess: () => toast.success("تم إرسال الرد ✅"), onError: () => toast.error("تعذّر إرسال الرد.") },
    );
  };

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground"><UserIcon className="h-4 w-4" /></span>
          <div>
            <p className="font-bold">{ticket.studentName ?? "طالب"}</p>
            <p className="text-xs text-muted-foreground">{new Date(ticket.created_at).toLocaleString("ar-EG")}</p>
          </div>
        </div>
        {answered ? (
          <span className="flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-xs font-bold text-green-500"><CheckCircle2 className="h-3.5 w-3.5" /> تم الرد</span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-orange-500/15 px-3 py-1 text-xs font-bold text-orange-400"><Clock className="h-3.5 w-3.5" /> بانتظار الرد</span>
        )}
      </div>

      <h3 className="mt-3 font-extrabold">{ticket.subject}</h3>
      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{ticket.message}</p>

      <div className="mt-4 space-y-2">
        <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="اكتب ردّك على الطالب..." rows={3} />
        <Button onClick={handleReply} disabled={respond.isPending} className="gap-2 bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
          {respond.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {answered ? "تحديث الرد" : "إرسال الرد"}
        </Button>
      </div>
    </article>
  );
}
