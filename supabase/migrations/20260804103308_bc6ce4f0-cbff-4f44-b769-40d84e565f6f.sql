CREATE OR REPLACE FUNCTION public.admin_teachers()
RETURNS SETOF teachers
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT t.id, t.name, t.subject, t.bio, t.experience_years, t.image_url, t.rating,
         t.students_label, t.sort_order, t.created_at, t.updated_at, t.user_id,
         CASE WHEN public.has_role(auth.uid(), 'admin'::app_role) THEN t.profit_percentage ELSE 0 END,
         t.stage, t.grade
  FROM public.teachers t
  WHERE public.is_any_admin(auth.uid())
  ORDER BY t.sort_order;
$function$;