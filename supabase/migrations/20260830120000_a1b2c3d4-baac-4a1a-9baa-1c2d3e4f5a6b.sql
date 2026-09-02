-- =========================================================================
-- EGYPTIAN BACCALAUREATE INTEGRATION
-- Fully additive: no existing column dropped/renamed, no existing default
-- changed, every new FK on courses/profiles is NULLABLE. An existing
-- "General Secondary" student/course is completely unaffected — their
-- rows simply have NULL in the new columns and behave exactly as before.
-- =========================================================================

-- ----- 1) education_systems -----
CREATE TABLE IF NOT EXISTS public.education_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code IN ('general_secondary', 'egyptian_baccalaureate')),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.education_systems TO anon, authenticated;
GRANT ALL ON public.education_systems TO service_role;
ALTER TABLE public.education_systems ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "education_systems public read" ON public.education_systems;
CREATE POLICY "education_systems public read" ON public.education_systems FOR SELECT USING (true);
DROP POLICY IF EXISTS "education_systems admin manage" ON public.education_systems;
CREATE POLICY "education_systems admin manage" ON public.education_systems FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.education_systems (code, name_ar, name_en) VALUES
  ('general_secondary', 'الثانوية العامة', 'General Secondary'),
  ('egyptian_baccalaureate', 'البكالوريا المصرية', 'Egyptian Baccalaureate')
ON CONFLICT (code) DO NOTHING;

-- ----- 2) academic_years — real entity, not a free string per course -----
CREATE TABLE IF NOT EXISTS public.academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  start_date date,
  end_date date,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.academic_years TO anon, authenticated;
GRANT ALL ON public.academic_years TO service_role;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "academic_years public read" ON public.academic_years;
CREATE POLICY "academic_years public read" ON public.academic_years FOR SELECT USING (true);
DROP POLICY IF EXISTS "academic_years admin manage" ON public.academic_years;
CREATE POLICY "academic_years admin manage" ON public.academic_years FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- على الأكثر سنة واحدة فعّالة في نفس الوقت
CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_years_one_active ON public.academic_years ((is_active)) WHERE is_active = true;

-- ----- 3) baccalaureate_tracks — المسارات الأربعة المُعطاة صراحةً، مش تخمين -----
CREATE TABLE IF NOT EXISTS public.baccalaureate_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  -- الصف الأول تمهيدي/عام ومفيهوش مسار؛ الاختيار يظهر بس في الصف الثاني/الثالث
  applicable_grades text[] NOT NULL DEFAULT ARRAY['الصف الثاني الثانوي', 'الصف الثالث الثانوي'],
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.baccalaureate_tracks TO anon, authenticated;
GRANT ALL ON public.baccalaureate_tracks TO service_role;
ALTER TABLE public.baccalaureate_tracks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "baccalaureate_tracks public read" ON public.baccalaureate_tracks;
CREATE POLICY "baccalaureate_tracks public read" ON public.baccalaureate_tracks FOR SELECT USING (true);
DROP POLICY IF EXISTS "baccalaureate_tracks admin manage" ON public.baccalaureate_tracks;
CREATE POLICY "baccalaureate_tracks admin manage" ON public.baccalaureate_tracks FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.baccalaureate_tracks (code, name_ar, name_en, sort_order) VALUES
  ('medicine_life_sciences', 'الطب وعلوم الحياة', 'Medicine & Life Sciences', 1),
  ('engineering_computer_science', 'الهندسة وعلوم الحاسب', 'Engineering & Computer Science', 2),
  ('business', 'الأعمال', 'Business', 3),
  ('arts_humanities', 'الآداب والفنون', 'Arts & Humanities', 4)
ON CONFLICT (code) DO NOTHING;

-- ----- 4) subjects — Database-driven بالكامل، مفيش أي مادة متخمّنة أو متزروعة هنا.
-- الأدمن هو اللي هيدخّل المواد الرسمية من واجهة إدارة، مش الكود.
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text,
  education_system_id uuid NOT NULL REFERENCES public.education_systems(id) ON DELETE CASCADE,
  grade text NOT NULL,
  track_id uuid REFERENCES public.baccalaureate_tracks(id) ON DELETE SET NULL,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  subject_type text NOT NULL DEFAULT 'core' CHECK (subject_type IN ('core', 'elective')),
  is_required boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subjects TO anon, authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_subjects_lookup ON public.subjects(education_system_id, grade, track_id);
DROP POLICY IF EXISTS "subjects public read" ON public.subjects;
CREATE POLICY "subjects public read" ON public.subjects FOR SELECT USING (active = true OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "subjects admin manage" ON public.subjects;
CREATE POLICY "subjects admin manage" ON public.subjects FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
