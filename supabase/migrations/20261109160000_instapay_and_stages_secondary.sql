-- InstaPay row + secondary admin can manage stages/payment_methods
INSERT INTO public.payment_methods (key, label, number, instructions, is_active, sort_order)
VALUES (
  'instapay',
  'InstaPay',
  '',
  'حوّل عبر InstaPay بالمبلغ المطلوب ثم ارفق رقم العملية أو صورة الإيصال.',
  true,
  1
)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  is_active = true,
  sort_order = 1,
  instructions = COALESCE(public.payment_methods.instructions, EXCLUDED.instructions);

DROP POLICY IF EXISTS "stages any admin all" ON public.stages;
CREATE POLICY "stages any admin all" ON public.stages
  FOR ALL TO authenticated
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));

DROP POLICY IF EXISTS "payment_methods any admin all" ON public.payment_methods;
CREATE POLICY "payment_methods any admin all" ON public.payment_methods
  FOR ALL TO authenticated
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));

INSERT INTO public.stages (name, short, level, description, icon, sort_order)
SELECT
  'نظام البكالوريا',
  'بكالوريا',
  'baccalaureate',
  'مسارات البكالوريا: طب، هندسة، صيدلة، حاسبات، وغيرها.',
  'GraduationCap',
  40
WHERE NOT EXISTS (
  SELECT 1 FROM public.stages WHERE level = 'baccalaureate' OR name ILIKE '%بكالور%'
);
