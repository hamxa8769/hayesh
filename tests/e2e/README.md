# End-to-end tests

Real browser tests (Playwright) for every money flow — tuition, gig orders
with escrow, AI Studio, registration fees, admin verification/rejection,
messaging, cron and maintenance mode — run against a **local** Supabase
stack. They refuse to run against a hosted project.

```bash
# one-time: Docker + Supabase CLI
npx supabase start            # in any scratch folder with `npx supabase init`

# apply the schema + migrations to the local DB
npm run db:local:reset

# run (builds the app, starts a mock Anthropic API on :4010)
npm run test:e2e
```

AI fulfilment hits `tests/e2e/mock-anthropic.mjs` via `ANTHROPIC_BASE_URL`,
so no real key is needed. Reports land in `playwright-report/`.
