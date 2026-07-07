ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS transcript text;

COMMENT ON COLUMN public.lessons.transcript IS 'Auto-generated text transcript of the lecture video, used to ground the AI tutor answers.';