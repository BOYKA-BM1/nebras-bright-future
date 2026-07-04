CREATE POLICY "Montage and admin manage lesson videos - select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'lesson-videos'
  AND (public.has_role(auth.uid(), 'montage') OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Montage and admin manage lesson videos - insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'lesson-videos'
  AND (public.has_role(auth.uid(), 'montage') OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Montage and admin manage lesson videos - update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'lesson-videos'
  AND (public.has_role(auth.uid(), 'montage') OR public.has_role(auth.uid(), 'admin'))
)
WITH CHECK (
  bucket_id = 'lesson-videos'
  AND (public.has_role(auth.uid(), 'montage') OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Montage and admin manage lesson videos - delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'lesson-videos'
  AND (public.has_role(auth.uid(), 'montage') OR public.has_role(auth.uid(), 'admin'))
);