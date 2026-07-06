# Skill: Teacher Profile Builder

Rules for any component or page touching teacher profiles (Layer 1). These are firm — do not deviate without checking with the user first.

## Teacher Card (discovery grid)
Component: `TeacherCard.tsx`

Must show, in this order:
- Photo
- Name
- Subjects — max 3 tags (never render more than 3; overflow becomes "+N")
- Rating
- Starting price
- Translation badge (`✦ Multilingual`) — only if admin has enabled translation for this teacher

## Teacher Profile Page
Component: `TeacherProfile.tsx`

Sections, in this order:
1. About
2. Education
3. Experience
4. Subjects
5. Session Plans — exactly 3 tiers (Basic / Standard / Premium), never fewer or more
6. Reviews
7. Availability

Primary CTA on the profile page is always **"Book Free Demo"** — never "Contact" or "Message" as the primary action.

## Related components
- `TeacherSearch.tsx` — search + filter bar for teacher discovery
- `DemoBookingModal.tsx` — the demo booking flow, opened from the "Book Free Demo" CTA

## Non-negotiables
- Teachers are profiles, not gigs — never reuse marketplace gig components (`GigCard`, `GigPackages`, etc.) for teacher data, and never let a teacher's "Session Plans" tiers be confused with seller gig packages. See [Hayesh three-layer architecture](../../CLAUDE.md) for why these stay separate.
