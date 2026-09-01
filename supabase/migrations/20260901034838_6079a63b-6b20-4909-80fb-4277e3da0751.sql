-- 1) امنع قراءة عمود الإجابة الصحيحة من العميل تمامًا (أمان على مستوى الأعمدة)
REVOKE SELECT ON public.questions FROM authenticated;
REVOKE SELECT ON public.questions FROM anon;
GRANT SELECT (id, quiz_id, course_id, text, type, options, points, sort_order, created_at, updated_at)
  ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;

-- 2) اعتماد البريد المالك كأدمن كامل الصلاحيات
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE lower(u.email) = 'alkalkhedawy@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;