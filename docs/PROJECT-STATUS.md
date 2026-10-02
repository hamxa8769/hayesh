# Hayesh — Project Status

**Last updated:** 2 October 2026 · **Branch:** `claude/inspiring-meitner-wr64ay` · **PR:** hamxa8769/hayesh#1

> **Khulasa (Urdu):** Website ka core kaam mukammal hai. Teen layers (tutoring,
> marketplace, AI Studio) mein paise lene, order chalane aur payout dene ka poora
> flow ban gaya hai aur har flow asli browser mein asli database ke saath test ho
> chuka hai. Live karne se pehle aap ko sirf settings karni hain (section 4).
> Jo cheezein baqi hain woh section 5 mein hain — zyada tar ke liye kisi bahar
> ke account/keys ki zaroorat hai.

---

## 1. Summary

| | |
|---|---|
| Overall readiness | **Ready to launch on the manual payment rail** (bank / Raast / JazzCash / Easypaisa with admin verification) |
| Automated tests | **24 end-to-end** browser tests (all passing) + **9 unit tests** |
| Database | Schema + **24 migrations**, every one verified on real Postgres and re-runnable |
| Security | Two independent security reviews; all high/medium findings fixed |
| What you must do | Run migrations, set env vars, fill payment accounts (section 4) |

---

## 2. What is complete

### 2.1 Platform & accounts
- Sign-up / login for 5 roles (admin, teacher, parent, seller, buyer); admins can never self-assign.
- Login returns users to where they were (e.g. checkout); open-redirect safe.
- Teacher onboarding wizard → admin approval → listed publicly.
- Seller profile + gig creation wizard → **admin gig approval** → listed on marketplace.
- Maintenance mode (admin toggle; admins keep access).
- Admin **System status** panel: shows which server settings are missing (e.g. `FIELD_ENCRYPTION_KEY`) before customers hit an error.

### 2.2 Money (all three layers)
| Flow | Status |
|---|---|
| Checkout page with reference code, payee accounts, proof upload | ✅ |
| Admin payment verification (confirm / reject with reason) | ✅ |
| Stripe card payments (auto-enabled when keys are set; amount-verified webhook) | ✅ (needs keys) |
| Monthly tuition: enrol → pay → active → renewal charge 3 days before period end → past-due | ✅ |
| Gig orders: pay → deliver → revision → accept / dispute; **escrow** until acceptance (auto-accept after N days) | ✅ |
| AI Studio: pay → generated automatically → revisions; 6 launch services seeded | ✅ |
| Registration fee (teacher/seller) | ✅ |
| Featured listings (7 / 30 days), ranked first, auto-expire | ✅ |
| Refunds (admin), dispute resolution (release / refund) | ✅ |
| Withdrawals: saved, **encrypted** payout accounts → request (balance-guarded) → admin approve; CSV export | ✅ |
| Receipts (printable) | ✅ |
| International buyers pay in USD when a USD price exists | ✅ |

### 2.3 Learning & communication
- Demo lesson booking → teacher confirms → parent sees status.
- Children, teacher requests → admin assigns teacher.
- Assignments, notes, announcements, progress, **monthly report card**.
- Reviews only from parents with a completed demo or enrolment; ratings auto-calculated.
- **Messaging** (realtime): order threads, tuition threads, Hayesh Support.
- Meetings (LiveKit): host, invite, waiting room, moderation, chat bubbles, emoji, request-to-present, in-call invites, file attachments.
- Support tickets (teacher ↔ admin).
- Email notifications for every money/order event (Resend).
- JARVIS assistant answering from the user's real data (read-only, role-scoped).

### 2.4 Website & UX
- Landing page with trust/escrow section; modern gig & teacher cards everywhere.
- **Navigation fixed:** Meetings, Messages, My Orders and Checkout open inside the user's dashboard; marketplace/teacher/AI pages have site header + footer; detail pages have a working Back button; "Explore" in every sidebar.
- Terms, Privacy, Refund policy, Contact pages.
- SEO: metadata, sitemap, robots; custom 404 / error pages; mobile-friendly; dark + light themes.

