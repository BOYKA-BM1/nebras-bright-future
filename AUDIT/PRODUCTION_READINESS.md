# Production Readiness Decision

## Decision: **NOT READY** (Staging-oriented progress only)

### Why not production ready
1. Migrations for content protection / payment seeds not confirmed applied on live DB
2. Secure enrollment migration application status unconfirmed
3. No passing automated test gate in this environment
4. Payment methods are manual-verification, not fully automated merchant integrations
5. Browser content protection is partial by nature

### Before production
- [ ] Apply migrations on staging and run `security_probes_staging.sql`
- [ ] Verify review_payment_request cannot be called by students
- [ ] Configure real payment account numbers
- [ ] Build + typecheck + lint green
- [ ] Manual role matrix walkthrough
- [ ] Backups + restore drill
- [ ] Domain, HTTPS, env vars on host (Vercel/Lovable)
