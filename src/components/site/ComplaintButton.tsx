import { useState } from "react";
import { MessageSquareWarning, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useCreateTicket } from "@/hooks/use-staff";
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

/** زر إرسال شكوى للسكرتارية — متاح لحسابات الطاقم */
export function ComplaintButton() {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const create = useCreateTicket();

  const submit = () => {
    if (!subject.trim() || !message.trim()) { toast.error("اكتب الموضوع وتفاصيل الشكوى."); return; }
    create.mutate(
      { subject: subject.trim(), message: message.trim() },
      {
        onSuccess: () => {
          toast.success("تم إرسال الشكوى للسكرتارية ✅");
          setSubject(""); setMessage(""); setOpen(false);
        },
        onError: () => toast.error("تعذّر إرسال الشكوى."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold hover:bg-accent">
          <MessageSquareWarning className="h-4 w-4" />
          <span className="hidden sm:inline">شكوى</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>إرسال شكوى للسكرتارية</DialogTitle>
          <DialogDescription>اكتب شكوتك وهيتم الرد عليك من السكرتارية.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="موضوع الشكوى" />
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="تفاصيل الشكوى..." rows={4} />
          <Button onClick={submit} disabled={create.isPending} className="w-full gap-2 bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} إرسال
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
