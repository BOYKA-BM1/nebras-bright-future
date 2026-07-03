
-- ============ helper: staff (support) roles ============
CREATE OR REPLACE FUNCTION public.is_support_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','customer_service','secretary')
  )
$$;

-- ============ lessons review workflow (montage) ============
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending';

-- existing lessons are considered approved so they keep showing
UPDATE public.lessons SET review_status = 'approved' WHERE review_status = 'pending';

ALTER TABLE public.lessons
  ADD CONSTRAINT lessons_review_status_chk CHECK (review_status IN ('pending','approved'));

-- students only see approved lessons of published courses; admin/owner/montage see all
DROP POLICY IF EXISTS "lessons public read published" ON public.lessons;
CREATE POLICY "lessons public read published" ON public.lessons FOR SELECT
USING (
  (
    review_status = 'approved'
    AND EXISTS (SELECT 1 FROM public.courses c WHERE c.id = lessons.course_id AND c.is_published)
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.owns_course(auth.uid(), course_id)
  OR public.has_role(auth.uid(), 'montage')
);

-- montage can read & update lessons (to edit / publish)
DROP POLICY IF EXISTS "lessons montage manage" ON public.lessons;
CREATE POLICY "lessons montage manage" ON public.lessons FOR UPDATE
USING (public.has_role(auth.uid(), 'montage'))
WITH CHECK (public.has_role(auth.uid(), 'montage'));

-- notify all montage accounts when a pending video lesson is added
CREATE OR REPLACE FUNCTION public.notify_montage_new_lesson()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
BEGIN
  IF NEW.review_status = 'pending' AND NEW.video_url IS NOT NULL THEN
    FOR m IN SELECT user_id FROM public.user_roles WHERE role = 'montage' LOOP
      INSERT INTO public.notifications (user_id, title, body, type, link)
      VALUES (
        m.user_id,
        'درس جديد بانتظار المونتاج',
        'تم رفع درس "' || NEW.title || '" وهو قيد المراجعة والمونتاج.',
        'montage',
        '/staff/montage'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_montage ON public.lessons;
CREATE TRIGGER trg_notify_montage
AFTER INSERT ON public.lessons
FOR EACH ROW EXECUTE FUNCTION public.notify_montage_new_lesson();

-- allow montage users to receive notifications inserted for them (via definer trigger already ok)
-- allow staff to read notifications addressed to them (already covered by read own)

-- ============ support tickets (customer service) ============
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  response text,
  responded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets insert own" ON public.support_tickets FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tickets read own or staff" ON public.support_tickets FOR SELECT
TO authenticated USING (
  auth.uid() = user_id OR public.is_support_staff(auth.uid())
);

-- customer service + admin can respond / update
CREATE POLICY "tickets respond staff" ON public.support_tickets FOR UPDATE
TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'customer_service')
) WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'customer_service')
);

CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ staff visibility into student data ============
CREATE POLICY "profiles staff view" ON public.profiles FOR SELECT
TO authenticated USING (public.is_support_staff(auth.uid()));

CREATE POLICY "enrollments staff view" ON public.enrollments FOR SELECT
TO authenticated USING (public.is_support_staff(auth.uid()));

CREATE POLICY "progress staff view" ON public.lesson_progress FOR SELECT
TO authenticated USING (public.is_support_staff(auth.uid()));

CREATE POLICY "attempts staff view" ON public.quiz_attempts FOR SELECT
TO authenticated USING (public.is_support_staff(auth.uid()));

CREATE POLICY "payments staff view" ON public.payments FOR SELECT
TO authenticated USING (public.is_support_staff(auth.uid()));

-- staff need to read roles to resolve student vs staff (has_role already definer); allow reading course/quiz metadata is public already
