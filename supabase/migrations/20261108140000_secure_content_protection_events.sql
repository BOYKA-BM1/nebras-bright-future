-- Secure content-protection event reporting (Master Security Pass 2)
-- Browser clients must NOT choose confidence or claim confirmed_native.

-- Tighten table constraints if table exists from prior migration
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='content_protection_events') THEN
    -- Drop permissive insert policy for authenticated direct inserts
    DROP POLICY IF EXISTS "cpe_insert_own" ON public.content_protection_events;
  END IF;
END $$;

-- Students cannot update/delete their events
DROP POLICY IF EXISTS "cpe_student_update" ON public.content_protection_events;
DROP POLICY IF EXISTS "cpe_student_delete" ON public.content_protection_events;

-- Only admins (full or secondary) may select all; students may select own (read-only)
DROP POLICY IF EXISTS "cpe_admin_select" ON public.content_protection_events;
CREATE POLICY "cpe_admin_select" ON public.content_protection_events
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'admin_secondary')
    OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "cpe_admin_update" ON public.content_protection_events;
CREATE POLICY "cpe_admin_update" ON public.content_protection_events
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'admin_secondary')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'admin_secondary')
  );

-- No DELETE for authenticated (service role only for purge jobs)
DROP POLICY IF EXISTS "cpe_admin_delete" ON public.content_protection_events;
REVOKE ALL ON public.content_protection_events FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.content_protection_events TO authenticated;
-- INSERT will only succeed via SECURITY DEFINER function after we revoke direct insert:
REVOKE INSERT ON public.content_protection_events FROM authenticated;
GRANT SELECT, UPDATE ON public.content_protection_events TO authenticated;

-- Secure reporter: classifies browser signals server-side
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
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Normalize allowed browser signals only
  allowed_signal := lower(trim(coalesce(_signal, '')));
  IF allowed_signal NOT IN (
    'printscreen_key',
    'devtools_shortcut',
    'beforeprint',
    'visibilitychange',
    'window_blur',
    'context_menu_block'
  ) THEN
    RAISE EXCEPTION 'invalid_signal';
  END IF;

  -- Server-side classification — never trust client confidence
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

  -- Course/lesson consistency: if course provided, must be enrolled (active)
  IF _course_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.user_id = uid AND e.course_id = _course_id AND coalesce(e.status, 'active') = 'active'
    ) INTO enrolled;
    IF NOT enrolled THEN
      -- Also allow if user is teacher/admin of platform
      IF NOT (
        public.has_role(uid, 'admin')
        OR public.has_role(uid, 'admin_secondary')
        OR public.has_role(uid, 'teacher')
      ) THEN
        RAISE EXCEPTION 'not_enrolled';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.content_protection_events (
    user_id, course_id, lesson_id, event_type, detection_method, confidence,
    platform, user_agent, session_note
  ) VALUES (
    uid,
    _course_id,
    _lesson_id,
    evt_type,
    det_method,
    conf,
    NULL, -- do not trust client platform
    left(coalesce(current_setting('request.headers', true), ''), 0), -- leave UA empty from SQL; server fn can set via admin client
    left(coalesce(_client_note, ''), 200)
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.report_content_protection_event(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_content_protection_event(uuid, uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.report_content_protection_event IS
  'Records browser content-protection signals only. Never accepts confirmed_native. user_id from auth.uid().';

-- Do not force payment methods active without real receiver data.
-- Leave admin to configure numbers; is_active may stay true only when configured in app filter.
UPDATE public.payment_methods
SET is_active = false
WHERE (number IS NULL OR length(trim(number)) < 3)
  AND (instructions IS NULL OR length(trim(instructions)) < 8)
  AND key IN ('instapay', 'vodafone_cash', 'etisalat_cash', 'fawry');
