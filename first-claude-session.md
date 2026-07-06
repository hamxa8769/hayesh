# First Claude Code Session — Paste This

After running setup-lumora.bat and opening the lumora folder,
start Claude Code with `claude` and paste this prompt:

---

## PROMPT TO PASTE IN CLAUDE CODE TERMINAL:

```
Read CLAUDE.md fully. 

I am building Lumora — a three-layer tutoring marketplace.
This is Week 1, Day 1. We are setting up the project foundation.

Please do the following in order:

1. Set up globals.css with the Lumora Dark Cosmos design tokens
   (colors, typography variables using Space Grotesk + Inter + JetBrains Mono)

2. Update tailwind.config.ts to include the Lumora color palette
   and add Google Fonts for Space Grotesk, Inter, JetBrains Mono

3. Create lib/supabase/client.ts (browser client)

4. Create lib/supabase/server.ts (server client for RSC and API routes)

5. Create lib/utils/cn.ts (Tailwind class merger utility)

6. Create types/database.ts with TypeScript interfaces for all 
   Supabase tables: Profile, Teacher, Seller, Gig, 
   Subscription, Session, GigOrder, AIService, AIOrder, Transaction

7. Create middleware.ts in the project root that:
   - Protects /admin/* routes (admin role only)
   - Protects /teacher-portal/* routes (teacher role only)  
   - Protects /parent/* routes (parent role only)
   - Protects /seller-portal/* routes (seller role only)
   - Redirects unauthenticated users to /auth/login
   - Uses Supabase SSR for session checking

8. Create app/layout.tsx as the root layout with:
   - Space Grotesk + Inter + JetBrains Mono Google Fonts
   - Dark background (#05050F)
   - Framer Motion AnimatePresence wrapper
   - Smooth scroll via Lenis

9. Create app/(public)/page.tsx as a placeholder homepage
   with a centered "Lumora" heading and the cosmos background

10. Run npm run build to check everything compiles

Do each step fully before moving to the next.
Confirm when done and show me what was created.
```

---

## AFTER THAT — Next Sessions This Week:

**Session 2:**
```
Read CLAUDE.md. 
Build the complete auth system:
- app/(public)/auth/login/page.tsx
- app/(public)/auth/register/page.tsx  
- app/(public)/auth/callback/page.tsx
- hooks/useSupabase.ts

Registration must ask for role selection: Teacher / Parent / Seller / Buyer
Teacher registration requires paying a registration fee before profile goes live.
Use shadcn/ui form components, React Hook Form, and Zod validation.
All pages must use the Lumora Dark Cosmos design system.
```

**Session 3:**
```
Read CLAUDE.md.
Build the teacher profile system:
- components/teacher/TeacherCard.tsx (discovery card)
- components/teacher/TeacherGrid.tsx (search results)
- components/teacher/TeacherSearch.tsx (filters: subject, price, language, rating)
- app/(public)/teachers/page.tsx (teacher discovery page)
- app/(public)/teachers/[id]/page.tsx (full teacher profile)

Teacher card must show: photo, name, subjects, rating, price, translation badge.
Profile page must show: About, Education, Experience, Subjects, 3 pricing tiers, Reviews.
Fetch data from Supabase teachers table.
Use Framer Motion for card hover animations and page transitions.
```

---

## QUICK REFERENCE — OmniRoute Commands

Start OmniRoute (run in a SEPARATE terminal window):
```
omniroute
```

Connect to Claude Code (run once):
```
claude mcp add omniroute --type http --url http://localhost:20128/api/mcp/stream
```

Start Claude Code in your project:
```
cd lumora
claude
```

Compact a long session:
```
/compact
```
