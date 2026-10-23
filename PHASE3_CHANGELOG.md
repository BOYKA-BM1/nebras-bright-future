# Phase 3 — Student Experience

**Date:** 2026-10-23

## Checkpoint
- Manual backup: /home/workdir/artifacts/edu-mindly-backup-phase3/
  (dashboard, courses.index, courses.$courseId, learn.$courseId, styles, Navbar)

## Dependency install diagnosis
- Environment: ~1.2 GiB RAM, no swap — primary cause of slow/partial npm installs.
- Network: registry.npmjs.org reachable (HTTP 200).
- No lockfile in archive; package.json uses npm scripts; bunfig.toml present but bun not required.
- Retry with --maxsockets=2; install still running after several minutes but react/typescript packages appeared under node_modules.
- Typecheck/lint/build: blocked or incomplete — tsc binary not available yet under node_modules/.bin.

## Files modified
- src/routes/_authenticated/dashboard.tsx
- src/components/site/Courses.tsx
- src/routes/courses.index.tsx
- src/routes/courses.$courseId.tsx
- src/routes/_authenticated/learn.$courseId.tsx

## Preserved
- All routes, role redirects, enrollment/payment/video/progress hooks
- Supabase queries and RLS assumptions
- ProtectedVideo, signed URL flows, watch event RPCs

## Security note (documented, not changed)
- useEnroll() inserts payments with status "paid" and provider "manual" on client path.
  Flagged for later security review; not altered in Phase 3 to avoid breaking enrollment UX without a clear payment-provider flow.

## Next
Phase 4 only on explicit authorization.
