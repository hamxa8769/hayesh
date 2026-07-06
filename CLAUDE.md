# 🌟 HAYESH — Claude Code Master Instructions
> Read this file completely before every session. Never skip it.

---

## 🏗️ What is Hayesh?

Hayesh is a three-layer tutoring-first marketplace platform:

**Layer 1 — Teacher Profiles** (core product)
- Teachers fill structured profiles (NOT gigs)
- Parents subscribe monthly UPFRONT after a free demo lesson
- Admin approves all teachers + controls translation privileges
- Admin sets registration fees per teacher

**Layer 2 — Human Seller Marketplace** (Fiverr-style)
- Separate from teachers — any user can register as a seller
- Sellers create gigs with Basic / Standard / Premium packages
- One-time Stripe or Simpaisa payments (NOT subscriptions)
- Categories: design, video, writing, programming, marketing etc.

**Layer 3 — AI Agent Services** (admin-deployed, highest margin)
- Admin creates service listings backed by Claude API agents
- No human seller — AI fulfills orders automatically at 100% margin
- Admin configures: model, system prompt, input form, output type
- Shown to users as "HayeshAI Studio" branded services

---

## 👥 Five User Roles

| Role | Access | Key Actions |
|---|---|---|
| **Admin** | Full platform control | Approve teachers/sellers, set fees, deploy AI services, manage all users, enable translation |
| **Teacher** | Teacher portal | Profile management, session scheduling, progress notes, earnings |
| **Parent/Student** | Parent dashboard | Find teachers, book demos, pay monthly, track child progress |
| **Human Seller** | Seller dashboard | Create & manage gigs, orders, earnings |
| **Buyer** | Marketplace | Browse & purchase gig services or AI services |

---

## 🛠️ Tech Stack (NEVER deviate)

```
Frontend:     Next.js 15 App Router — TypeScript strict mode
Styling:      Tailwind CSS + shadcn/ui components
Animation:    Framer Motion + tsparticles + GSAP + Lenis
3D Effects:   Three.js + @react-three/fiber + @react-three/drei
Database:     Supabase (Postgres + Auth + Realtime + Storage)
Payments PK:  Simpaisa (JazzCash + Easypaisa + IBFT + cards in PKR)
Payments INT: Stripe Connect (subscriptions + one-time + payouts)
AI/JARVIS:    Claude API (Sonnet) with function calling
AI Routing:   OpenRouter (production) + OmniRoute (dev only)
Translation:  Deepgram STT → Claude API → ElevenLabs TTS
Video:        LiveKit (WebRTC — demo + live sessions)
Hosting:      Vercel (frontend) + Supabase Cloud (backend)
```

---

## 📁 Folder Structure

