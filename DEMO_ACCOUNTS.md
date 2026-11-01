# حسابات تجريبية — Edu Mindly

> أنشئ المستخدم من Supabase → Authentication → Users (Auto Confirm ON)
> ثم شغّل SQL منح الدور من مجلد `supabase/`.

| الدور | البريد | كلمة المرور المقترحة | بعد الدخول |
|--------|--------|----------------------|------------|
| طالب | student@edumindly.test | EduMindly@2026 | `/dashboard` |
| مدرّس | teacher@edumindly.test | EduMindly@2026 | `/teacher` |
| أدمن | alkalkhedawy@gmail.com | (اللي أنت محددها) | `/admin` |

## منح دور مدرّس

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'teacher'
FROM auth.users
WHERE lower(email) = lower('teacher@edumindly.test')
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.users.id AND ur.role = 'teacher'
);
```

ملاحظة: كلمات ضعيفة زي `12345678` قد تُرفض من سياسة Supabase.
