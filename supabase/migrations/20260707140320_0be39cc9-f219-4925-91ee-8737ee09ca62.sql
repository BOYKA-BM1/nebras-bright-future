CREATE TABLE public.knowledge_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  stage text,        -- primary | prep | secondary | NULL = كل المراحل
  grade text,        -- اسم الصف أو NULL = كل الصفوف
  subject text,
  content text NOT NULL DEFAULT '',
  file_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_docs TO authenticated;
GRANT ALL ON public.knowledge_docs TO service_role;

ALTER TABLE public.knowledge_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read knowledge"
  ON public.knowledge_docs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage knowledge"
  ON public.knowledge_docs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER knowledge_docs_updated_at
  BEFORE UPDATE ON public.knowledge_docs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();