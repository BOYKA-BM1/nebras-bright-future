import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";

// الجداول الجديدة لسه مش في الأنواع المولّدة — نستخدم any مؤقتًا
const t = (name: string) => (supabase.from as any)(name);

export type PsychMessage = {
  id: string;
  student_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type CallRequest = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  topic: string | null;
  preferred_time: string | null;
  status: "pending" | "done" | "rejected";
  note: string | null;
  created_at: string;
};

export type ClassMessage = {
  id: string;
  room: string;
  user_id: string;
  body: string;
  created_at: string;
};

/* ============ الغرفة النفسية ============ */

/** رسائل محادثة طالب معيّن (الطالب نفسه أو الدكتور/الإدارة) */
export function usePsychMessages(studentId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["psych-messages", studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<PsychMessage[]> => {
      const { data, error } = await t("psych_messages")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PsychMessage[];
    },
  });

  useEffect(() => {
    if (!studentId) return;
    const channel = supabase
      .channel(`psych-${studentId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "psych_messages", filter: `student_id=eq.${studentId}` },
        () => qc.invalidateQueries({ queryKey: ["psych-messages", studentId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId, qc]);

  return query;
}

export function useSendPsychMessage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ studentId, body }: { studentId: string; body: string }) => {
      const clean = body.trim().slice(0, 2000);
      if (!clean) throw new Error("اكتب رسالتك أولًا.");
      const { error } = await t("psych_messages").insert({
        student_id: studentId,
        sender_id: user!.id,
        body: clean,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["psych-messages", v.studentId] });
      qc.invalidateQueries({ queryKey: ["psych-threads"] });
    },
  });
}

/** قائمة المحادثات للدكتور النفسي / الإدارة */
export function usePsychThreads() {
  return useQuery({
    queryKey: ["psych-threads"],
    queryFn: async () => {
      const { data, error } = await t("psych_messages")
        .select("student_id, body, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = (data ?? []) as Pick<PsychMessage, "student_id" | "body" | "created_at">[];
      const seen = new Map<string, { student_id: string; last: string; at: string }>();
      for (const r of rows) {
        if (!seen.has(r.student_id)) {
          seen.set(r.student_id, { student_id: r.student_id, last: r.body, at: r.created_at });
        }
      }
      const threads = [...seen.values()];
      const ids = threads.map((x) => x.student_id);
      if (ids.length === 0) return [] as (typeof threads[number] & { name: string })[];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      const nameMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return threads.map((x) => ({ ...x, name: nameMap.get(x.student_id) || "طالب" }));
    },
  });
}

/* ============ طلبات المكالمة ============ */

export function useMyCallRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-call-requests", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<CallRequest[]> => {
      const { data, error } = await t("psych_call_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CallRequest[];
    },
  });
}

export function useAllCallRequests() {
  return useQuery({
    queryKey: ["all-call-requests"],
    queryFn: async (): Promise<CallRequest[]> => {
      const { data, error } = await t("psych_call_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CallRequest[];
    },
  });
}

export function useCreateCallRequest() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { full_name: string; phone: string; topic?: string; preferred_time?: string }) => {
      const { error } = await t("psych_call_requests").insert({
        user_id: user!.id,
        full_name: input.full_name.trim().slice(0, 100),
        phone: input.phone.trim().slice(0, 30),
        topic: input.topic?.trim().slice(0, 300) || null,
        preferred_time: input.preferred_time?.trim().slice(0, 100) || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-call-requests"] });
      qc.invalidateQueries({ queryKey: ["all-call-requests"] });
    },
  });
}

export function useUpdateCallRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      const { error } = await t("psych_call_requests")
        .update({ status, note: note ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-call-requests"] }),
  });
}

/* ============ غرف دردشة الصفوف ============ */

export function useMyRoom(): string | null {
  const { data: profile } = useProfile();
  const grade = (profile?.grade ?? "").trim();
  if (!profile) return null;
  return grade || "general";
}

export function useClassMessages(room: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["class-messages", room],
    enabled: !!room,
    queryFn: async () => {
      const { data, error } = await t("class_messages")
        .select("*")
        .eq("room", room)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      const rows = (data ?? []) as ClassMessage[];
      const ids = [...new Set(rows.map((r) => r.user_id))];
      let nameMap = new Map<string, string | null>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        nameMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      }
      return rows.map((r) => ({ ...r, name: nameMap.get(r.user_id) || "طالب" }));
    },
  });

  // بثّ فوري: نضيف/نحذف الرسالة في الكاش مباشرة (أسرع من إعادة الجلب)
  useEffect(() => {
    if (!room) return;
    const key = ["class-messages", room];
    const channel = supabase
      .channel(`class-${room}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "class_messages", filter: `room=eq.${room}` },
        async (payload) => {
          const row = payload.new as ClassMessage;
          let name = "طالب";
          const cached = (qc.getQueryData(key) as (ClassMessage & { name: string })[] | undefined) ?? [];
          const known = cached.find((m) => m.user_id === row.user_id);
          if (known) name = known.name;
          else {
            const { data: prof } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", row.user_id)
              .maybeSingle();
            name = prof?.full_name || "طالب";
          }
          qc.setQueryData(key, (old: (ClassMessage & { name: string })[] | undefined) => {
            const list = old ?? [];
            if (list.some((m) => m.id === row.id)) return list;
            return [...list.filter((m) => !m.id.startsWith("tmp-") || m.body !== row.body), { ...row, name }];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "class_messages" },
        (payload) => {
          const old = payload.old as { id?: string };
          if (!old?.id) return;
          qc.setQueryData(key, (list: (ClassMessage & { name: string })[] | undefined) =>
            (list ?? []).filter((m) => m.id !== old.id),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, qc]);

  return query;
}

export function useSendClassMessage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  return useMutation({
    mutationFn: async ({ room, body }: { room: string; body: string }) => {
      const clean = body.trim().replace(/\s{3,}/g, "  ").slice(0, 1000);
      if (!clean) throw new Error("اكتب رسالتك أولًا.");
      if (!isClean(clean)) throw new Error(PROFANITY_MESSAGE);
      const { error } = await t("class_messages").insert({ room, user_id: user!.id, body: clean });
      if (error) throw error;
      return clean;
    },
    // إظهار الرسالة فورًا قبل ردّ الخادم (إرسال سريع)
    onMutate: async ({ room, body }) => {
      const clean = body.trim().slice(0, 1000);
      if (!clean || !isClean(clean) || !user) return;
      const key = ["class-messages", room];
      qc.setQueryData(key, (old: (ClassMessage & { name: string })[] | undefined) => [
        ...(old ?? []),
        {
          id: `tmp-${Date.now()}`,
          room,
          user_id: user.id,
          body: clean,
          created_at: new Date().toISOString(),
          name: profile?.full_name || "أنا",
        },
      ]);
    },
    onError: (_e, v) => qc.invalidateQueries({ queryKey: ["class-messages", v.room] }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["class-messages", v.room] }),
  });
}


export function useDeleteClassMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await t("class_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["class-messages"] }),
  });
}
