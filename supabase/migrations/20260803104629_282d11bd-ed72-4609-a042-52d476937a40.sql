-- ===== أدوار مساعدة =====
CREATE OR REPLACE FUNCTION public.is_any_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','admin_secondary'))
$$;
REVOKE EXECUTE ON FUNCTION public.is_any_admin(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.my_class_room()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(NULLIF(TRIM(p.grade), ''), 'general') FROM public.profiles p WHERE p.id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.my_class_room() FROM anon;

-- ===== الغرفة النفسية: الرسائل =====
CREATE TABLE public.psych_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX psych_messages_student_idx ON public.psych_messages (student_id, created_at);

GRANT SELECT, INSERT ON public.psych_messages TO authenticated;
GRANT ALL ON public.psych_messages TO service_role;
ALTER TABLE public.psych_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psych msgs read own or staff" ON public.psych_messages
FOR SELECT TO authenticated
USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'psychologist') OR public.is_any_admin(auth.uid()));

CREATE POLICY "psych msgs student writes own" ON public.psych_messages
FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND student_id = auth.uid());

CREATE POLICY "psych msgs staff writes" ON public.psych_messages
FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND (public.has_role(auth.uid(), 'psychologist') OR public.is_any_admin(auth.uid())));

-- ===== الغرفة النفسية: طلبات المكالمة =====
CREATE TABLE public.psych_call_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  topic text,
  preferred_time text,
  status text NOT NULL DEFAULT 'pending',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX psych_calls_status_idx ON public.psych_call_requests (status, created_at DESC);

GRANT SELECT, INSERT ON public.psych_call_requests TO authenticated;
GRANT UPDATE ON public.psych_call_requests TO authenticated;
GRANT ALL ON public.psych_call_requests TO service_role;
ALTER TABLE public.psych_call_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psych calls read own or staff" ON public.psych_call_requests
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'psychologist') OR public.is_any_admin(auth.uid()));

CREATE POLICY "psych calls insert own" ON public.psych_call_requests
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "psych calls staff update" ON public.psych_call_requests
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'psychologist') OR public.is_any_admin(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'psychologist') OR public.is_any_admin(auth.uid()));

-- ===== غرف دردشة الصفوف =====
CREATE TABLE public.class_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX class_messages_room_idx ON public.class_messages (room, created_at);

GRANT SELECT, INSERT, DELETE ON public.class_messages TO authenticated;
GRANT ALL ON public.class_messages TO service_role;
ALTER TABLE public.class_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class msgs read own room" ON public.class_messages
FOR SELECT TO authenticated
USING (room = public.my_class_room() OR public.is_any_admin(auth.uid()));

CREATE POLICY "class msgs insert own room" ON public.class_messages
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND room = public.my_class_room());

CREATE POLICY "class msgs delete own or admin" ON public.class_messages
FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_any_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.class_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.psych_messages;

-- ===== إصلاح أمني: إجابات الاختبارات =====
DROP POLICY IF EXISTS "questions public read published" ON public.questions;
REVOKE SELECT ON public.questions FROM anon;

CREATE POLICY "questions read for enrolled" ON public.questions
FOR SELECT TO authenticated
USING (
  public.is_enrolled(auth.uid(), course_id)
  OR public.owns_course(auth.uid(), course_id)
  OR public.has_role(auth.uid(), 'admin')
);