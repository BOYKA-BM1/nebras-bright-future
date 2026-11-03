# نشر Edu Mindly على Vercel

## 1) المتغيرات (Project → Settings → Environment Variables)

أضف لكل من Production / Preview / Development:

| الاسم | القيمة |
|--------|--------|
| `VITE_SUPABASE_URL` | `https://ueufuvebiwzfohybcgog.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | مفتاح publishable من Lovable/Supabase |
| `VITE_SUPABASE_PROJECT_ID` | `ueufuvebiwzfohybcgog` |
| `SUPABASE_URL` | نفس رابط المشروع |
| `SUPABASE_PUBLISHABLE_KEY` | نفس مفتاح publishable |
| `SUPABASE_PROJECT_ID` | `ueufuvebiwzfohybcgog` |
| `SUPABASE_SERVICE_ROLE_KEY` | من Supabase API (server فقط — سري) |

## 2) Supabase Auth URLs

Authentication → URL Configuration:

- **Site URL:** `https://YOUR-APP.vercel.app`
- **Redirect URLs:**
  - `https://YOUR-APP.vercel.app/**`
  - `https://YOUR-APP.vercel.app/auth`
  - `http://localhost:8080/**` (للتطوير)

## 3) النشر

```bash
npm i -g vercel
vercel login
cd edu-mindly
vercel
```

أو اربط المستودع من لوحة Vercel → New Project → Import.

## 4) بعد النشر

1. سجّل دخول طالب/مدرّس/أدمن
2. تأكد أن `/teacher` و `/admin` يفتحان حسب الدور
3. طبّق migrations الناقصة من `supabase/migrations` إن لم تُطبَّق

## ملاحظة Nitro / SSR

المشروع مبني بـ TanStack Start + إعداد Lovable (افتراضي Cloudflare).  
لو فشل الـ build على Vercel بسبب الـ preset، إمّا:

- انشر من **Lovable** (الأضمن لهذا القالب)، أو
- عدّل إعداد Nitro إلى preset `vercel` حسب وثائق `@lovable.dev/vite-tanstack-config`.
