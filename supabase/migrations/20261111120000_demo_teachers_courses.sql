-- صلاحيات الأدمن الثانوي على teachers/courses
DROP POLICY IF EXISTS "teachers any admin all" ON public.teachers;
CREATE POLICY "teachers any admin all" ON public.teachers
  FOR ALL TO authenticated
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));

DROP POLICY IF EXISTS "courses any admin all" ON public.courses;
CREATE POLICY "courses any admin all" ON public.courses
  FOR ALL TO authenticated
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));

-- مسارات البكالوريا الرسمية
INSERT INTO public.baccalaureate_tracks (code, name_ar, name_en, sort_order) VALUES
  ('medicine_life_sciences', 'الطب وعلوم الحياة', 'Medicine & Life Sciences', 1),
  ('engineering_computer_science', 'الهندسة وعلوم الحاسب', 'Engineering & Computer Science', 2),
  ('business', 'الأعمال', 'Business', 3),
  ('arts_humanities', 'الآداب والفنون', 'Arts & Humanities', 4)
ON CONFLICT (code) DO NOTHING;

-- مدرّسون تجريبيون
INSERT INTO public.teachers (name, subject, bio, experience_years, rating, students_label, sort_order, stage, grade)
SELECT v.name, v.subject, v.bio, v.experience_years, v.rating, v.students_label, v.sort_order, v.stage, v.grade
FROM (VALUES
  ('أ. أحمد محمود', 'الرياضيات', 'مدرّس رياضيات للثانوية والبكالوريا.', 12, 4.9::numeric, '2.4k+', 1, 'secondary', 'الصف الثالث الثانوي'),
  ('أ. سارة حسن', 'اللغة العربية', 'شرح مبسّط للنحو والبلاغة والأدب.', 9, 4.8::numeric, '1.8k+', 2, 'secondary', 'الصف الثاني الثانوي'),
  ('د. كريم علي', 'الفيزياء', 'فيزياء لمسار الهندسة وعلوم الحاسب.', 15, 5.0::numeric, '3.1k+', 3, 'baccalaureate', 'السنة الأولى بكالوريا'),
  ('أ. نور إبراهيم', 'الأحياء', 'أحياء لمسار الطب وعلوم الحياة.', 8, 4.7::numeric, '1.2k+', 4, 'baccalaureate', 'السنة الأولى بكالوريا')
) AS v(name, subject, bio, experience_years, rating, students_label, sort_order, stage, grade)
WHERE NOT EXISTS (SELECT 1 FROM public.teachers t WHERE t.name = v.name);

-- دورات تجريبية
INSERT INTO public.courses (
  title, description, price, old_price, grade, track, subject, type,
  lessons_count, videos_count, hours, is_published, sort_order, teacher_id, stage_id
)
SELECT
  v.title,
  v.description,
  v.price,
  v.old_price,
  v.grade,
  v.track,
  v.subject,
  'recorded',
  v.lessons,
  v.videos,
  v.hours,
  true,
  v.sort_order,
  (SELECT id FROM public.teachers WHERE name = v.teacher_name LIMIT 1),
  (SELECT id FROM public.stages WHERE level = v.stage_level OR name ILIKE '%' || v.stage_hint || '%' LIMIT 1)
FROM (VALUES
  ('رياضيات ثانوية عامة — المراجعة الشاملة', 'مراجعة مركّزة للجبر والهندسة والتفاضل.', 0, 450, 'الصف الثالث الثانوي', 'all', 'الرياضيات', 24, 24, 40, 1, 'أ. أحمد محمود', 'secondary', 'ثانوي'),
  ('لغة عربية — نحو وبلاغة', 'شرح مبسّط مع تدريبات وامتحانات دورية.', 199, 350, 'الصف الثاني الثانوي', 'all', 'اللغة العربية', 18, 18, 28, 2, 'أ. سارة حسن', 'secondary', 'ثانوي'),
  ('فيزياء البكالوريا — مسار الهندسة', 'ميكانيكا وكهربية لمسار الهندسة وعلوم الحاسب.', 299, 500, 'السنة الأولى بكالوريا', 'all', 'الفيزياء', 20, 20, 32, 3, 'د. كريم علي', 'baccalaureate', 'بكالور'),
  ('أحياء البكالوريا — مسار الطب', 'خلية ووراثة لمسار الطب وعلوم الحياة.', 299, 480, 'السنة الأولى بكالوريا', 'all', 'الأحياء', 16, 16, 26, 4, 'أ. نور إبراهيم', 'baccalaureate', 'بكالور')
) AS v(title, description, price, old_price, grade, track, subject, lessons, videos, hours, sort_order, teacher_name, stage_level, stage_hint)
WHERE NOT EXISTS (SELECT 1 FROM public.courses c WHERE c.title = v.title);