```
hayesh/
├── CLAUDE.md                    ← This file — always read first
├── .env.local                   ← API keys — never commit
├── .env.example                 ← Safe template to commit
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
│
├── app/                         ← Next.js App Router pages
│   ├── (public)/                ← Public routes (no auth)
│   │   ├── page.tsx             ← Homepage
│   │   ├── teachers/
│   │   │   ├── page.tsx         ← Teacher discovery/search
│   │   │   └── [id]/page.tsx    ← Teacher profile page
│   │   ├── marketplace/
│   │   │   ├── page.tsx         ← Gig marketplace
│   │   │   └── [id]/page.tsx    ← Gig detail page
│   │   ├── ai-services/
│   │   │   ├── page.tsx         ← AI service listings
│   │   │   └── [id]/page.tsx    ← AI service order page
│   │   ├── auth/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── callback/page.tsx
│   │   └── layout.tsx
│   │
│   ├── (admin)/                 ← Admin routes (admin role only)
│   │   ├── admin/
│   │   │   ├── page.tsx         ← Admin overview dashboard
│   │   │   ├── teachers/page.tsx        ← Teacher approvals + management
│   │   │   ├── sellers/page.tsx         ← Seller approvals + management
│   │   │   ├── users/page.tsx           ← All users management
│   │   │   ├── ai-services/page.tsx     ← AI service builder
│   │   │   ├── payments/page.tsx        ← Revenue + payouts
│   │   │   ├── translation/page.tsx     ← Translation privilege control
│   │   │   ├── disputes/page.tsx        ← Dispute resolution
│   │   │   ├── settings/page.tsx        ← Platform config
│   │   │   └── jarvis/page.tsx          ← JARVIS command center
│   │   └── layout.tsx
│   │
│   ├── (teacher)/               ← Teacher portal (teacher role only)
│   │   ├── dashboard/page.tsx
│   │   ├── sessions/page.tsx
│   │   ├── students/page.tsx
│   │   ├── earnings/page.tsx
│   │   ├── profile/page.tsx
│   │   └── layout.tsx
│   │
│   ├── (parent)/                ← Parent portal (parent role only)
│   │   ├── dashboard/page.tsx
│   │   ├── teachers/page.tsx
│   │   ├── progress/
│   │   │   └── [childId]/page.tsx
│   │   ├── payments/page.tsx
│   │   └── layout.tsx
│   │
│   ├── (seller)/                ← Seller portal (seller role only)
│   │   ├── dashboard/page.tsx
│   │   ├── gigs/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/edit/page.tsx
│   │   ├── orders/page.tsx
│   │   ├── earnings/page.tsx
│   │   └── layout.tsx
│   │
│   ├── (buyer)/                 ← Buyer portal (authenticated buyer)
│   │   ├── orders/page.tsx
│   │   ├── messages/page.tsx
│   │   └── layout.tsx
│   │
│   └── api/                     ← API routes
│       ├── jarvis/route.ts           ← JARVIS query handler
│       ├── translation/route.ts      ← Voice translation pipeline
│       ├── webhooks/
│       │   ├── stripe/route.ts       ← Stripe webhooks
│       │   └── simpaisa/route.ts     ← Simpaisa webhooks
│       ├── ai-services/
│       │   └── fulfill/route.ts      ← AI order fulfillment
│       └── upload/route.ts           ← File uploads to Supabase Storage
│
├── components/
│   ├── ui/                      ← shadcn/ui base components
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   ├── PageTransition.tsx   ← Framer Motion page wrapper
│   │   └── CosmosBackground.tsx ← tsparticles space background
│   ├── teacher/
│   │   ├── TeacherCard.tsx      ← Discovery grid card
│   │   ├── TeacherGrid.tsx      ← Search results grid
│   │   ├── TeacherProfile.tsx   ← Full profile page
│   │   ├── TeacherSearch.tsx    ← Search + filter bar
│   │   ├── SessionPlanCard.tsx  ← Basic/Standard/Premium tier cards
│   │   └── DemoBookingModal.tsx ← Demo lesson booking flow
│   ├── marketplace/
│   │   ├── GigCard.tsx          ← Fiverr-style gig card
│   │   ├── GigGrid.tsx
│   │   ├── GigPackages.tsx      ← Basic/Standard/Premium packages
│   │   ├── SellerProfile.tsx
│   │   └── OrderModal.tsx
│   ├── ai-services/
│   │   ├── AIServiceCard.tsx    ← "HayeshAI Studio" service card
│   │   ├── AIOrderForm.tsx      ← Dynamic form from admin config
│   │   └── AIDeliveryModal.tsx  ← Shows fulfilled AI output
│   ├── parent/
│   │   ├── ProgressChart.tsx    ← Attendance % + grade trend
│   │   ├── ChildCard.tsx        ← Child selector tabs
│   │   └── ReportCard.tsx       ← Monthly auto-generated report
│   ├── admin/
│   │   ├── RevenueChart.tsx
│   │   ├── ApprovalQueue.tsx
│   │   ├── AIServiceBuilder.tsx ← Admin AI agent config panel
│   │   ├── TranslationManager.tsx ← Per-teacher translation toggle
│   │   └── UserTable.tsx
│   ├── jarvis/
│   │   ├── JarvisWidget.tsx     ← Floating bottom-right widget
│   │   ├── JarvisChat.tsx       ← Chat + voice interface
│   │   └── JarvisCommands.tsx   ← Role-aware command suggestions
│   └── payments/
│       ├── SimpaisaCheckout.tsx ← Pakistani payment methods
│       ├── StripeCheckout.tsx   ← International payments
│       └── PaymentSelector.tsx  ← Auto-detects user country
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts            ← Browser client
│   │   ├── server.ts            ← Server client (RSC + API routes)
│   │   └── admin.ts             ← Service role client (admin only)
│   ├── payments/
│   │   ├── stripe.ts            ← Stripe helpers
│   │   └── simpaisa.ts          ← Simpaisa helpers
│   ├── ai/
│   │   ├── jarvis-router.ts     ← 3-tier AI routing logic
│   │   ├── intent-classifier.ts ← Simple/Medium/Complex detection
│   │   ├── openrouter.ts        ← OpenRouter client
│   │   └── claude.ts            ← Anthropic client
│   ├── translation/
│   │   ├── pipeline.ts          ← Deepgram → Claude → ElevenLabs
│   │   ├── deepgram.ts
│   │   └── elevenlabs.ts
│   ├── livekit/
│   │   └── tokens.ts            ← LiveKit room token generation
│   └── utils/
│       ├── cn.ts                ← Tailwind class merger
│       ├── format.ts            ← Currency, date formatters
│       └── countries.ts         ← Country detection for payments
│
├── types/
│   ├── database.ts              ← Supabase generated types
│   ├── teacher.ts
│   ├── seller.ts
│   ├── parent.ts
│   ├── order.ts
│   ├── payment.ts
│   └── jarvis.ts
│
├── hooks/
│   ├── useJarvis.ts             ← JARVIS query hook
│   ├── useVoice.ts              ← Web Speech API hook
│   ├── useSupabase.ts           ← Supabase auth hook
│   ├── useTeachers.ts
│   └── useOrders.ts
│
└── styles/
    └── globals.css              ← Tailwind base + Hayesh tokens
```

