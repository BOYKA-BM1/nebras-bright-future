-- نفّذ هذا فورًا في Supabase → SQL Editor ثم أعد نشر الامتحان

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

-- حدّث كاش الـ API (اختياري): من Dashboard → Settings → API → Reload schema
-- أو انتظر دقيقة بعد التنفيذ

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'assignments'
ORDER BY ordinal_position;