### 2.5 Engineering
- GitHub Actions CI: type-check, unit tests, build, Playwright E2E against local Supabase.
- `/api/health` uptime endpoint; structured server error logs.
- Security headers, rate limits, image-only uploads, bank details encrypted at rest.

---

## 3. Bugs found and fixed during this work

| Bug | Impact before fix |
|---|---|
| Buy buttons (Order Now, Place Order, Subscribe) did nothing | No revenue possible |
| AI output obtainable without paying | Free AI usage |
| Self-asserted admin role possible on signup fallback | Privilege escalation |
| Seller gigs/orders pages always empty (wrong id) | Sellers couldn't see their work |
| `gig_orders` had no read policies | Order pages empty |
| Gig creation failed ("permission denied") | No seller could publish a gig |
| Gig wizard published on "Next" at step 3 | Gigs published without review step |
| Teacher onboarding failed ("permission denied") | No new teacher could finish onboarding |
| No admin UI to approve gigs | New gigs could never go live |
| Sellers had no withdrawal screen | Sellers couldn't get paid |
| Saved withdrawal account ignored at withdrawal time | Users had to retype details |
| Raw "FIELD_ENCRYPTION_KEY is not set" shown to users | Unprofessional error |
| Parents buying gigs bounced off `/buyer/orders` | Orders invisible |
| Login ignored `?redirect=` | Purchase context lost |
| Pages with no navigation; sections leaving the dashboard | Dead ends |
| Other users' checkout page returned 200 | Information exposure (fixed to 404) |
| AI "file" field sent only the filename | Useless AI output |
| Reviews could be moved to another teacher | Rating manipulation |
| Migration 020 failed on an existing `conversations` table | Migration error on live DB |

---

## 4. What YOU must do before going public

1. **Supabase → SQL Editor:** run `supabase-migrations/016` → `024` in order (020 updated — use the latest file).
2. **Vercel → Settings → Environment Variables**, then redeploy:
   - Required: `NEXT_PUBLIC_APP_URL`, `FIELD_ENCRYPTION_KEY` (`openssl rand -base64 32`, never change it later), `CRON_SECRET`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
   - Recommended: `RESEND_API_KEY` + `EMAIL_FROM`, `NEXT_PUBLIC_SUPPORT_EMAIL` / `NEXT_PUBLIC_SUPPORT_WHATSAPP`, LiveKit keys.
   - After deploy, **Admin → Overview → System status** must show no "Missing".
3. **Admin → Settings:** bank / JazzCash / Easypaisa payee accounts, commissions, fees, featured prices.
4. **Supabase Auth:** Site URL = your domain; add `/auth/callback` redirect; custom SMTP.
5. Have a lawyer review Terms / Privacy / Refund policy.
6. Merge PR #1, then run the 15-minute live smoke test in `docs/PRODUCTION.md` §3.7 and one real video call.

---

## 5. What is still remaining

| Item | Why it isn't done | What's needed |
|---|---|---|
| Simpaisa automatic JazzCash/Easypaisa confirmation | Needs a Simpaisa merchant account + API docs | Account + docs → ~1 session |
| Live voice translation (Deepgram → Claude → ElevenLabs) | Needs paid API keys + a LiveKit agent worker | Keys + LiveKit agent → 3–4 sessions |
| Parent Premium plan | Its listed benefits are already free — needs a product decision on what premium unlocks | Decision → ~1 session |
| Real-call verification of new meeting features | No LiveKit server in the test environment | One manual test call |
| Sentry error tracking | Needs a Sentry account (structured logs + `/api/health` exist today) | DSN → small change |
| Distributed rate limiting | In-memory limits are per server instance | Upstash Redis when traffic grows |
| Onboarding documents upload error only shown softly | Minor UX | Small follow-up |

---

## 6. How to verify everything yourself

```bash
npm ci
npm run typecheck && npm run test:unit && npm run build
# end-to-end (needs Docker): see tests/e2e/README.md
npx supabase start          # in a scratch folder
npm run db:local:reset
npm run test:e2e
```

Related docs: `docs/PRODUCTION.md` (go-live runbook), `docs/ROADMAP.md` (future phases), `tests/e2e/README.md`.