---

## 🎨 Design System — Hayesh Dark Cosmos

```css
/* Color Tokens */
--background:       #05050F   /* Deep space black */
--surface:          #0D0D1F   /* Dark navy surface */
--surface-elevated: #12122A   /* Card background */
--border:           rgba(108, 99, 255, 0.2)

--accent-primary:   #6C63FF   /* Electric violet */
--accent-secondary: #00D4FF   /* Cyan glow */
--accent-success:   #00FF94   /* Neon green */
--accent-warning:   #FFB800   /* Amber */
--accent-danger:    #FF4466   /* Red alert */

--text-primary:     #F0F0FF   /* Near white */
--text-muted:       #7070A0   /* Muted lavender */
--text-disabled:    #3A3A5C

/* Glow Effects */
--glow-violet: 0 0 30px rgba(108, 99, 255, 0.4)
--glow-cyan:   0 0 30px rgba(0, 212, 255, 0.4)
--glow-green:  0 0 20px rgba(0, 255, 148, 0.4)

/* Typography */
Display:  'Space Grotesk' (600-700) — headlines, hero text
Body:     'Inter' (400-500) — all body copy
Mono:     'JetBrains Mono' — code, data, prices
```

---

## ⚙️ Coding Rules (Always Follow)

- TypeScript ONLY — never write plain JavaScript
- Server Components by default — add `'use client'` only when needed
- All database calls use Supabase server client in API routes / RSC
- Never hardcode API keys — always use `process.env.VAR_NAME`
- All env vars in `.env.local` — never commit secrets
- Run `npm run build` after every major feature to catch errors
- One component per file, named exports preferred
- File naming: `kebab-case.tsx` for components, `camelCase.ts` for utils
- Use `cn()` utility for all conditional Tailwind classes
- All forms use React Hook Form + Zod validation
- All API routes return typed responses
- Error boundaries on every major page section
- Loading states on every data-fetching component

---

## 💰 Revenue Streams (Keep in Mind When Building)

| Stream | Rate | Who Pays |
|---|---|---|
| Teacher registration fee | Admin-set (e.g. $20–$100) | Teacher (one-time) |
| Seller registration fee | Admin-set | Seller (one-time) |
| Monthly tuition commission | 15% (admin-configurable) | Deducted from teacher payout |
| Gig order commission | 18% (admin-configurable) | Deducted from seller payout |
| AI service orders | 100% margin | Buyer (no payout needed) |
| Featured listing | Admin-set price | Teacher or Seller |
| Translation feature | Admin-set monthly fee | Teacher |
| Premium parent plan | $9.99/mo | Parent |

---

## 🔀 AI Routing Rules

### Development (Claude Code sessions on your machine):
- OmniRoute at `localhost:20128` handles all Claude Code queries
- Uses auto/coding strategy — burns free quotas before paid
- Token compression active (RTK + Caveman) — saves up to 95%
- Never use Max reasoning effort — use High

### Production (JARVIS inside Hayesh for users):
```
Simple queries (80%)  → OpenRouter free (Llama 4 Maverick:free)
                         Cost: $0.00
Medium queries (15%)  → OpenRouter paid (GPT-OSS 120B)
                         Cost: ~$0.001/query
Complex/agentic (5%)  → Claude Sonnet (Anthropic API direct)
                         Cost: ~$0.015/query
Intent classifier     → Llama 4 Scout:free (fastest, cheapest)
```

