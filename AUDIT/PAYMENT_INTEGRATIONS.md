# Payment Integrations Status

| Method | Status | Notes |
|--------|--------|-------|
| InstaPay | **Manual verification workflow** | Configurable in admin; student submits reference + proof; admin approves via RPC |
| Vodafone Cash | **Manual verification workflow** | Same as above |
| Etisalat Cash | **Manual verification workflow** | Seeded + UI fallback |
| Fawry | **Manual verification workflow / awaiting merchant API** | Not live automated; do not claim Fawry API integration |

## Architecture
1. Student sees configured methods from `payment_methods` (+ UI fallback for all four).
2. Creates `payment_requests` with proof upload to private storage.
3. Admin reviews via `review_payment_request` (must remain server/DB authorized only).
4. Enrollment activated only after verified payment for paid courses.

## Required external activation
- Merchant account numbers in admin payment config
- Optional: official Fawry API credentials for automation later
