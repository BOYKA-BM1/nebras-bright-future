# Security Audit

## Fixed this pass
| Issue | Severity | Fix | Verification |
|-------|----------|-----|--------------|
| Secondary admin can assign full admin | High | `setUserRole` requires full admin for admin roles; cannot modify full-admin targets | Code review of `admin-accounts.functions.ts` |
| Full emails to secondary admin | High | Server masks email/phone when `full=false` | Code review `listAccounts` |
| Content capture unlogged | Medium | `content_protection_events` + reporting from protection hook | Migration + hook + admin panel |
| Client-trusted payment approval | High (prior) | Existing `review_payment_request` migration — must be applied on DB | Migration file present; **DB apply not verified** |

## Remaining
- Apply all security migrations on staging with probes
- Storage bucket policies review on live project
- MFA for admin accounts
- Rate-limit fail-closed verification under outage
- Native Android FLAG_SECURE (no Android project in repo)

## Secrets
- Never ship `SUPABASE_SERVICE_ROLE_KEY` or `LOVABLE_API_KEY` to client
- `.env` must stay gitignored
