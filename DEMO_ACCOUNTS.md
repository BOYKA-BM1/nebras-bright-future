# حسابات تجريبية — Edu Mindly

**كلمة السر لكل الحسابات:** `12345678`

أنشئ المستخدمين من لوحة Supabase → Authentication → Add user، ثم أضف الدور في جدول `user_roles`.

| الدور (role) | الاسم | البريد |
|--------------|------|--------|
| student (account_type) | أحمد الطالب | student@edumindly.test |
| parent (account_type) | محمد ولي الأمر | parent@edumindly.test |
| teacher | أ. سارة المدرّسة | teacher@edumindly.test |
| admin | إدارة المنصة | admin@edumindly.test |
| admin_secondary | إدارة ثانوية | admin2@edumindly.test |
| customer_service | دعم فني | support@edumindly.test |
| secretary | سكرتير المنصة | secretary@edumindly.test |
| montage | مهندس مونتاج | montage@edumindly.test |
| photographer | مصوّر المنصة | photo@edumindly.test |
| psychologist | الأخصائي النفسي | psych@edumindly.test |

## SQL بعد إنشاء المستخدم (استبدل USER_UUID)

```sql
insert into public.user_roles (user_id, role) values
  ('USER_UUID_TEACHER', 'teacher'),
  ('USER_UUID_ADMIN', 'admin'),
  ('USER_UUID_ADMIN2', 'admin_secondary'),
  ('USER_UUID_SUPPORT', 'customer_service'),
  ('USER_UUID_SECRETARY', 'secretary'),
  ('USER_UUID_MONTAGE', 'montage'),
  ('USER_UUID_PHOTO', 'photographer'),
  ('USER_UUID_PSYCH', 'psychologist');
```

للطالب وولي الأمر: سجّل الدخول واختر النوع من شاشة `/account-type` داخل التطبيق.
