import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type KnowledgeDoc = {
  id: string;
  title: string;
  stage: string | null;
  grade: string | null;
  subject: string | null;
  content: string;
  file_url: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeInput = {
  title: string;
  stage: string | null;
  grade: string | null;
  subject: string | null;
  content: string;
  file_url: string | null;
};

// جدول قاعدة المعرفة لسه مش موجود في الأنواع المولّدة، فبنستخدم any مؤقتًا
const table = () => (supabase.from as any)("knowledge_docs");

export function useKnowledgeDocs() {
  return useQuery({
    queryKey: ["knowledge-docs"],
    queryFn: async (): Promise<KnowledgeDoc[]> => {
      const { data, error } = await table()
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as KnowledgeDoc[];
    },
  });
}

export function useKnowledgeAdmin() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["knowledge-docs"] });

  const create = useMutation({
    mutationFn: async (input: KnowledgeInput) => {
      const { error } = await table().insert(input);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: KnowledgeInput & { id: string }) => {
      const { error } = await table().update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await table().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

/** رفع ملف كتاب/مذكرة PDF وإرجاع رابط موقّع طويل المدى */
export function useUploadKnowledgeFile() {
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const path = `knowledge/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("lesson-pdfs")
        .upload(path, file, { upsert: true, contentType: file.type || "application/pdf" });
      if (upErr) throw upErr;
      const { data, error: signErr } = await supabase.storage
        .from("lesson-pdfs")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr) throw signErr;
      return data.signedUrl;
    },
  });
}
