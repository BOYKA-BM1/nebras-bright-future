ALTER TABLE public.knowledge_docs
  ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS teacher_name TEXT;