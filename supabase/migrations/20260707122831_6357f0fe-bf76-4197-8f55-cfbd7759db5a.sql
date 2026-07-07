ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS grade text;