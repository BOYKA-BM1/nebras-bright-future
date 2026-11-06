import { useState } from "react";
import { createFileRoute, Outlet, Link, useParams, useNavigate } from "@tanstack/react-router";
import { Plus, MessageSquare, Trash2, X, PanelRight } from "lucide-react";
import { useConversations, useConversationActions } from "@/hooks/use-ai-chat";

export const Route = createFileRoute("/_authenticated/ai")({
  component: AiLayout,
});

function AiLayout() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: conversations } = useConversations();
  const { deleteConversation } = useConversationActions();
  const params = useParams({ strict: false }) as { threadId?: string };
  const activeId = params.threadId ?? null;

  const handleDelete = (id: string) => {
    deleteConversation.mutate(id, {
      onSuccess: () => {
        if (activeId === id) navigate({ to: "/ai" });
      },
    });
  };

  return (
    <div className="relative flex h-[calc(100dvh-60px)] min-h-0 flex-col bg-background">
      {/* الشات بيملأ المساحة تحت البار الرئيسي فقط */}
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>

      {/* زر المحادثات العائم — وسط يمين الشاشة */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed end-3 top-1/2 z-40 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-lg backdrop-blur transition hover:scale-105 hover:border-primary/40 hover:text-primary sm:end-5"
        aria-label="المحادثات"
        title="المحادثات"
      >
        <PanelRight className="h-5 w-5" />
      </button>

      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40"
          aria-label="إغلاق"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 end-0 z-50 flex w-[min(19rem,88vw)] flex-col border-s border-border bg-card shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "ltr:translate-x-full rtl:-translate-x-full"
        }`}
        style={{ top: 60 }}
        aria-label="قائمة المحادثات"
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-3">
          <p className="text-sm font-extrabold">المحادثات</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-accent"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate({ to: "/ai" });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/15 px-3 py-2.5 text-sm font-bold text-primary hover:bg-primary/20"
          >
            <Plus className="h-4 w-4" /> محادثة جديدة
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {(conversations ?? []).length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">لا توجد محادثات بعد</p>
          ) : (
            (conversations ?? []).map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-1 rounded-xl px-2 py-2 ${
                  activeId === c.id ? "bg-primary/15 text-primary" : "hover:bg-accent"
                }`}
              >
                <Link
                  to="/ai/$threadId"
                  params={{ threadId: c.id }}
                  onClick={() => setOpen(false)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-1 text-sm font-semibold"
                >
                  <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
                  <span className="truncate">{c.title || "محادثة"}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  className="rounded-lg p-1.5 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  aria-label="حذف"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
