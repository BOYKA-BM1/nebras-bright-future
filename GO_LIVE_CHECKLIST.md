# قائمة الإغلاق قبل الإطلاق

## أمان
- [ ] تطبيق `supabase/migrations/20261023120000_secure_enrollment_payment.sql` على المشروع
- [ ] عدم كشف `SUPABASE_SERVICE_ROLE_KEY` في الواجهة أو Git عام
- [ ] RLS مفعّل على الجداول الحساسة (profiles, payments, enrollments, user_roles)

## حسابات
- [ ] أدمن في `user_roles`
- [ ] مدرّس تجريبي مربوط بصف `teachers` + دورات
- [ ] طالب onboarded

## وظائف
- [ ] تسجيل دخول بريد/كلمة مرور
- [ ] توجيه حسب الدور (طالب/مدرّس/أدمن)
- [ ] طلب دفع + موافقة أدمن
- [ ] رفع درس من لوحة المدرّس وظهوره للطالب

## نشر
- [ ] متغيرات البيئة على Vercel أو Lovable
- [ ] Site URL + Redirect URLs في Supabase Auth
