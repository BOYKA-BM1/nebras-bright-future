import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Database } from "@/integrations/supabase/types";

export type AppNotification = Database["public"]["Tables"]["notifications"]["Row"];

/**
 * آخر الإشعارات لصاحب الحساب الحالي — لجرس الإشعارات.
 * الـrealtime هنا بيُستخدم فقط كـ"إشارة تحديث" (invalidate) مش كمصدر بيانات
 * مباشر؛ القراءة الفعلية دايمًا بتعدّي على REST العادي اللي بيطبّق RLS بالكامل،
 * فحتى لو حصل أي تسريب على مستوى الـbroadcast نفسه، البيانات المعروضة فعليًا
 * هتفضل محكومة بصلاحيات المستخدم الحقيقية.
 */
export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as AppNotification;
          if (row?.title) toast.info(row.title, { description: row.body ?? undefined });
          qc.invalidateQueries({ queryKey: ["notifications", user.id] });
          qc.invalidateQueries({ queryKey: ["notification-history", user.id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications", user.id] });
          qc.invalidateQueries({ queryKey: ["notification-history", user.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  return useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
    // fallback حتى لو الـrealtime اتقطع لأي سبب (شبكة، تبويب في الخلفية...)
    refetchInterval: 60_000,
  });
}

/** السجل الكامل للإشعارات (صفحة "كل الإشعارات") — مع تحميل تدريجي */
export function useNotificationHistory(pageSize = 25) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notification-history", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(pageSize);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useNotificationActions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
    qc.invalidateQueries({ queryKey: ["notification-history", user?.id] });
  };

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { markRead, markAllRead };
}

/** بثّ إداري — للأدمن فقط، الدالة على الخادم هي اللي بتتحقق من الصلاحية فعليًا */
export function useSendAdminBroadcast() {
  return useMutation({
    mutationFn: async (input: { targetRole: string | null; title: string; body: string; link?: string | null }) => {
      const { data, error } = await supabase.rpc("send_admin_broadcast", {
        _target_role: input.targetRole,
        _title: input.title,
        _body: input.body,
        _link: input.link ?? null,
      });
      if (error) throw error;
      return data;
    },
  });
}

export type NotificationPreferences = Database["public"]["Tables"]["notification_preferences"]["Row"];

const DEFAULT_PREFS: Omit<NotificationPreferences, "user_id" | "updated_at"> = {
  course_enabled: true,
  exam_enabled: true,
  assignment_enabled: true,
  montage_enabled: true,
  parent_digest_enabled: true,
};

/** تفضيلات الإشعارات — صف مفقود يعني الإعداد الافتراضي (الكل مفعّل) */
export function useNotificationPreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notification-preferences", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<typeof DEFAULT_PREFS> => {
      const { data, error } = await supabase.from("notification_preferences").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data ?? DEFAULT_PREFS;
    },
  });
}

export function useUpdateNotificationPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<typeof DEFAULT_PREFS>) => {
      if (!user) throw new Error("auth required");
      const { error } = await supabase.from("notification_preferences").upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-preferences", user?.id] }),
  });
}
