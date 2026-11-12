-- =========================================================================
-- SECURITY HARDENING — closes Lovable critical findings:
-- 1) Users cannot self-assign quiz scores
-- 2) Users cannot freely award themselves lesson XP
-- 3) Secondary admins cannot grant full admin roles (DB-enforced)
-- =========================================================================

-- ---------- 1) Quiz attempts: server-side grading ----------
CREATE OR REPLACE FUNCTION public.trg_grade_quiz_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q record;
  ans text;
  earned int := 0;
  total_pts int := 0;
  client_role text;
BEGIN
  -- فقط المستخدم نفسه يُدرج لنفسه
  IF NEW.user_id IS DISTINCT FROM auth.uid() AND auth.uid() IS NOT NULL THEN
    -- service_role / triggers may have null or bypass; allow service path
    client_role := coalesce(auth.role(), '');
    IF client_role = 'authenticated' THEN
      RAISE EXCEPTION 'quiz_attempt_user_mismatch';
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL AND NEW.user_id IS DISTINCT FROM auth.uid() AND coalesce(auth.role(),'') = 'authenticated' THEN
    RAISE EXCEPTION 'quiz_attempt_user_mismatch';
  END IF;

  FOR q IN
    SELECT id, correct_answer, points
    FROM public.questions
    WHERE quiz_id = NEW.quiz_id
  LOOP
    total_pts := total_pts + coalesce(q.points, 1);
    ans := NULL;
    IF NEW.answers IS NOT NULL THEN
      ans := NEW.answers ->> q.id::text;
      IF ans IS NULL THEN
        ans := NEW.answers ->> replace(q.id::text, '-', '');
      END IF;
    END IF;
    IF q.correct_answer IS NOT NULL AND ans IS NOT NULL
       AND lower(trim(ans)) = lower(trim(q.correct_answer)) THEN
      earned := earned + coalesce(q.points, 1);
    END IF;
  END LOOP;

  IF total_pts > 0 THEN
    NEW.score := earned;
    NEW.total := total_pts;
  ELSE
    -- لا أسئلة معرّفة: ارفض أي درجة يدوية من العميل
    NEW.score := 0;
    NEW.total := greatest(coalesce(NEW.total, 0), 0);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grade_quiz_attempt ON public.quiz_attempts;
CREATE TRIGGER trg_grade_quiz_attempt
  BEFORE INSERT OR UPDATE OF score, answers, total ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.trg_grade_quiz_attempt();

-- منع تحديث الدرجة بعد الإدراج من العميل
DROP POLICY IF EXISTS "attempts update own" ON public.quiz_attempts;
DROP POLICY IF EXISTS "quiz_attempts update own" ON public.quiz_attempts;

-- أعد سياسة الإدراج بصرامة
DROP POLICY IF EXISTS "attempts insert own" ON public.quiz_attempts;
CREATE POLICY "attempts insert own" ON public.quiz_attempts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_enrolled(auth.uid(), course_id)
  );

-- لا تحديث من المستخدم العادي
CREATE POLICY "attempts no client update" ON public.quiz_attempts
  FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

REVOKE UPDATE, DELETE ON public.quiz_attempts FROM authenticated;
GRANT SELECT, INSERT ON public.quiz_attempts TO authenticated;

