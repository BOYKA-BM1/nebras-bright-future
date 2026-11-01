-- حساب مدرّس تجريبي
-- 1) أنشئ المستخدم من Authentication → Users أولاً
--    email: teacher@edumindly.test
--    password: EduMindly@2026
--    Auto Confirm: ON
-- 2) شغّل هذا الـ SQL:

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'teacher'
FROM auth.users
WHERE lower(email) = lower('teacher@edumindly.test')
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.users.id AND ur.role = 'teacher'
);

-- تحقق:
SELECT u.email, ur.role
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE lower(u.email) = lower('teacher@edumindly.test');
