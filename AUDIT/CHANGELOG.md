# Changelog — Master directive pass 2026-11-08

## Security
- Secondary admin cannot assign admin / admin_secondary roles
- Secondary admin cannot modify full-admin accounts
- listAccounts masks email (and phone) for secondary admin server-side

## Content protection
- Migration `20261108120000_content_protection_and_payments.sql`
- Hook reports throttled browser signals to `content_protection_events`
- Admin Security page: Content Protection events panel

## Payments
- UI ensures InstaPay, Vodafone Cash, Etisalat Cash, Fawry always available as methods
- SQL seed for payment_methods (4 Egyptian methods)

## Platform
- Central `src/lib/permissions.ts` matrix helper
- AUDIT documentation suite
