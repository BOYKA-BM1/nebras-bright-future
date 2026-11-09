# Master Security Pass 2 — Results

## Fixed
1. Content-protection events no longer accept client-chosen confidence / confirmed_native (server function + SQL RPC).
2. Direct INSERT policy for students removed; insert via service role server fn only.
3. Secondary admin blocked from ban/unban/delete/reset device (requireFullAdmin).
4. Email for ban/delete resolved server-side from userId (not client email).
5. Last full admin protected from demotion/delete/ban.
6. Permission matrix: secondary cannot managePaymentConfig.
7. PaymentDialog: no active fallback methods; only DB active+configured methods.
8. Admin security CPE panel: student name, course title, filters, pagination, browser-signal labeling.

## Migrations (NOT applied to production by this agent)
- `20261108140000_secure_content_protection_events.sql`

## Tests
- `node src/lib/__tests__/permissions.security.test.mjs` — pure matrix checks.
- Live RLS / staging DB: NOT RUN (no credentials).

## Readiness
**READY FOR STAGING** only after applying migrations and running staging probes.
**NOT READY** for production.
