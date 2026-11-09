# Edu Mindly — Baseline Audit

**Date:** 2026-11-08  
**Source archive:** nebras-bright-future-main-4.zip  
**Stack (confirmed):** TanStack Start + React 19 + TypeScript + Tailwind v4 + Supabase + HLS.js + Recharts

## Confirmed strengths
- Role home routing (`role-home.ts`) for admin, teacher, staff, parent, psych
- Server functions for admin accounts, payments review migration present
- ProtectedVideo with watermark + page-level content protection
- AI tutor with rate limits (server-side LOVABLE_API_KEY)
- Arabic RTL layout and existing design system

## Confirmed problems / risks
1. **Secondary admin privilege:** `setUserRole` previously allowed secondary admins to assign `admin` — **fixed in this pass**
2. **PII leakage:** `listAccounts` returned full emails to secondary admins — **masked server-side in this pass**
3. **Payment providers:** Manual verification workflow only; no live Fawry/wallet merchant APIs (awaiting credentials)
4. **Screenshot protection:** Browser-only signals; not native Android FLAG_SECURE (no Android app in repo)
5. **Secure enrollment migration:** File exists (`20261023120000_secure_enrollment_payment.sql`) — **application to live DB not verified in this environment**
6. **No automated test suite scripts** in package.json (`test` script missing)
7. **Build/typecheck:** Not executed in this sandbox due to resource/network constraints historically
8. **Dependencies:** Requires LOVABLE_API_KEY, SUPABASE_SERVICE_ROLE_KEY server-side; VITE_ publishable keys client-side

## Incomplete integrations
- Automated InstaPay / Vodafone / Etisalat / Fawry merchant APIs
- Native mobile screenshot blocking
- MFA for admins
- Full E2E suite

## Tests that cannot run here
- Live Supabase RLS probes (no staging credentials in agent environment)
- Production build with native optional deps on constrained CPUs
- Real payment provider callbacks

## Honest status after this pass
**STAGING-ORIENTED IMPROVEMENTS APPLIED — NOT PRODUCTION READY until migrations applied, tests pass on staging, and merchant credentials configured.**
