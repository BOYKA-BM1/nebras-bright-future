DROP POLICY IF EXISTS "submission files owner read" ON storage.objects;
CREATE POLICY "submission files owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'submission-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "submission files owner insert" ON storage.objects;
CREATE POLICY "submission files owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'submission-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "submission files owner delete" ON storage.objects;
CREATE POLICY "submission files owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'submission-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "submission files staff read" ON storage.objects;
CREATE POLICY "submission files staff read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'submission-files'
    AND (
      public.is_any_admin(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.assignment_submissions s
        JOIN public.assignments a ON a.id = s.assignment_id
        WHERE s.student_id::text = (storage.foldername(name))[1]
          AND public.owns_course(auth.uid(), a.course_id)
      )
    )
  );