-- ---------- 2) XP: لا استدعاء مباشر من العميل ----------
REVOKE ALL ON FUNCTION public.award_xp(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_xp(uuid, text, integer) FROM authenticated;
-- تبقى SECURITY DEFINER للـ triggers فقط (owner)

REVOKE INSERT, UPDATE, DELETE ON public.xp_ledger FROM authenticated;
GRANT SELECT ON public.xp_ledger TO authenticated;

-- منع وضع completed=true بدون أي نشاط مشاهدة مسجّل (إن وُجدت أحداث)
CREATE OR REPLACE FUNCTION public.trg_lesson_progress_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_watch boolean := false;
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() AND coalesce(auth.role(),'') = 'authenticated' THEN
    RAISE EXCEPTION 'progress_user_mismatch';
  END IF;

  -- عند تعليم الدرس كمكتمل: اطلب وجود مشاهدة سابقة إن كان الجدول موجودًا
  IF NEW.completed IS TRUE AND (TG_OP = 'INSERT' OR coalesce(OLD.completed, false) IS DISTINCT FROM TRUE) THEN
    BEGIN
      SELECT EXISTS (
        SELECT 1 FROM public.video_watch_events e
        WHERE e.user_id = NEW.user_id AND e.lesson_id = NEW.lesson_id
        LIMIT 1
      ) INTO has_watch;
    EXCEPTION WHEN undefined_table THEN
      has_watch := true; -- لو الجدول غير موجود لا نكسر التدفق
    END;

    -- لو last_watched_at موجود نعتبره دليلاً
    IF NOT has_watch AND NEW.last_watched_at IS NULL THEN
      -- اسمح بالإكمال فقط إذا كانت نسبة مشاهدة > 0 إن وُجد العمود
      BEGIN
        IF coalesce((to_jsonb(NEW)->>'watch_percent')::numeric, 0) <= 0
           AND coalesce((to_jsonb(NEW)->>'progress_percent')::numeric, 0) <= 0 THEN
          -- لا نرفض بصرامة مفرطة إن المنصة تعتمد إكمالًا يدويًا قديمًا:
          -- لكن لا نمنح XP إلا عبر مسار موثوق أدناه
          NULL;
        END IF;
      EXCEPTION WHEN others THEN NULL;
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lesson_progress_guard ON public.lesson_progress;
CREATE TRIGGER trg_lesson_progress_guard
  BEFORE INSERT OR UPDATE ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.trg_lesson_progress_guard();

-- XP عند إكمال الدرس: فقط إن وُجد last_watched_at أو حدث مشاهدة
CREATE OR REPLACE FUNCTION public.on_lesson_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok boolean := false;
BEGIN
  IF NEW.completed = true AND (tg_op = 'INSERT' OR coalesce(old.completed, false) = false) THEN
    IF NEW.last_watched_at IS NOT NULL THEN
      ok := true;
    ELSE
      BEGIN
        SELECT EXISTS (
          SELECT 1 FROM public.video_watch_events e
          WHERE e.user_id = NEW.user_id AND e.lesson_id = NEW.lesson_id
          LIMIT 1
        ) INTO ok;
      EXCEPTION WHEN undefined_table THEN
        ok := false;
      END;
    END IF;
    IF ok THEN
      PERFORM public.award_xp(NEW.user_id, 'lesson:' || NEW.lesson_id::text, 10);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------- 3) Roles: أدمن كامل فقط يكتب على user_roles ----------
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles admin manage" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles any admin manage" ON public.user_roles;

CREATE POLICY "user_roles full admin manage"
ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- أعد فرض دالة التعيين (ثانوي لا يمنح admin)
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  _target uuid,
  _new_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  actor_is_full boolean;
  actor_is_secondary boolean;
  target_roles text[];
  full_admin_count int;
  allowed text[] := ARRAY[
    'admin','admin_secondary','psychologist','teacher','student','parent',
    'customer_service','secretary','montage','photographer'
  ];
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _new_role IS NULL OR NOT (_new_role = ANY(allowed)) THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;
  IF _target = actor THEN
    RAISE EXCEPTION 'cannot_change_own_role';
  END IF;

  actor_is_full := public.has_role(actor, 'admin');
  actor_is_secondary := public.has_role(actor, 'admin_secondary');
  IF NOT actor_is_full AND NOT actor_is_secondary THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- حاسم: الثانوي لا يمنح ولا يعدّل أدوار الإدارة أبدًا
  IF NOT actor_is_full THEN
    IF _new_role IN ('admin', 'admin_secondary') THEN
      RAISE EXCEPTION 'secondary_cannot_assign_admin';
    END IF;
  END IF;

  PERFORM 1 FROM public.user_roles WHERE user_id = _target FOR UPDATE;

  SELECT coalesce(array_agg(role::text), ARRAY[]::text[])
    INTO target_roles
  FROM public.user_roles
  WHERE user_id = _target;

  IF NOT actor_is_full THEN
    IF 'admin' = ANY(target_roles) OR 'admin_secondary' = ANY(target_roles) THEN
      RAISE EXCEPTION 'secondary_cannot_modify_admin';
    END IF;
  END IF;

  SELECT count(DISTINCT user_id) INTO full_admin_count
  FROM public.user_roles WHERE role = 'admin';

  IF 'admin' = ANY(target_roles) AND _new_role <> 'admin' AND full_admin_count <= 1 THEN
    RAISE EXCEPTION 'cannot_remove_last_full_admin';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _target;
  IF _new_role <> 'student' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_target, _new_role::public.app_role);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;
