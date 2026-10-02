# Hayesh — Production Runbook & Status

This is the operator's guide for running Hayesh on the live domain: what is
built, how money moves, the exact go-live steps, and what is still left.

---

## 1. Where the project stands

| Area | Status | Notes |
|---|---|---|
| Auth + 5 roles + route protection | ✅ Live | Supabase Auth, middleware role gates. Admin can never be self-assigned at signup. |
| Teacher profiles, onboarding wizard, discovery, demo booking, reviews | ✅ Live | Admin approval + endorsements. |
| Parent portal (students, requests, progress, homework) | ✅ Live | |
| Teacher tools (sessions, assignments, notes, announcements, earnings, withdrawals) | ✅ Live | Withdrawals are guarded by a DB balance trigger (migration 007). |
| Seller gigs (wizard, listing, public pages) | ✅ Live | |
| Meetings / video (LiveKit) | ✅ Live | Recording inert until Egress storage is configured. |
| Admin (users, teachers, sellers, branding, AI builder, settings, support) | ✅ Live | |
| **Checkout + payments** | ✅ **New** | Manual rail (bank / JazzCash / Easypaisa + proof + admin verification) always on; Stripe cards auto-enable when keys are set. |
| **Gig order lifecycle** (pay → deliver → revise → accept / dispute) | ✅ **New** | Escrow: seller money is released only on acceptance (or auto after N days). |
| **AI service orders** | ✅ **New** | Paid orders fulfil automatically via Claude; buyers can retry. Unpaid orders can never be fulfilled. |
| **Monthly tuition** (enrol → pay → active → renewal) | ✅ **New** | Daily cron issues renewal charges 3 days before period end and marks lapsed plans `past_due`. |
| **Registration fees** (teachers / sellers) | ✅ **New** | Card on teacher & seller dashboards. |
| **Disputes** | ✅ **New** | Admin release-to-seller or refund-buyer. |
| JARVIS assistant | 🟡 Basic | Chat works; no function calling into the DB yet. |
| Buyer ↔ seller messaging | 🔴 Not built | `/buyer/messages` is a placeholder. |
| Voice translation (Deepgram → Claude → ElevenLabs) | 🔴 Not built | Admin toggle exists, pipeline does not. |
| Simpaisa API (automatic JazzCash/Easypaisa) | 🔴 Not built | Needs a Simpaisa merchant account + API docs. Until then, the manual rail covers the same methods. |
| Automated tests / CI | 🔴 Not built | Build + lint is the only gate today. |

---

## 2. How money moves (transactions.status)

```
checkout ──► pending ──(proof uploaded)──► pending + proof ──(admin confirms)──┐
                │                                                              │
                └──(Stripe webhook: paid)──────────────────────────────────────┤
                                                                               ▼
               gig order ─► processing (escrow) ─(buyer accepts / auto N days)─► completed
               tuition / AI / registration ───────────────────────────────────► completed
               admin rejects ─► failed      dispute refund ─► refunded
```

* `completed` money with a `payee_id` is the teacher/seller's withdrawable
  balance (net of commission). Withdrawals stay admin-approved.
* AI services and registration fees have no payee — 100% platform revenue.
* Commission % and registration fees come from **Admin → Settings**.
* Every state change is a conditional update, so double clicks and duplicate
  webhooks are safe.

---

## 3. Go-live checklist (do these in order)

### 3.1 Database (Supabase SQL Editor)
Run, in order, any migrations not yet applied — **019 is new**:

```
supabase-migrations/016-meeting-invitations.sql
supabase-migrations/017-fix-meeting-invitations-recursion.sql
supabase-migrations/018-meeting-waiting-room.sql
supabase-migrations/019-commerce-checkout.sql      ← required for checkout
```

All migrations are idempotent (safe to re-run).

### 3.2 Vercel environment variables (Production)
Required:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase project |
| `NEXT_PUBLIC_APP_URL` | `https://<your-domain>` (no trailing slash) |
| `FIELD_ENCRYPTION_KEY` | `openssl rand -base64 32` — **never change after launch** (encrypts bank details) |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | AI Studio fulfilment |
| `OPENROUTER_API_KEY` | JARVIS |
| `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Meetings |

Optional: `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (cards),
`LIVEKIT_EGRESS_S3_*` (recordings).

### 3.3 Supabase Auth settings
* Authentication → URL Configuration → **Site URL** = `https://<your-domain>`,
  add `https://<your-domain>/auth/callback` to Redirect URLs.
* Enable email confirmation; set up a custom SMTP sender (Resend/Postmark)
  so signup emails don't come from the shared Supabase sender.

### 3.4 Payment accounts
Admin → Settings → **Payment accounts**: fill bank name, account title,
account number, IBAN, JazzCash and Easypaisa numbers. Checkout shows only
the filled ones. Until at least one is filled, customers see "being set up".

### 3.5 Stripe (optional, international cards)
1. Stripe Dashboard → Developers → Webhooks → add endpoint
   `https://<your-domain>/api/webhooks/stripe`, events
   `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
2. Put the secret key + signing secret in Vercel, redeploy. The "Card" tab
   appears on checkout automatically.

### 3.6 Cron
`vercel.json` schedules `/api/cron/commerce` daily at 04:00 UTC. Confirm it
appears under Vercel → Settings → Cron Jobs after deploy.

### 3.7 Smoke test on the live domain (15 minutes)
1. Admin: fill payment accounts; set commission + fees.
2. Parent: book a demo → enrol in a teacher plan → checkout → upload a proof.
3. Admin → Payments: confirm → parent sees "Tuition active", teacher gets a notification + earning.
4. Buyer: order a gig → pay → admin confirms → seller delivers → buyer accepts → seller earnings become withdrawable.
5. Buyer: order an AI Studio service → pay → confirm → output appears in My Orders.
6. Teacher: pay registration fee from the dashboard → admin confirms.

---

## 4. Business notes

* **Launch on the manual rail.** Pakistani customers already pay by bank,
  Raast/IBFT, JazzCash and Easypaisa; verifying screenshots is acceptable at
  launch volume. Move to Simpaisa (automatic confirmation) once daily
  verification volume becomes a burden — the checkout already records the
  method, so only the settlement trigger changes.
* **Escrow is the trust feature.** Say it on the landing page: "You pay
  Hayesh, the tutor/seller is paid after delivery."
* **Free demo → paid monthly** is the core funnel; the Enrol button sits next
  to Book Demo on every teacher profile.
* AI Studio has the best margin; seed 4–6 services with clear outcomes
  (CV rewrite, homework explainer, essay feedback, lesson-plan generator).

---

## 5. Remaining roadmap (recommended order)

1. Buyer ↔ seller / parent ↔ teacher messaging (table `messages` exists).
2. Transactional email (payment confirmed, order delivered) via Resend —
   in-app notifications already fire for every event.
3. Simpaisa integration for automatic local payments.
4. JARVIS function calling (read-only queries per role first).
5. Error monitoring (Sentry) + uptime check on `/`.
6. Playwright smoke tests for the checkout flows above, run in CI.
7. Voice translation pipeline.
