-- Secondary admin manages catalog like full admin
CREATE OR REPLACE FUNCTION public.is_any_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'admin_secondary')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_any_admin(uuid) TO authenticated;

DROP POLICY IF EXISTS "courses any admin all" ON public.courses;
CREATE POLICY "courses any admin all" ON public.courses
  FOR ALL TO authenticated
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));

DROP POLICY IF EXISTS "teachers any admin all" ON public.teachers;
CREATE POLICY "teachers any admin all" ON public.teachers
  FOR ALL TO authenticated
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));

DROP POLICY IF EXISTS "stages any admin all" ON public.stages;
CREATE POLICY "stages any admin all" ON public.stages
  FOR ALL TO authenticated
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));

DROP POLICY IF EXISTS "sections any admin all" ON public.sections;
CREATE POLICY "sections any admin all" ON public.sections
  FOR ALL TO authenticated
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));

DROP POLICY IF EXISTS "lessons any admin all" ON public.lessons;
CREATE POLICY "lessons any admin all" ON public.lessons
  FOR ALL TO authenticated
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));

DROP POLICY IF EXISTS "academic_years any admin all" ON public.academic_years;
CREATE POLICY "academic_years any admin all" ON public.academic_years
  FOR ALL TO authenticated
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));

DROP POLICY IF EXISTS "payment_methods any admin all" ON public.payment_methods;
CREATE POLICY "payment_methods any admin all" ON public.payment_methods
  FOR ALL TO authenticated
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));
