CREATE OR REPLACE FUNCTION public.course_stats()
RETURNS TABLE(
  course_id uuid,
  lessons bigint,
  videos bigint,
  hours integer,
  live_sessions bigint,
  students bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    (SELECT count(*) FROM public.lessons l WHERE l.course_id = c.id),
    (SELECT count(*) FROM public.lessons l
       WHERE l.course_id = c.id
         AND (l.video_url IS NOT NULL OR l.video_id IS NOT NULL)),
    COALESCE((SELECT CEIL(SUM(l.duration_minutes)::numeric / 60)::integer
       FROM public.lessons l WHERE l.course_id = c.id), 0),
    (SELECT count(*) FROM public.live_sessions ls WHERE ls.course_id = c.id),
    (SELECT count(DISTINCT e.user_id) FROM public.enrollments e
       WHERE e.course_id = c.id AND e.status = 'active')
  FROM public.courses c;
$$;

GRANT EXECUTE ON FUNCTION public.course_stats() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.teacher_stats()
RETURNS TABLE(teacher_id uuid, students bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    (SELECT count(DISTINCT e.user_id)
       FROM public.enrollments e
       JOIN public.courses c ON c.id = e.course_id
      WHERE c.teacher_id = t.id AND e.status = 'active')
  FROM public.teachers t;
$$;

GRANT EXECUTE ON FUNCTION public.teacher_stats() TO anon, authenticated, service_role;