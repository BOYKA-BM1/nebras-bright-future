import { useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, AlertOctagon, Send, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { useRoles } from "@/hooks/use-roles";
import { useRespondTicket } from "@/hooks/use-staff";
import { getStaffComplaints, ROLE_LABELS, type StaffComplaint } from "@/lib/complaints.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/staff/complaints")({
  component: ComplaintsPage,
});

function ComplaintsPage() {
  const { isSecretary, isAdmin, isLoading } = useRoles();
  const call = useServerFn(getStaffComplaints);
  const { data: items = [], isLoading: loading, refetch } = useQuery({
    queryKey: ["staff-complaints"],
    queryFn: () => call(),
    enabled: isSecretary || isAdmin,
    staleTime: 10_000,
  });
  const [filter, setFilter] = useState<"open" | "all">("open");

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!isSecretary && !isAdmin) return <Navigate to="/staff" />;

  const shown = filter === "open" ? items.filter((c) => c.status !== "answered") : items;

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <AlertOctagon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">الشكاوى</h1>
          <p className="text-sm text-muted-foreground">شكاوى المدرّسين والمونتاج والغرفة النفسية وخدمة العملاء ({items.length}).</p>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        {(["open", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === f ? "bg-gradient-gold text-primary-foreground shadow-gold" : "border border-border hover:bg-accent"}`}
          >
            {f === "open" ? "غير مُجاب" : "الكل"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : shown.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">
          لا يوجد شكاوى {filter === "open" ? "غير مُجاب عليها" : ""} حاليًا 📭
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {shown.map((c) => <ComplaintCard key={c.id} item={c} onDone={() => refetch()} />)}
        </div>
      )}
    </div>
  );
}

function ComplaintCard({ item, onDone }: { item: StaffComplaint; onDone: () => void }) {
  const respond = useRespondTicket();
  const [reply, setReply] = useState(item.response ?? "");
  const answered = item.status === "answered";

  const handleReply = () => {
    if (!reply.trim()) { toast.error("اكتب الرد أولًا."); return; }
    respond.mutate(
      { id: item.id, response: reply.trim() },
      { onSuccess: () => { toast.success("تم إرسال الرد ✅"); onDone(); }, onError: () => toast.error("تعذّر إرسال الرد.") },
    );
  };

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold">
            {item.senderName ?? "عضو بالطاقم"}
            <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              {ROLE_LABELS[item.senderRole] ?? "طاقم"}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("ar-EG")}</p>
        </div>
        {answered ? (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> تم الرد</span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-orange-500/15 px-3 py-1 text-xs font-bold text-orange-400"><Clock className="h-3.5 w-3.5" /> بانتظار الرد</span>
        )}
      </div>

      <h3 className="mt-3 font-extrabold">{item.subject}</h3>
      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.message}</p>

      <div className="mt-4 space-y-2">
        <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="اكتب ردّك..." rows={3} />
        <Button onClick={handleReply} disabled={respond.isPending} className="gap-2 bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
          {respond.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {answered ? "تحديث الرد" : "إرسال الرد"}
        </Button>
      </div>
    </article>
  );
}