### OpenRouter Base URL: `https://openrouter.ai/api/v1`
### OmniRoute Base URL:  `http://localhost:20128/v1` (dev only)

---

## 🇵🇰 Payment Architecture

### Two processors — NEVER mix their logic:

**Simpaisa** → Pakistani users (detect country = PK)
- JazzCash, Easypaisa, IBFT (Raast), debit/credit cards in PKR
- One API for all local methods
- Teacher/seller payouts via IBFT to bank account

**Stripe Connect** → International users (country ≠ PK)
- Card, Apple Pay, Google Pay in USD/EUR
- Teacher/seller payouts via Stripe Connect payout
- Subscription billing for monthly tuitions

### Country detection logic:
```typescript
// In PaymentSelector.tsx
const isLocalUser = user.country === 'PK'
// Show Simpaisa methods OR Stripe checkout
```

### Bank transfer manual flow:
1. User selects "Bank Transfer" → shown Hayesh's bank details
2. User transfers + uploads screenshot proof
3. Admin sees pending confirmation in dashboard
4. Admin clicks "Confirm" → subscription activates + JARVIS notifies teacher

---

## 🌍 Translation Feature Rules

- ONLY enabled by Admin per-teacher — never auto-enabled
- Admin sets exactly which languages each teacher can broadcast in
- Pipeline: `Deepgram STT → Claude API translate → ElevenLabs TTS`
- Target round-trip latency: under 1000ms
- Translation badge `✦ Multilingual` shown on teacher profile card
- Translation feature only available inside LiveKit video sessions
- Admin can disable translation for any teacher at any time
- If admin disables mid-session, graceful fallback to no-translation

---

## 🤖 JARVIS Rules

- Floating widget fixed `bottom-6 right-6` on ALL authenticated pages
- Role-aware — different commands and context per user role
- Voice input via Web Speech API (no external STT for JARVIS itself)
- Responses always in natural language — never raw JSON to users
- Function calling for DB operations — never raw SQL in JARVIS
- Admin JARVIS has the widest permissions — all platform actions
- JARVIS never exposes other users' private data to non-admin roles
- Animate widget open/close with Framer Motion spring physics

---

## 🚫 Never Do This

- Never use Pages Router — App Router ONLY
- Never write raw SQL — use Supabase query builder or RPC
- Never expose `SUPABASE_SERVICE_ROLE_KEY` client-side
- Never expose `STRIPE_SECRET_KEY` client-side
- Never expose `ANTHROPIC_API_KEY` client-side
- Never mix teacher subscription logic with gig one-time logic
- Never let AI service prompt be visible to end users
- Never commit `.env.local` to Git
- Never use `any` TypeScript type — always define proper types
- Never build in Pages Router — always App Router

---

## 🔋 Token Optimization Rules (For Claude Code Sessions)

- Use OmniRoute `auto/coding` for all build tasks
- Use OmniRoute `auto/fast` for quick questions
- When I say "thinking out loud" or "just asking" — DO NOT build anything
- Run `/compact` when session feels long — do this proactively
- Start a NEW session for each major new feature
- Reasoning effort: HIGH (never Max for routine tasks)
- Fable 5 is the orchestrator: it plans/reviews only, Sonnet agents build — full policy in `.claude/rules/orchestrator.md`

---

## 📅 Build Order (Ten-Week Plan)

```
Week 1  → Supabase schema + Auth (all 5 roles) + middleware
Week 2  → Teacher profile pages + search + filter
Week 3  → Demo booking + LiveKit video session
Week 4  → Stripe + Simpaisa payment integration
Week 5  → Admin dashboard + approval flows + settings
Week 6  → Human seller gig system (full Fiverr flow)
Week 7  → AI service builder + Claude API fulfillment engine
Week 8  → JARVIS voice agent (all 5 roles)
Week 9  → Voice translation pipeline (Deepgram + ElevenLabs)
Week 10 → Polish, performance, deploy to Vercel
```

---

## 🚀 Current Phase

**Phase: WEEK 1 — Supabase Schema + Auth**

Next tasks:
1. Install all dependencies
2. Set up Supabase project + connect to Next.js
3. Write complete database schema (all tables)
4. Set up Supabase Auth with role-based access
5. Create middleware for route protection
6. Test all 5 user role login flows

---

*Last updated: Project start — Week 1*
