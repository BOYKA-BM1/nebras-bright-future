-- =========================================================================
-- UNIFIED FILES SYSTEM (scoped to assignment-submission uploads for now —
-- the one place in the app where students currently paste a raw URL with
-- zero ownership tracking, validation, or access control)
--
-- IMPORTANT — matches this project's existing convention: every other
-- bucket (avatars, lesson-videos, lesson-pdfs, payment-receipts) is
-- created OUTSIDE of SQL migrations (via the Supabase dashboard), and this
-- migration only adds policies for a bucket assumed to already exist. You
-- MUST create a bucket named 'submission-files' (private, not public)
-- in the Supabase dashboard before these storage policies take effect.
-- Recommended bucket settings: private, file size limit ~20MB, allowed
-- MIME types: application/pdf, image/png, image/jpeg, application/msword,
-- application/vnd.openxmlformats-officedocument.wordprocessingml.document
-- (bucket-level limits are the actual hard enforcement point — client-side
-- checks in the app are a UX convenience only, never the security boundary)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  original_filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  context text NOT NULL DEFAULT 'assignment_submission' CHECK (context IN ('assignment_submission')),
  related_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_files_owner ON public.files(owner_id);
CREATE INDEX IF NOT EXISTS idx_files_related ON public.files(context, related_id);

DROP POLICY IF EXISTS "files owner all" ON public.files;
CREATE POLICY "files owner all" ON public.files FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "files teacher view submissions" ON public.files;
CREATE POLICY "files teacher view submissions" ON public.files FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      context = 'assignment_submission'
      AND EXISTS (
        SELECT 1 FROM public.assignment_submissions s
        JOIN public.assignments a ON a.id = s.assignment_id
        WHERE s.id = files.related_id AND public.owns_course(auth.uid(), a.course_id)
      )
    )
  );

-- ----- storage.objects policies for the 'submission-files' bucket -----
DROP POLICY IF EXISTS "submission files owner rw" ON storage.objects;
CREATE POLICY "submission files owner rw" ON storage.objects FOR ALL
  USING (bucket_id = 'submission-files' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'submission-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "submission files teacher read" ON storage.objects;
CREATE POLICY "submission files teacher read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'submission-files'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.files f
        JOIN public.assignment_submissions s ON s.id = f.related_id
        JOIN public.assignments a ON a.id = s.assignment_id
        WHERE f.storage_path = storage.objects.name AND f.context = 'assignment_submission'
          AND public.owns_course(auth.uid(), a.course_id)
      )
    )
  );
