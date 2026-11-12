-- أعمدة الواجبات/الامتحانات: نوع + ملفات الأسئلة ونموذج الإجابة
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'homework';

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS file_url text;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS answer_key_url text;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS answer_key_text text;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS unlock_after_lesson boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_kind_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.assignments
    ADD CONSTRAINT assignments_kind_check CHECK (kind IN ('homework', 'exam'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.assignments.kind IS 'homework | exam';
COMMENT ON COLUMN public.assignments.file_url IS 'ملف/صورة الأسئلة للطالب';
COMMENT ON COLUMN public.assignments.answer_key_url IS 'ملف/صورة نموذج الإجابة (لا يظهر للطالب)';
COMMENT ON COLUMN public.assignments.answer_key_text IS 'نص نموذج الإجابة للتصحيح بالذكاء الاصطناعي';
