-- Pass 4: atomic role changes, CPE rate-limit inside RPC, revoke direct CPE execute if needed,
-- payment request insert hardening note (app uses server fn + RLS)

-- ===== Atomic set_user_role =====
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
    'admin','admin_secondary','psychologist','teacher','student',
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

  -- Lock target role rows to reduce races
  PERFORM 1 FROM public.user_roles WHERE user_id = _target FOR UPDATE;

  SELECT coalesce(array_agg(role), ARRAY[]::text[])
    INTO target_roles
  FROM public.user_roles
  WHERE user_id = _target;

  -- Secondary cannot touch admin accounts or assign admin roles
  IF NOT actor_is_full THEN
    IF _new_role IN ('admin', 'admin_secondary') THEN
      RAISE EXCEPTION 'secondary_cannot_assign_admin';
    END IF;
    IF 'admin' = ANY(target_roles) OR 'admin_secondary' = ANY(target_roles) THEN
      RAISE EXCEPTION 'secondary_cannot_modify_admin';
    END IF;
  END IF;

  -- Protect last full admin
  SELECT count(DISTINCT user_id) INTO full_admin_count
  FROM public.user_roles WHERE role = 'admin';

  IF 'admin' = ANY(target_roles) AND _new_role <> 'admin' AND full_admin_count <= 1 THEN
    RAISE EXCEPTION 'cannot_remove_last_full_admin';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _target;
  IF _new_role <> 'student' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_target, _new_role::public.app_role);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;

-- ===== CPE RPC: rate limit inside function + keep classification server-side =====
CREATE OR REPLACE FUNCTION public.report_content_protection_event(
  _course_id uuid,
  _lesson_id uuid,
  _signal text,
  _client_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  allowed_signal text;
  evt_type text;
  det_method text;
  conf text;
  new_id uuid;
  enrolled boolean;
  rate_ok boolean;
  lesson_course uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Atomic rate limit inside DB (fail-closed if RPC missing)
  BEGIN
    SELECT public.check_rate_limit('cpe:' || uid::text, 20, 300) INTO rate_ok;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'rate_limited';
  END;
  IF rate_ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  allowed_signal := lower(trim(coalesce(_signal, '')));
  IF allowed_signal NOT IN (
    'printscreen_key','devtools_shortcut','beforeprint',
    'visibilitychange','window_blur','context_menu_block'
  ) THEN
    RAISE EXCEPTION 'invalid_signal';
  END IF;

  IF allowed_signal IN ('printscreen_key', 'beforeprint') THEN
    evt_type := 'capture_attempt_suspected';
    det_method := 'browser_signal';
    conf := 'medium';
  ELSIF allowed_signal IN ('visibilitychange', 'window_blur') THEN
    evt_type := 'protected_content_visibility_changed';
    det_method := 'browser_signal';
    conf := 'low';
  ELSE
    evt_type := 'capture_attempt_suspected';
    det_method := 'browser_signal';
    conf := 'low';
  END IF;

  IF _lesson_id IS NOT NULL THEN
    IF _course_id IS NULL THEN
      RAISE EXCEPTION 'lesson_requires_course';
    END IF;
    SELECT course_id INTO lesson_course FROM public.lessons WHERE id = _lesson_id;
    IF lesson_course IS NULL OR lesson_course <> _course_id THEN
      RAISE EXCEPTION 'lesson_course_mismatch';
    END IF;
  END IF;

  IF _course_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.user_id = uid AND e.course_id = _course_id AND coalesce(e.status, 'active') = 'active'
    ) INTO enrolled;
    IF NOT enrolled AND NOT (
      public.has_role(uid, 'admin') OR public.has_role(uid, 'admin_secondary') OR public.has_role(uid, 'teacher')
    ) THEN
      RAISE EXCEPTION 'not_enrolled';
    END IF;
  END IF;

  INSERT INTO public.content_protection_events (
    user_id, course_id, lesson_id, event_type, detection_method, confidence,
    platform, user_agent, session_note
  ) VALUES (
    uid, _course_id, _lesson_id, evt_type, det_method, conf,
    NULL, NULL, left(coalesce(_client_note, ''), 200)
  ) RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- Prefer server path: revoke direct execute from anon; authenticated kept for server using user JWT
-- (Server Function uses service role insert OR user JWT calling this RPC — both rate-limited here)
REVOKE ALL ON FUNCTION public.report_content_protection_event(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_content_protection_event(uuid, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_content_protection_event(uuid, uuid, text, text) TO authenticated;

-- Optional: block direct client inserts into payment_requests except via controlled path
-- (RLS may still allow student insert — app will use server fn; tighten if policy exists)
