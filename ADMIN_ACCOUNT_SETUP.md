# حساب الأدمن — alkalkhedawy@gmail.com

## 1) إنشاء المستخدم (إن لم يكن موجودًا)

Supabase → **Authentication** → **Users** → **Add user**

| الحقل | القيمة |
|--------|--------|
| Email | `alkalkhedawy@gmail.com` |
| Password | كلمة قوية إن رفض النظام الضعيفة (مثل `EduMindly@2026`) أو عطّل Password strength مؤقتًا |
| Auto Confirm User | ✅ مفعّل |

> كلمة `123456789` قد تُرفض لو سياسة كلمات المرور مشدّدة. إمّا غيّرها أو خفّض الإعداد من Authentication → Providers → Email.

## 2) منح دور admin

SQL Editor → الصق محتوى الملف:

`supabase/MAKE_ADMIN_alkalkhedawy.sql`

ثم **Run**.

## 3) تسجيل الدخول

من الموقع: `/auth` بنفس البريد وكلمة المرور → المفروض يتحوّل تلقائيًا إلى `/admin`.

## العنوان في المنصة

العنوان المعروض في الفوتر وصفحة الدعم: **القاهرة، قنا**  
البريد: **edumindly@gmail.com**
