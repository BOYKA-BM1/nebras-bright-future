# Deployment Guide

## 1. Environment variables (names only)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `LOVABLE_API_KEY` (server only)

## 2. Database
1. Backup staging/production
2. Apply pending migrations including:
   - `20261023120000_secure_enrollment_payment.sql` (if not applied)
   - `20261108120000_content_protection_and_payments.sql`
3. Run `supabase/security_probes_staging.sql` on **staging only**

## 3. Host
- Vercel or Lovable linked to GitHub `main`
- Set env vars; redeploy
- Supabase Auth redirect URLs must include production domain

## 4. Smoke test
- Login each role
- Submit payment request + admin approve
- Open protected lesson; verify watermark
- Secondary admin: emails masked; cannot assign admin
