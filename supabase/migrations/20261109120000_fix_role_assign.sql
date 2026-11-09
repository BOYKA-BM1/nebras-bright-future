-- Ensure all roles exist on app_role enum + robust admin_set_user_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_secondary';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'psychologist';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer_service';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'secretary';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'montage';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'photographer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'parent';

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

  PERFORM 1 FROM public.user_roles WHERE user_id = _target FOR UPDATE;

  SELECT coalesce(array_agg(role::text), ARRAY[]::text[])
    INTO target_roles
  FROM public.user_roles
  WHERE user_id = _target;

  IF NOT actor_is_full THEN
    IF _new_role IN ('admin', 'admin_secondary') THEN
      RAISE EXCEPTION 'secondary_cannot_assign_admin';
    END IF;
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
