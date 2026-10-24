# Edu Mindly — رفع على Lovable

## قبل الرفع
1. لا ترفع ملف `.env` وفيه مفاتيح حقيقية إلى مستودع عام.
2. اربط مشروع Supabase من داخل Lovable (Connect Supabase).
3. تأكد أن Project URL + anon key صحيحان (ليس xxxxxxxx).

## متغيرات البيئة المطلوبة (أسماء فقط)
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_URL
- SUPABASE_PUBLISHABLE_KEY
- SUPABASE_PROJECT_ID
- (اختياري للسيرفر) SUPABASE_SERVICE_ROLE_KEY — لا تضعها في الواجهة

## تشغيل محلي
```bash
npm install --ignore-scripts
npm run dev
```
إذا فشل بناء `inotify`: استخدم `--ignore-scripts` كما فوق.

## بعد الربط مع Supabase
1. Authentication → Users → أنشئ مستخدمين تجريبيين (انظر DEMO_ACCOUNTS.md).
2. طبّق migrations من مجلد `supabase/migrations` على Staging أولًا.
3. خصوصًا: `20261023120000_secure_enrollment_payment.sql` قبل الإنتاج.

## حسابات تجريبية (كلمة السر: 12345678)
انظر DEMO_ACCOUNTS.md — يجب إنشاؤها يدويًا في Supabase Auth.

## ملاحظات معروفة
- صفحة الدخول تتحمّل حتى لو OAuth غير مضبوط؛ البريد/كلمة المرور هما المسار الأساسي.
- لا تستخدم service_role في كود الواجهة.
- تأكد من عدم وجود `xxxxxxxx.supabase.co` في الإعدادات.
