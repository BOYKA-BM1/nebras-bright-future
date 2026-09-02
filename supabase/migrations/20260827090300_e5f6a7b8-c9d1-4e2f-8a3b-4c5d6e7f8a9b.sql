-- The review workflow (request changes / publish) marks the submitted video
-- version as 'rejected' or 'approved'. Only admin performs those transitions
-- client-side (see staff.montage.tsx), so only admin needs UPDATE here.
DROP POLICY IF EXISTS "video versions admin review" ON public.lesson_video_versions;
CREATE POLICY "video versions admin review" ON public.lesson_video_versions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
