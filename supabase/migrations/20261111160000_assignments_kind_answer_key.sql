ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'homework'
    CHECK (kind IN ('homework', 'exam'));

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS file_url text;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS answer_key_url text;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS answer_key_text text;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS unlock_after_lesson boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.assignments.kind IS 'homework | exam';
COMMENT ON COLUMN public.assignments.answer_key_text IS 'نموذج إجابة المدرّس للتصحيح بالذكاء الاصطناعي';
COMMENT ON COLUMN public.assignments.answer_key_url IS 'ملف نموذج الإجابة (اختياري)';
