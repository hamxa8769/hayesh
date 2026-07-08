# Hayesh — Tutoring-First Marketplace Platform

> A three-layer marketplace connecting teachers with parents, freelancers with buyers, and AI agents with everyone — powered by JARVIS.

---

## Table of Contents

- [What is Hayesh](#what-is-hayesh)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Database Schema](#database-schema)
- [Design System](#design-system)
- [Build Phases](#build-phases)
- [Revenue Model](#revenue-model)
- [AI Routing](#ai-routing)
- [Payment Architecture](#payment-architecture)
- [Security Architecture](#security-architecture)
- [Development Setup](#development-setup)
- [Environment Variables](#environment-variables)
- [File Structure](#file-structure)
- [API Reference](#api-reference)
- [Current Status](#current-status)

---

## What is Hayesh

Hayesh is a tutoring-first marketplace platform with three distinct layers:

| Layer | What It Is | Who Pays |
|---|---|---|
| **Teacher Profiles** | Structured teacher profiles with monthly subscriptions | Parents pay teachers monthly |
| **Human Seller Marketplace** | Fiverr-style gig economy (design, video, writing, code) | Buyers pay sellers one-time |
| **AI Agent Services** | Admin-deployed Claude API agents fulfilling orders at 100% margin | Buyers pay platform |

Each layer has its own portal, approval flow, and revenue mechanics. One platform, three business models.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│  Next.js 15 App Router · TypeScript Strict · Tailwind v4   │
│  Framer Motion · Three.js · tsparticles · GSAP · Lenis     │
├─────────────────────────────────────────────────────────────┤
│                     COMPONENT LAYER                         │
│  JARVIS UI Kit (7 components) · shadcn/ui base (6)         │
│  Layout Shell · Sidebar · Header · Navbar · Widget         │
├─────────────────────────────────────────────────────────────┤
│                      API LAYER                              │
│  /api/profile · /api/jarvis · /api/upload                   │
│  /api/ai-services/fulfill · /api/translation (planned)      │
│  /api/webhooks/stripe · /api/webhooks/simpaisa (planned)    │
├─────────────────────────────────────────────────────────────┤
│                    SERVICE LAYER                            │
│  AI Router (OmniRoute / OpenRouter / Anthropic)            │
│  Supabase Client (browser / server / admin)                │
│  Payment Processors (Stripe Connect / Simpaisa)            │
│  LiveKit (WebRTC video sessions)                           │
│  Translation Pipeline (Deepgram → Claude → ElevenLabs)     │
├─────────────────────────────────────────────────────────────┤
│                     DATA LAYER                              │
│  Supabase (PostgreSQL + Auth + Realtime + Storage)         │
│  17 tables · 8 enums · RLS on all tables                   │
│  Column-level GRANTs · 6 storage buckets                   │
├─────────────────────────────────────────────────────────────┤
│                    INFRASTRUCTURE                           │
│  Vercel (frontend + API routes)                            │
│  Supabase Cloud (database + auth + storage)                │
│  GoDaddy DNS → Vercel                                      │
│  OmniRoute (dev AI gateway) · OpenRouter (prod)            │
└─────────────────────────────────────────────────────────────┘
```

### Five User Roles

```
                    ┌──────────┐
                    │  ADMIN   │ ← Full platform control
                    └────┬─────┘
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌─────▼─────┐   ┌─────▼─────┐
    │ TEACHER │    │  PARENT   │   │  SELLER   │
    └────┬────┘    └─────┬─────┘   └─────┬─────┘
         │               │               │
         │          ┌────▼────┐          │
         │          │  BUYER  │          │
         │          └─────────┘          │
         │               │               │
    ┌────▼────────────────▼───────────────▼────┐
    │          SHARED: JARVIS Widget           │
    │     (role-aware AI assistant)            │
    └──────────────────────────────────────────┘
```

### Data Flow

```
Parent books demo → Admin approves teacher → Parent subscriments monthly
                          ↓                          ↓
                   LiveKit session              Stripe/Simpaisa payment
                          ↓                          ↓
                   Session recorded            Transaction logged
                          ↓                          ↓
                   Progress tracked            Teacher paid (85%)
                          ↓
                   Report card generated

Buyer orders gig → Seller delivers → Buyer reviews → Transaction logged
                                              ↓
                                     Platform takes 18%

Buyer orders AI service → Claude fulfills → Output delivered → 100% margin
```

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Framework** | Next.js (App Router) | 15.5.20 |
| **Language** | TypeScript (strict mode) | 5.x |
| **Styling** | Tailwind CSS | v4 |
| **UI Kit** | JARVIS custom + shadcn/ui base | — |
| **Animation** | Framer Motion + GSAP + Lenis | 12.x / 3.x / 1.x |
| **3D** | Three.js + @react-three/fiber + @react-three/drei | 0.185 / 9.x / 10.x |
| **Particles** | tsparticles (slim bundle) | 4.x |
| **Database** | Supabase (PostgreSQL) | — |
| **Auth** | Supabase Auth (email + Google OAuth) | — |
| **Storage** | Supabase Storage (6 buckets) | — |
| **Payments (PK)** | Simpaisa (JazzCash + Easypaisa + IBFT + cards) | — |
| **Payments (INT)** | Stripe Connect (subscriptions + one-time + payouts) | — |
| **AI (dev)** | OmniRoute (localhost:20128, 90+ free providers) | 3.8.x |
| **AI (prod simple)** | OpenRouter (Llama 4 Maverick:free) | — |
| **AI (prod complex)** | Anthropic API (Claude Sonnet) | — |
| **Video** | LiveKit (WebRTC) | 2.x |
| **Translation** | Deepgram STT → Claude → ElevenLabs TTS | — |
| **Forms** | React Hook Form + Zod | 7.x / 4.x |
| **Charts** | Recharts | 3.x |
| **Icons** | Lucide React | 1.x |
| **Hosting** | Vercel | — |
| **DNS** | GoDaddy → Vercel | — |

---

## Database Schema

17 tables, 8 enums, RLS on all tables, column-level GRANTs on sensitive columns.

### Core Tables

```
auth.users (Supabase Auth)
    │
    ▼
profiles ──────────────── User identity (role, name, email, avatar)
    │
    ├──▶ teachers ──────── Teacher profiles (education, subjects, pricing)
    │       ├──▶ teacher_reviews
    │       ├──▶ demo_bookings
    │       ├──▶ subscriptions ──▶ sessions ──▶ student_progress
    │       └──▶ transactions (as payee)
    │
    ├──▶ sellers ────────── Seller profiles (skills, level, stats)
    │       ├──▶ gigs ──── Listings (3-tier packages)
    │       │       └──▶ gig_orders ──▶ transactions (as payee)
    │       └──▶ transactions (as payee)
    │
    ├──▶ ai_services ───── Admin-created AI agent listings
    │       └──▶ ai_orders ──▶ transactions
    │
    ├──▶ subscriptions (as parent)
    ├──▶ demo_bookings (as parent)
    ├──▶ gig_orders (as buyer)
    ├──▶ ai_orders (as buyer)
    ├──▶ transactions (as payer)
    ├──▶ payouts
    ├──▶ notifications
    └──▶ messages
```

### Platform Settings (11 defaults)

| Setting | Default | Description |
|---|---|---|
| `teacher_commission_pct` | 15% | Deducted from teacher payouts |
| `seller_commission_pct` | 18% | Deducted from seller payouts |
| `teacher_registration_fee_pkr` | ₨2,000 | One-time fee to register as teacher |
| `seller_registration_fee_pkr` | ₨1,000 | One-time fee to register as seller |
| `demo_lesson_duration_mins` | 30 min | Free demo lesson length |
| `parent_premium_price_usd` | $9.99/mo | Premium parent plan |
| `ai_service_brand_name` | "HayeshAI Studio" | AI service display name |
| `translation_feature_enabled` | true | Global translation toggle |
| `maintenance_mode` | false | Platform-wide maintenance |

### Storage Buckets

| Bucket | Public | Purpose |
|---|---|---|
| `avatars` | Yes | User profile photos |
| `teacher-media` | Yes | Teacher intro videos, documents |
| `gig-gallery` | Yes | Gig portfolio images |
| `order-files` | No | Delivered order files |
| `payment-proofs` | No | Bank transfer screenshots |
| `session-recordings` | No | LiveKit session recordings |

---

## Design System

### Hayesh Dark Cosmos

```
Background:     #05050F (deep space black)
Surface:        #0D0D1F (dark navy)
Surface:        #12122A (elevated cards)
Border:         rgba(108, 99, 255, 0.2)

Accent:         #6C63FF (electric violet — primary)
Accent:         #00D4FF (cyan glow — secondary)
Success:        #00FF94 (neon green)
Warning:        #FFB800 (amber)
Danger:         #FF4466 (red alert)

Text:           #F0F0FF (near white)
Text Muted:     #7070A0 (lavender)
Text Disabled:  #3A3A5C

Glow Violet:    0 0 30px rgba(108, 99, 255, 0.4)
Glow Cyan:      0 0 30px rgba(0, 212, 255, 0.4)
Glow Green:     0 0 20px rgba(0, 255, 148, 0.4)
```

### Typography

| Role | Font | Weights | Usage |
|---|---|---|---|
| Display | Space Grotesk | 600–700 | Headlines, hero text |
| Body | Inter | 400–500 | All body copy |
| Mono | JetBrains Mono | 400–500 | Code, data, prices |

### JARVIS UI Kit (7 Custom Components)

| Component | Purpose | Glow Colors |
|---|---|---|
| `JarvisCard` | Glassmorphic card with gradient border | violet / cyan / green / none |
| `JarvisButton` | Animated button with loading spinner | primary / secondary / ghost / danger |
| `JarvisInput` | Input with animated focus glow | violet ring on focus |
| `JarvisRoleCard` | Selectable role card for registration | violet / cyan / green / amber |
| `JarvisDivider` | Animated gradient divider | multi-color gradient |
| `JarvisText` | Typewriter text animation | — |
| `JarvisTerminal` | Multi-line terminal typing | — |

### Animations

- `glow-pulse` — Box shadow breathing
- `float` — Vertical hover bob
- `scan-line` — Vertical scanner effect
- Framer Motion spring physics on all interactive elements
- Three.js wireframe geometry in auth pages
- tsparticles cosmic background (70 particles)

---

## Build Phases

### Phase 1 — Foundation & Auth ✅ COMPLETE

**Duration:** Completed  
**Status:** All tasks done

| Task | Status |
|---|---|
| Next.js 15 scaffold with TypeScript strict | ✅ |
| Tailwind v4 with design tokens | ✅ |
| Supabase project setup + schema (17 tables) | ✅ |
| TypeScript types (621 lines, all tables) | ✅ |
| Supabase clients (browser / server / admin) | ✅ |
| Auth: email/password + Google OAuth | ✅ |
| Auth: 2-step role-based registration | ✅ |
| Auth: OAuth callback handler | ✅ |
| Middleware: role-based route protection | ✅ |
| Middleware: auto-profile creation fallback | ✅ |
| JARVIS UI kit (7 components) | ✅ |
| shadcn/ui base components (6) | ✅ |
| Design system: globals.css with tokens | ✅ |
| Fonts: Space Grotesk + Inter + JetBrains Mono | ✅ |

**Deliverable:** Working auth system with 5 roles, JARVIS design system, full database schema.

---

### Phase 2 — Teacher Portal ✅ COMPLETE

**Duration:** Completed  
**Status:** All tasks done

| Task | Status |
|---|---|
| DashboardLayoutShell (auth-gated, role-aware) | ✅ |
| DashboardSidebar (role-specific nav items) | ✅ |
| DashboardHeader (fixed, JARVIS status) | ✅ |
| Teacher dashboard (stats + quick actions) | ✅ |
| Teacher onboarding (7-step registration wizard) | ✅ |
| Teacher profile (edit display name + tagline) | ✅ |
| Teacher sessions (filter by status + LiveKit join) | ✅ |
| Teacher students (active student grid) | ✅ |
| Teacher earnings (transactions + balance) | ✅ |

**Deliverable:** Complete teacher portal with onboarding wizard, session management, earnings tracking.

---

### Phase 3 — Parent Portal ✅ COMPLETE

**Duration:** Completed  
**Status:** All tasks done

| Task | Status |
|---|---|
| Parent dashboard (subscriptions, spending, children) | ✅ |
| Find teachers (search + filter + browse) | ✅ |
| Student progress (attendance % + grades) | ✅ |
| Payment history (transaction list) | ✅ |

**Deliverable:** Parent portal for finding teachers, tracking child progress, viewing payments.

---

### Phase 4 — Seller & Buyer Portals ✅ COMPLETE

**Duration:** Completed  
**Status:** All tasks done

| Task | Status |
|---|---|
| Seller dashboard (gigs, orders, balance) | ✅ |
| Seller gig list + create new gig form | ✅ |
| Seller orders (incoming orders with status) | ✅ |
| Seller earnings (transaction history) | ✅ |
| Buyer dashboard (orders, spending) | ✅ |
| Buyer orders (order history) | ✅ |
| Buyer messages (placeholder) | ✅ |

**Deliverable:** Complete seller portal with gig management, buyer portal with order tracking.

---

### Phase 5 — Admin Panel ✅ COMPLETE

**Duration:** Completed  
**Status:** All tasks done

| Task | Status |
|---|---|
| Admin overview (5-stat grid: teachers, parents, sellers, AI, revenue) | ✅ |
| Teacher management (approve / revoke queue) | ✅ |
| Seller management (approve queue) | ✅ |
| User management (all users table with role badges) | ✅ |
| AI service builder (listing + create flow) | ✅ |
| Payments & revenue (total revenue + transaction list) | ✅ |
| Translation privileges (per-teacher toggle) | ✅ |
| Disputes (placeholder) | ✅ |
| Settings (placeholder) | ✅ |

**Deliverable:** Full admin panel with approval queues, revenue tracking, translation control.

---

### Phase 6 — Public Pages & JARVIS ✅ COMPLETE

**Duration:** Completed  
**Status:** All tasks done

| Task | Status |
|---|---|
| Homepage (hero, 3-layer features, stats, CTA, footer) | ✅ |
| Teacher discovery page (search + grid) | ✅ |
| Teacher detail page (profile, pricing, book demo) | ✅ |
| Marketplace page (gig search + grid) | ✅ |
| Gig detail page (3-tier packages) | ✅ |
| AI services page (HayeshAI Studio listings) | ✅ |
| AI service detail page (order flow) | ✅ |
| JARVIS floating widget (chat interface) | ✅ |
| JARVIS API route (intent classification + 3-tier routing) | ✅ |
| AI router utility (OmniRoute / OpenRouter / Anthropic) | ✅ |

**Deliverable:** Complete public-facing pages, JARVIS widget, AI routing layer.

---

### Phase 7 — Payment Integration (NEXT)

**Duration:** 1–2 weeks  
**Status:** Not started

| Task | Priority | Description |
|---|---|---|
| Stripe Connect onboarding | High | Teacher/seller account setup |
| Simpaisa checkout (PKR) | High | JazzCash, Easypaisa, IBFT, cards |
| Stripe checkout (USD/EUR) | High | Card, Apple Pay, Google Pay |
| Payment selector component | High | Auto-detects user country, shows relevant options |
| Subscription billing (monthly tuition) | High | Stripe recurring for parents |
| One-time payments (gig orders) | High | Stripe/Simpaisa for marketplace |
| AI service payments | High | One-time Stripe/Simpaisa |
| Webhook handlers | High | Stripe + Simpaisa webhook routes |
| Transaction logging | High | All payments → transactions table |
| Platform commission | High | Auto-deduct 15% teacher / 18% seller |
| Payout system | Medium | IBFT (PK) + Stripe Connect payout (INT) |
| Bank transfer manual flow | Medium | Upload proof → admin confirms |
| Registration fee collection | Medium | Teacher/seller one-time fee |

**Deliverable:** Working payment system with dual processors, subscriptions, commissions, payouts.

---

### Phase 8 — Video Sessions & Translation

**Duration:** 1–2 weeks  
**Status:** Not started

| Task | Priority | Description |
|---|---|---|
| LiveKit token generation | High | Server-side room token creation |
| Video session component | High | WebRTC video player with controls |
| Demo lesson booking flow | High | Parent books → teacher confirms → LiveKit room |
| Session recording | Medium | Record to Supabase Storage |
| Deepgram STT integration | High | Real-time speech-to-text |
| Claude translation | High | Text translation between languages |
| ElevenLabs TTS | High | Translated text-to-speech |
| Translation toggle (admin) | High | Per-teacher on/off control |
| Mid-session disable | Medium | Graceful fallback if admin revokes |

**Deliverable:** Live video sessions with real-time voice translation pipeline.

---

### Phase 9 — JARVIS Intelligence & Polish

**Duration:** 1 week  
**Status:** Not started

| Task | Priority | Description |
|---|---|---|
| JARVIS function calling | High | DB operations via natural language |
| Role-aware commands | High | Different suggestions per role |
| JARVIS context memory | Medium | Conversation history per session |
| Notification system | Medium | In-app notifications (table exists) |
| Real-time messaging | Medium | Buyer ↔ seller chat (table exists) |
| Parent report cards | Medium | Auto-generated monthly reports |
| Teacher analytics | Medium | Earnings trends, student growth |
| Search optimization | Medium | Full-text search on teachers/gigs |
| SEO metadata | Low | OpenGraph, Twitter cards, sitemap |
| Error boundaries | High | On every major page section |
| Loading states | High | Skeleton loaders on all data components |

**Deliverable:** Intelligent JARVIS, notifications, messaging, polished UX.

---

### Phase 10 — Deploy & Launch

**Duration:** 3–5 days  
**Status:** Not started

| Task | Priority | Description |
|---|---|---|
| Vercel production deploy | High | Link repo, set env vars, deploy |
| Custom domain setup | High | hayesh.com → Vercel |
| GoDaddy DNS config | High | A record + CNAME to Vercel |
| SSL verification | High | Auto via Vercel |
| Environment variables audit | High | All 20 vars set in Vercel |
| Supabase production hardening | High | RLS audit, backup schedule |
| Stripe live mode | High | Switch from test to live keys |
| Simpaisa live mode | High | Production merchant account |
| Performance audit | Medium | Lighthouse, bundle analysis |
| Accessibility audit | Medium | WCAG 2.1 AA compliance |
| PostHog analytics | Low | Event tracking setup |
| Monitoring | Medium | Vercel Analytics + Supabase Dashboard |

**Deliverable:** Production-ready platform live at hayesh.com.

---

## Revenue Model

| Stream | Rate | Who Pays | Frequency |
|---|---|---|---|
| Teacher registration fee | ₨2,000 / $10 | Teacher | One-time |
| Seller registration fee | ₨1,000 / $5 | Seller | One-time |
| Monthly tuition commission | 15% | Deducted from teacher payout | Monthly |
| Gig order commission | 18% | Deducted from seller payout | Per order |
| AI service orders | 100% margin | Buyer | Per order |
| Featured listing | Admin-set | Teacher or Seller | Monthly |
| Translation feature | Admin-set | Teacher | Monthly |
| Premium parent plan | $9.99/mo | Parent | Monthly |

### Projected Revenue Mix (at scale)

```
Teacher subscriptions (15% commission)    45%
Gig marketplace (18% commission)          25%
AI services (100% margin)                20%
Registration fees + featured listings     10%
```

---

## AI Routing

### Development (Local)

```
Request → OmniRoute (localhost:20128/v1)
              ├── auto/coding (burns free quotas first)
              ├── auto/fast (quick queries)
              └── auto/reasoning (complex tasks)
              
Free providers: DuckDuckGo, Auggie, OpenCode, Kiro, Pepper
Cost: $0.00
```

### Production (Vercel)

```
Intent Classifier → classifyIntent(query)
    │
    ├── simple (80%) → OpenRouter free (Llama 4 Maverick:free)
    │                   Cost: $0.00
    │
    ├── medium (15%) → OpenRouter paid (GPT-OSS 120B)
    │                   Cost: ~$0.001/query
    │
    └── complex (5%) → Anthropic API (Claude Sonnet)
                        Cost: ~$0.015/query
```

### Functions

| Function | Purpose | Model |
|---|---|---|
| `chatCompletion()` | JARVIS responses | auto (dev) / Llama 4 Maverick (prod) |
| `claudeCompletion()` | AI service fulfillment | auto (dev) / Claude Sonnet (prod) |
| `classifyIntent()` | Route to right tier | Scout:free (both) |

---

## Payment Architecture

### Two Processors — Never Mix Logic

```
┌─────────────────────────────────────────────────┐
│                PAYMENT SELECTOR                  │
│         (auto-detects user country)              │
└────────┬──────────────────────┬─────────────────┘
         │                      │
    country = PK           country ≠ PK
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌─────────────────┐
│    SIMPAISA     │    │      STRIPE     │
│  (Pakistani)    │    │  (International)│
├─────────────────┤    ├─────────────────┤
│ • JazzCash      │    │ • Card          │
│ • Easypaisa     │    │ • Apple Pay     │
│ • IBFT (Raast)  │    │ • Google Pay    │
│ • Cards (PKR)   │    │ • Subscriptions │
├─────────────────┤    ├─────────────────┤
│ Payouts: IBFT   │    │ Payouts: Stripe │
│ to bank account │    │ Connect payout  │
└─────────────────┘    └─────────────────┘
```

### Bank Transfer Manual Flow

1. User selects "Bank Transfer" → shown Hayesh bank details
2. User transfers + uploads screenshot proof
3. Admin sees pending confirmation in dashboard
4. Admin clicks "Confirm" → subscription activates

---

## Security Architecture

### Row-Level Security (RLS)

Every table has RLS policies:
- Users can only read their own data
- Teachers can only update their own profile
- Sellers can only update their own gigs
- Parents can only see their own children's progress
- Admin bypasses all RLS via service role client

### Column-Level GRANTs

Sensitive columns are protected from client-side writes:

| Table | Protected Columns |
|---|---|
| `profiles` | `role`, `is_verified`, `is_active` |
| `teachers` | `status`, `registration_fee_paid`, `featured` |
| `gigs` | `status`, `seller_id` |

### API Key Security

| Key | Where Stored | Client Accessible |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | ❌ Never |
| `STRIPE_SECRET_KEY` | Server only | ❌ Never |
| `ANTHROPIC_API_KEY` | Server only | ❌ Never |
| `OPENROUTER_API_KEY` | Server only | ❌ Never |
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | ✅ Yes |

### Auth Flow

```
Login → Supabase Auth → JWT token → Middleware verifies
                                        │
                              ┌──────────┼──────────┐
                              │          │          │
                         No role    Wrong role   Correct role
                              │          │          │
                         Redirect    Redirect   Allow access
                         to login    to portal     │
                                                    ▼
                                            Dashboard loads
                                            (with retry logic)
```

---

## Development Setup

### Prerequisites

- Node.js 22+
- npm or pnpm
- Supabase project (free tier works)
- OmniRoute (for local AI — optional)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/hamxa8769/hayesh.git
cd hayesh

# Install dependencies
npm install

# Copy env template
cp .env.example .env.local

# Fill in your Supabase keys in .env.local
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# SUPABASE_SERVICE_ROLE_KEY=...

# Run development server
npm run dev

# In separate terminal — start OmniRoute (free AI)
npm install -g omniroute
omniroute
```

### Available Scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev --turbopack` | Development server |
| `build` | `next build` | Production build |
| `start` | `next start` | Production server |
| `lint` | `eslint` | Lint check |

---

## Environment Variables

### Required (18)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Stripe (International)
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Simpaisa (Pakistan)
SIMPAISA_API_KEY=...
SIMPAISA_WEBHOOK_SECRET=...
NEXT_PUBLIC_SIMPAISA_MERCHANT_ID=...

# AI
OPENROUTER_API_KEY=sk-or-...
ANTHROPIC_API_KEY=sk-ant-...

# LiveKit
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
NEXT_PUBLIC_LIVEKIT_URL=wss://...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Hayesh
```

### Optional (4)

```bash
OMNIROUTE_BASE_URL=http://localhost:20128/v1  # Dev AI gateway
DEEPGRAM_API_KEY=...                           # Voice translation
ELEVENLABS_API_KEY=...                         # Voice translation
NEXT_PUBLIC_POSTHOG_KEY=...                    # Analytics
```

---

## File Structure

```
hayesh/
├── app/                          # 42 route files
│   ├── layout.tsx                # Root layout (fonts)
│   ├── globals.css               # Design system
│   ├── page.tsx                  # Homepage
│   ├── auth/                     # 3 auth pages
│   ├── teachers/                 # 2 public teacher pages
│   ├── marketplace/              # 2 public marketplace pages
│   ├── ai-services/              # 2 public AI service pages
│   ├── teacher/                  # 6 teacher portal pages
│   ├── parent/                   # 4 parent portal pages
│   ├── seller/                   # 5 seller portal pages
│   ├── buyer/                    # 3 buyer portal pages
│   ├── admin/                    # 9 admin panel pages
│   └── api/                      # 4 API routes
│
├── components/                   # 22 component files
│   ├── ui/                       # 13 base + JARVIS components
│   ├── layout/                   # 7 layout components
│   └── jarvis/                   # 1 JARVIS widget
│
├── lib/                          # 6 utility files
│   ├── supabase/                 # 3 Supabase clients
│   ├── ai/                       # 1 AI router
│   └── utils/                    # 2 utility modules
│
├── types/
│   └── database.ts               # 621-line type definitions
│
├── hooks/
│   └── useSupabase.ts            # Auth + profile hook
│
├── supabase-schema.sql           # Full database schema
├── supabase-migrations/          # 3 migration files
├── CLAUDE.md                     # Master build instructions
└── .env.example                  # Environment template
```

---

## API Reference

### GET `/api/profile`

Fetch current authenticated user's profile.

**Auth:** Required (Bearer token)  
**Response:** `200 { profile: Profile }` | `401 { error: "Unauthorized" }`

---

### POST `/api/jarvis`

JARVIS AI chat with intent classification.

**Auth:** Required  
**Body:** `{ query: string }`  
**Response:** `200 { answer: string, complexity: "simple" | "medium" | "complex" }`

**Routing:**
- Dev → OmniRoute (auto)
- Prod simple → OpenRouter (Llama 4 Maverick:free)
- Prod medium → OpenRouter (GPT-OSS 120B)
- Prod complex → Anthropic (Claude Sonnet)

---

### POST `/api/upload`

Upload file to Supabase Storage.

**Auth:** Required  
**Body:** `multipart/form-data { file: File }`  
**Response:** `200 { url: string }`

---

### POST `/api/ai-services/fulfill`

Fulfill AI service order.

**Auth:** Required  
**Body:** `{ service_id: string, input: string }`  
**Response:** `200 { output: string }`

**Routing:**
- Dev → OmniRoute (auto)
- Prod → Anthropic (Claude Sonnet)

---

## Current Status

| Phase | Status | Pages | Components |
|---|---|---|---|
| Phase 1: Foundation & Auth | ✅ Complete | 3 | 20 |
| Phase 2: Teacher Portal | ✅ Complete | 6 | — |
| Phase 3: Parent Portal | ✅ Complete | 4 | — |
| Phase 4: Seller & Buyer | ✅ Complete | 8 | — |
| Phase 5: Admin Panel | ✅ Complete | 9 | — |
| Phase 6: Public + JARVIS | ✅ Complete | 8 | 2 |
| Phase 7: Payments | 🔲 Next | — | — |
| Phase 8: Video + Translation | 🔲 Pending | — | — |
| Phase 9: JARVIS Intelligence | 🔲 Pending | — | — |
| Phase 10: Deploy & Launch | 🔲 Pending | — | — |

**Total built:** 42 routes, 22 components, 6 lib modules, 17 DB tables, 4 API routes  
**Total remaining:** Payments, video, translation, intelligence, deploy

---

## License

Proprietary — All rights reserved.
