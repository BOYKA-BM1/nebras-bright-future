-- 1) Fix lesson video uploads: allow teachers (not only montage/admin) to upload their lecture videos
DROP POLICY IF EXISTS "Montage and admin manage lesson videos - insert" ON storage.objects;
DROP POLICY IF EXISTS "Montage and admin manage lesson videos - select" ON storage.objects;
DROP POLICY IF EXISTS "Montage and admin manage lesson videos - update" ON storage.objects;
DROP POLICY IF EXISTS "Montage and admin manage lesson videos - delete" ON storage.objects;

CREATE POLICY "Lesson videos insert (teacher/montage/admin)" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lesson-videos'
    AND (has_role(auth.uid(),'teacher') OR has_role(auth.uid(),'montage') OR has_role(auth.uid(),'admin'))
  );

CREATE POLICY "Lesson videos select (teacher/montage/admin)" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'lesson-videos'
    AND (has_role(auth.uid(),'teacher') OR has_role(auth.uid(),'montage') OR has_role(auth.uid(),'admin'))
  );

CREATE POLICY "Lesson videos update (teacher/montage/admin)" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'lesson-videos'
    AND (has_role(auth.uid(),'teacher') OR has_role(auth.uid(),'montage') OR has_role(auth.uid(),'admin'))
  )
  WITH CHECK (
    bucket_id = 'lesson-videos'
    AND (has_role(auth.uid(),'teacher') OR has_role(auth.uid(),'montage') OR has_role(auth.uid(),'admin'))
  );

CREATE POLICY "Lesson videos delete (montage/admin)" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'lesson-videos'
    AND (has_role(auth.uid(),'montage') OR has_role(auth.uid(),'admin'))
  );

-- 2) Per-role profit percentage table (set a share % for each job/role)
CREATE TABLE public.role_shares (
  role app_role PRIMARY KEY,
  percentage numeric NOT NULL DEFAULT 50 CHECK (percentage >= 0 AND percentage <= 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.role_shares TO authenticated;
GRANT ALL ON public.role_shares TO service_role;

ALTER TABLE public.role_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read role shares" ON public.role_shares
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage role shares" ON public.role_shares
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TRIGGER update_role_shares_updated_at
  BEFORE UPDATE ON public.role_shares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- seed defaults for every role/job
INSERT INTO public.role_shares (role, percentage) VALUES
  ('teacher', 50),
  ('customer_service', 0),
  ('secretary', 0),
  ('montage', 0)
ON CONFLICT (role) DO NOTHING;