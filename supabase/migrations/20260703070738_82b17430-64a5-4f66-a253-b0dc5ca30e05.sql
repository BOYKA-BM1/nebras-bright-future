CREATE POLICY "user_roles staff view" ON public.user_roles FOR SELECT
TO authenticated USING (public.is_support_staff(auth.uid()));