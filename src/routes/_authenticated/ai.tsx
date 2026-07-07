import { useState } from "react";
import { createFileRoute, Outlet, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, GraduationCap, Plus, MessageSquare, Trash2, Menu, X } from "lucide-react";
import { Navbar } from "@/components/site/Navbar";
import { useProfile } from "@/hooks/use-profile";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useConversations, useConversationActions } from "@/hooks/use-ai-chat";

export const Route = createFileRoute("/_authenticated/ai")({
  component: AiLayout,
});

function stageLabel(grade?: string | null): string {
  if (!grade) return "";
  if (grade.includes("الابتدائي")) return "المرحلة الابتدائية";
  if (grade.includes("الإعدادي")) return "المرحلة الإعدادية";
  if (grade.includes("الثانوي")) return "المرحلة الثانوية";
  return "";
}

function AiLayout() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: teacherRow, isLoading: teacherLoading } = useQuery({
    queryKey: ["my-teacher-grade", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("teachers")
        .select("grade, stage")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: conversations } = useConversations();
  const { deleteConversation } = useConversationActions();

  // المحادثة النشطة من الـ URL
  const params = useParams({ strict: false }) as { threadId?: string };
  const activeId = params.threadId ?? null;

  const grade = teacherRow?.grade?.trim() || profile?.grade?.trim() || "";
  const hasGrade = !!grade;
  const loading = profileLoading || teacherLoading;

  const handleDelete = (id: string) => {
    deleteConversation.mutate(id, {
      onSuccess: () => {
        if (activeId === id) navigate({ to: "/ai" });
      },
    });
  };

  return (
    <div className="flex h-screen flex-col bg-background pt-[60px]">
      <Navbar />
      <div className="flex min-h-0 flex-1">
        {/* الشريط الجانبي: المحادثات */}
        <aside
          className={`fixed inset-y-0 right-0 z-40 mt-[60px] w-72 shrink-0 overflow-hidden border-l border-border bg-card transition-all duration-300 md:static md:mt-0 ${
            sidebarOpen ? "translate-x-0 md:w-72" : "translate-x-full md:w-0 md:translate-x-0 md:border-l-0"
          }`}
        >
          <div className="flex h-full flex-col p-3">
            <Link
              to="/ai"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3 text-sm font-bold text-primary-foreground shadow-gold hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> محادثة جديدة
            </Link>

            <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
              {(conversations ?? []).length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">مفيش محادثات لسه</p>
              ) : (
                (conversations ?? []).map((c) => (
                  <div
                    key={c.id}
                    className={`group flex items-center gap-2 rounded-xl px-2 py-2 transition-colors ${
                      activeId === c.id ? "bg-accent" : "hover:bg-accent/60"
                    }`}
                  >
                    <Link
                      to="/ai/$threadId"
                      params={{ threadId: c.id }}
                      onClick={() => setSidebarOpen(false)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-sm"
                    >
                      <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{c.title}</span>
                    </Link>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive md:opacity-70 md:group-hover:opacity-100"
                      aria-label="حذف المحادثة"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* العمود الرئيسي */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* رأس */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent"
              aria-label="قائمة المحادثات"
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              <span className="hidden sm:inline">المحادثات</span>
            </button>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-gold text-primary-foreground shadow-gold">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-extrabold sm:text-lg">المساعد الذكي</h1>
              <p className="truncate text-xs text-muted-foreground">
                {hasGrade ? `${grade} — ${stageLabel(grade)}` : "بيجاوبك من محاضرات ومذكرات مدرّسينك بس"}
              </p>
            </div>
          </div>

          {/* المحتوى */}
          {!loading && !hasGrade ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <GraduationCap className="h-7 w-7" />
              </span>
              <h2 className="text-lg font-extrabold">اختر مرحلتك وصفّك الأول</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                المساعد الذكي بيفتح نسخة مخصّصة لمرحلتك وصفّك تلقائيًا. كمّل بياناتك واختر صفّك من صفحة حسابك عشان نبدأ.
              </p>
              <Link
                to="/onboarding"
                className="rounded-xl bg-gradient-gold px-6 py-3 text-sm font-bold text-primary-foreground shadow-gold"
              >
                أكمل بياناتي
              </Link>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
