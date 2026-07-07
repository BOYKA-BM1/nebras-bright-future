import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type Conversation = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type StoredMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

// الجداول لسه مش موجودة في الأنواع المولّدة، فبنستخدم any مؤقتًا
const convTable = () => (supabase.from as any)("ai_conversations");
const msgTable = () => (supabase.from as any)("ai_messages");

/** قائمة محادثات المستخدم الحالي مرتّبة بالأحدث */
export function useConversations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ai-conversations", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Conversation[]> => {
      const { data, error } = await convTable()
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Conversation[];
    },
  });
}

/** رسائل محادثة معيّنة مرتّبة زمنيًا */
export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["ai-messages", conversationId],
    enabled: !!conversationId,
    queryFn: async (): Promise<StoredMessage[]> => {
      const { data, error } = await msgTable()
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StoredMessage[];
    },
  });
}

export function useConversationActions() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const invalidateList = () => qc.invalidateQueries({ queryKey: ["ai-conversations", user?.id] });

  /** إنشاء محادثة جديدة وإرجاع الـ id */
  const createConversation = async (title = "محادثة جديدة"): Promise<string> => {
    const { data, error } = await convTable()
      .insert({ user_id: user!.id, title })
      .select("id")
      .single();
    if (error) throw error;
    invalidateList();
    return (data as { id: string }).id;
  };

  /** حفظ رسالة وتحديث وقت المحادثة */
  const saveMessage = async (
    conversationId: string,
    role: "user" | "assistant",
    content: string,
  ) => {
    const { error } = await msgTable().insert({ conversation_id: conversationId, role, content });
    if (error) throw error;
    await convTable().update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    qc.invalidateQueries({ queryKey: ["ai-messages", conversationId] });
    invalidateList();
  };

  const renameConversation = async (conversationId: string, title: string) => {
    const clean = title.trim().slice(0, 60) || "محادثة جديدة";
    const { error } = await convTable().update({ title: clean }).eq("id", conversationId);
    if (error) throw error;
    invalidateList();
  };

  const deleteMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await convTable().delete().eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: invalidateList,
  });

  return { createConversation, saveMessage, renameConversation, deleteConversation: deleteMutation };
}
