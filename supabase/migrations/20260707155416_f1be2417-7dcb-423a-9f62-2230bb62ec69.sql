-- Column-level protection for teachers: hide profit_percentage from everyone (read only via admin RPC),
-- and hide user_id from anonymous visitors.
REVOKE SELECT ON public.teachers FROM anon, authenticated;

GRANT SELECT (
  id, name, subject, bio, experience_years, image_url, rating,
  students_label, sort_order, created_at, updated_at, stage, grade, user_id
) ON public.teachers TO authenticated;

GRANT SELECT (
  id, name, subject, bio, experience_years, image_url, rating,
  students_label, sort_order, created_at, updated_at, stage, grade
) ON public.teachers TO anon;

-- Admin-only full teacher rows (includes profit_percentage) via a security-definer RPC.
CREATE OR REPLACE FUNCTION public.admin_teachers()
RETURNS SETOF public.teachers
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.* FROM public.teachers t
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY t.sort_order;
$$;

REVOKE ALL ON FUNCTION public.admin_teachers() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_teachers() TO authenticated;

-- role_shares (revenue split config) was readable by every signed-in user; restrict to admins.
DROP POLICY IF EXISTS "Authenticated can read role shares" ON public.role_shares;
CREATE POLICY "Admins read role shares"
ON public.role_shares
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));