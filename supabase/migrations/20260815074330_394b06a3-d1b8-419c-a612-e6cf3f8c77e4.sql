CREATE OR REPLACE FUNCTION public.is_photographer(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'photographer')
$$;

REVOKE ALL ON FUNCTION public.is_photographer(uuid) FROM anon;

-- المصوّر يشوف كل الدروس ويضيف دروس جديدة فقط (بدون تعديل أو حذف)
CREATE POLICY "lessons photographer read" ON public.lessons
  FOR SELECT TO authenticated USING (public.is_photographer(auth.uid()));

CREATE POLICY "lessons photographer insert" ON public.lessons
  FOR INSERT TO authenticated
  WITH CHECK (public.is_photographer(auth.uid()) AND review_status = 'pending' AND is_published = false);

-- يشوف كل الدورات (حتى غير المنشورة) والأقسام لاختيار الدورة
CREATE POLICY "courses photographer read" ON public.courses
  FOR SELECT TO authenticated USING (public.is_photographer(auth.uid()));

CREATE POLICY "sections photographer read" ON public.sections
  FOR SELECT TO authenticated USING (public.is_photographer(auth.uid()));

-- رفع الفيديوهات والملفات لبكت الدروس (بدون حذف)
CREATE POLICY "Lesson videos insert (photographer)" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lesson-videos' AND public.is_photographer(auth.uid()));

CREATE POLICY "Lesson videos select (photographer)" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'lesson-videos' AND public.is_photographer(auth.uid()));

CREATE POLICY "Lesson pdfs insert (photographer)" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lesson-pdfs' AND public.is_photographer(auth.uid()));

CREATE POLICY "Lesson pdfs select (photographer)" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'lesson-pdfs' AND public.is_photographer(auth.uid()));