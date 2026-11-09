# Master Security Pass 3

## Admin matrix
| Capability | Full Admin | Secondary |
|------------|------------|-----------|
| Manage non-admin users | Yes | Yes |
| Ban / unban / delete non-admin | Yes | Yes |
| Reset devices (non-admin targets) | Yes | Yes |
| Review/approve/reject payments | Yes | Yes |
| Payment method config | Yes | Yes |
| Security events | Yes | Yes |
| Assign admin / admin_secondary | Yes | **No** |
| Modify admin accounts | Yes | **No** |
| Full email | Yes | **No (masked server-side)** |
| Full IP | Yes | **No (last segment only)** |

## Privacy examples
- Email: mohamed@gmail.com → m****ed@gmail.com (secondary)
- IP: 192.168.1.125 → ***.***.*.125 (secondary)

## Payments
Manual review workflow only. Student cannot self-approve. Secondary may approve.

## Migrations
None new beyond Pass 2 CPE migration. Apply Pass 2 migration if not applied.

## Tests run
`node src/lib/__tests__/permissions.security.test.mjs` — Passed

## Readiness
READY FOR STAGING after DB migration apply + manual role matrix QA.
NOT READY for production without RLS live verification.
