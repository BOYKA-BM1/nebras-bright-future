-- =========================================================================
-- 1) Avatars: لا تسمح لأي شخص غير مسجّل بتحميل الملفات
-- =========================================================================
DROP POLICY IF EXISTS "avatars_read" ON storage.objects;
CREATE POLICY "avatars_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

-- يبقى الإدراج/التعديل/الحذف لمالك المجلد فقط (موجود سابقًا)

-- =========================================================================
-- 2) ملفات الواجبات: الطالب المسجّل يقرأ ملف الأسئلة فقط (مش نموذج الإجابة)
-- =========================================================================
DROP POLICY IF EXISTS "submission files student read assignment questions" ON storage.objects;
CREATE POLICY "submission files student read assignment questions" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'submission-files'
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.file_url = name
        AND a.status = 'open'
        AND public.is_enrolled(auth.uid(), a.course_id)
    )
  );

-- المدرّس/أدمن يقرأ نموذج الإجابة لدوراته
DROP POLICY IF EXISTS "submission files teacher read answer keys" ON storage.objects;
CREATE POLICY "submission files teacher read answer keys" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'submission-files'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'admin_secondary')
      OR EXISTS (
        SELECT 1 FROM public.assignments a
        WHERE (a.answer_key_url = name OR a.file_url = name)
          AND public.owns_course(auth.uid(), a.course_id)
      )
    )
  );

-- =========================================================================
-- 3) تأكيد أن الـ CHECK على context يسمح بالقيمة المستخدمة
-- =========================================================================
DO $$
BEGIN
  ALTER TABLE public.files DROP CONSTRAINT IF EXISTS files_context_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.files
  DROP CONSTRAINT IF EXISTS files_context_check;

ALTER TABLE public.files
  ADD CONSTRAINT files_context_check
  CHECK (context IN ('assignment_submission'));

-- =========================================================================
-- 4) ضمان وجود bucket خاص (لا يغيّر العام إن وُجد)
-- =========================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'submission-files',
  'submission-files',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = COALESCE(storage.buckets.file_size_limit, 20971520);
