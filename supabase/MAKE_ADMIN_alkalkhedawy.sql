-- ============================================================
-- منح صلاحية أدمن كامل لـ: alkalkhedawy@gmail.com
-- شغّل هذا الملف من: Supabase Dashboard → SQL Editor → Run
-- بعد إنشاء المستخدم في Authentication → Users
-- ============================================================

-- 1) ربط دور admin بمعرّف المستخدم من auth.users
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::text
FROM auth.users
WHERE lower(email) = lower('alkalkhedawy@gmail.com')
ON CONFLICT DO NOTHING;

-- لو الجدول فيه unique على (user_id, role) بالطريقة دي:
-- لو فشل ON CONFLICT، جرّب البديل:
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT id, 'admin' FROM auth.users WHERE lower(email) = lower('alkalkhedawy@gmail.com')
-- AND NOT EXISTS (
--   SELECT 1 FROM public.user_roles ur
--   WHERE ur.user_id = auth.users.id AND ur.role = 'admin'
-- );

-- 2) تأكيد النتيجة
SELECT u.email, ur.role, ur.user_id
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE lower(u.email) = lower('alkalkhedawy@gmail.com');
