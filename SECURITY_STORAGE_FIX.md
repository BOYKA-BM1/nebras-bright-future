# إصلاح الرفع + ثغرة avatars

## نفّذ في Supabase → SQL Editor

```sql
-- 1) إغلاق تحميل avatars لغير المسجّلين
DROP POLICY IF EXISTS "avatars_read" ON storage.objects;
CREATE POLICY "avatars_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

-- 2) طالب مسجّل يقرأ ملف أسئلة الواجب فقط
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

-- 3) مدرّس يقرأ أسئلة + نموذج إجابة دوراته
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

-- 4) تأكد أن الـ bucket موجود وخاص
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('submission-files', 'submission-files', false, 20971520)
ON CONFLICT (id) DO UPDATE SET public = false;
```

## في Storage dashboard
- bucket اسمه **`submission-files`**
- **Private** (مش Public)
- حد الحجم ~20MB
- أنواع: image/png, image/jpeg, application/pdf

## سبب فشل الرفع السابق
الكود كان يرسل `context: "assignment"` بينما قاعدة البيانات تقبل فقط `assignment_submission`.
