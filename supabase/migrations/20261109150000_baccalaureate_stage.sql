-- إضافة مرحلة البكالوريا إن لم تكن موجودة
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
