-- ============================================================
-- 1) AUDIT LOGS
-- ============================================================
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action, created_at DESC);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit logs read staff"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_support_staff(auth.uid()));

-- ============================================================
-- 2) LOGIN EVENTS + DEVICE FINGERPRINT
-- ============================================================
CREATE TABLE public.login_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint text,
  device_type text,
  browser text,
  screen text,
  timezone text,
  hardware text,
  ip text,
  country text,
  city text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_events_user ON public.login_events(user_id, created_at DESC);

GRANT SELECT ON public.login_events TO authenticated;
GRANT ALL ON public.login_events TO service_role;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "login events own or staff"
  ON public.login_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_support_staff(auth.uid()));

-- ============================================================
-- 3) SECURITY ALERTS (account sharing detection)
-- ============================================================
CREATE TABLE public.security_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_security_alerts_created ON public.security_alerts(created_at DESC);

GRANT SELECT, UPDATE ON public.security_alerts TO authenticated;
GRANT ALL ON public.security_alerts TO service_role;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security alerts read staff"
  ON public.security_alerts FOR SELECT TO authenticated
  USING (public.is_support_staff(auth.uid()));

CREATE POLICY "security alerts update admin"
  ON public.security_alerts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 4) RATE LIMITING
-- ============================================================
CREATE TABLE public.rate_limit_hits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bucket text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rate_limit_bucket ON public.rate_limit_hits(bucket, created_at DESC);

GRANT ALL ON public.rate_limit_hits TO service_role;
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
-- no policies: only reachable via service_role / security-definer function

CREATE OR REPLACE FUNCTION public.check_rate_limit(_bucket text, _max integer, _window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cnt integer;
BEGIN
  -- occasional cleanup of stale rows
  DELETE FROM public.rate_limit_hits WHERE created_at < now() - interval '2 hours';

  SELECT count(*) INTO cnt FROM public.rate_limit_hits
   WHERE bucket = _bucket
     AND created_at > now() - make_interval(secs => _window_seconds);

  IF cnt >= _max THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limit_hits(bucket) VALUES (_bucket);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;