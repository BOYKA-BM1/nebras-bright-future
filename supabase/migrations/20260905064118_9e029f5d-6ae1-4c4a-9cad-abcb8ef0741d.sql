CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  IF NEW.raw_user_meta_data->>'account_type' = 'parent' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'parent')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_child_by_code(_code text)
RETURNS public.parent_children
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _parent_uid uuid := auth.uid();
  _student_id uuid;
  _row public.parent_children;
BEGIN
  IF _parent_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT id INTO _student_id FROM public.profiles WHERE child_link_code = upper(trim(_code));
  IF _student_id IS NULL THEN RAISE EXCEPTION 'كود غير صحيح'; END IF;
  IF _student_id = _parent_uid THEN RAISE EXCEPTION 'لا يمكن ربط حسابك بنفسه'; END IF;

  INSERT INTO public.parent_children (parent_user_id, student_user_id, status)
  VALUES (_parent_uid, _student_id, 'active')
  ON CONFLICT (parent_user_id, student_user_id) DO UPDATE SET status = 'active'
  RETURNING * INTO _row;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_parent_uid, 'parent')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _row;
END;
$$;

CREATE POLICY "notifications read children" ON public.notifications
FOR SELECT TO authenticated
USING (public.is_parent_of(auth.uid(), user_id));