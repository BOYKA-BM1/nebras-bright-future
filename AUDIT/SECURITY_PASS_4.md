# Security Remediation Pass 4

## Fixed
1. Audit logs IP: server function `listAuditLogs` masks IP for secondary before response.
2. Payment requests: `createManualPaymentRequest` computes amount server-side; client amount ignored.
3. CPE rate limit inside Postgres RPC `report_content_protection_event` (atomic with check_rate_limit).
4. Role changes via atomic RPC `admin_set_user_role` with last-full-admin protection.

## Migration (manual apply on Staging)
`supabase/migrations/20261108150000_pass4_atomic_roles_cpe_ratelimit_payments.sql`

## Tests run
- node src/lib/__tests__/mask.production.test.mjs → Passed
- node src/lib/__tests__/permissions.security.test.mjs → Passed
- Build/tsc/lint/live RLS → Not Run

## Readiness
READY FOR STAGING after applying Pass 2+4 migrations and smoke-testing payments/roles.
NOT READY for production without live RLS verification.
