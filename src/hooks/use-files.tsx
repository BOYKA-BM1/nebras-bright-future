import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Database } from "@/integrations/supabase/types";

export type UploadedFile = Database["public"]["Tables"]["files"]["Row"];

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB — راجع ملاحظة الـmigration: الحد الفعلي بيتفرض من إعدادات الـbucket نفسه
const ALLOWED_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/**
 * رفع ملف مرتبط بسياق معيّن (حاليًا: تسليم واجب). التحقق من النوع/الحجم هنا
 * تحقّق تجربة استخدام بس — الحماية الفعلية على مستوى الـbucket نفسه
 * (file_size_limit / allowed_mime_types) وعلى مستوى RLS الخاص بمسار الملف.
 */
export function useUploadFile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, context, relatedId }: { file: File; context: "assignment_submission"; relatedId?: string }): Promise<UploadedFile> => {
      if (!user) throw new Error("auth required");
      if (file.size > MAX_SIZE_BYTES) throw new Error("حجم الملف أكبر من الحد المسموح (20 ميجا).");
      if (file.type && !ALLOWED_MIME.includes(file.type)) throw new Error("نوع الملف غير مدعوم.");

      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

      const { error: upErr } = await supabase.storage.from("submission-files").upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw upErr;

      const { data, error } = await supabase
        .from("files")
        .insert({ owner_id: user.id, storage_path: path, original_filename: file.name, mime_type: file.type || null, size_bytes: file.size, context, related_id: relatedId ?? null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-files"] }),
  });
}

export function useMyFiles(context?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-files", user?.id, context],
    enabled: !!user,
    queryFn: async (): Promise<UploadedFile[]> => {
      let q = supabase.from("files").select("*").order("created_at", { ascending: false });
      if (context) q = q.eq("context", context);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** رابط تنزيل مؤقّت — createSignedUrl بيتحقق من RLS فعليًا قبل ما يصدر أي رابط */
export function useFileDownloadUrl() {
  return useMutation({
    mutationFn: async (storagePath: string): Promise<string> => {
      const { data, error } = await supabase.storage.from("submission-files").createSignedUrl(storagePath, 60 * 10);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: UploadedFile) => {
      const { error: storageErr } = await supabase.storage.from("submission-files").remove([file.storage_path]);
      if (storageErr) throw storageErr;
      const { error } = await supabase.from("files").delete().eq("id", file.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-files"] }),
  });
}
