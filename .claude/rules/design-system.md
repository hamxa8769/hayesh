# Hayesh Design System — "Obsidian Aurora"

The single source of truth for all Hayesh UI. Every screen, component, and agent-built page must derive its color, type, spacing, motion, and depth from this file. This **replaces** the old "Dark Cosmos" system — never reintroduce cosmos/particle/violet-cyan styling.

## Mood
A sleek control-room for a premium AI-powered education product. Deep obsidian, precise, technical, calm — with luminous **aurora** energy (jade→gold) reserved for moments that matter. Dark-committed (single theme). Restraint everywhere except one bold aurora moment per view.

## Color tokens
Defined as CSS variables in `app/globals.css` under Tailwind v4 `@theme`. Never hardcode hex in components — use the token utilities.

```
--color-ground:      #08090C   /* obsidian page ground */
--color-surface:     #10131A   /* cards, panels */
--color-surface-2:   #171B24   /* elevated / hover */
--color-line:        rgba(232,234,240,0.08)  /* hairline borders */
--color-line-strong: rgba(232,234,240,0.14)

--color-jade:        #27C4A0   /* aurora start — primary accent */
--color-gold:        #F5B84E   /* aurora end — warm accent */
--color-text:        #E8EAF0   /* primary text (cool white) */
--color-text-muted:  #8B93A3   /* secondary text */
--color-text-faint:  #565E6E   /* tertiary / disabled */

/* semantic — SEPARATE from the aurora accent, never used decoratively */
--color-success:     #34D399
--color-warning:     #FBBF24
--color-danger:      #F76A6A
--color-info:        #56B6FF
```

**Aurora gradient** (the signature): `linear-gradient(110deg, #27C4A0 0%, #5AD1B0 40%, #F5B84E 100%)`. Use for the hero WebGL, one headline word, key CTA fills, active-nav underlines, and focus glows — sparingly. Everything around it stays quiet obsidian + hairlines.

## Typography — Geist family
Install via the `geist` npm package (`GeistSans`, `GeistMono` with next/font). One family for cohesion; weight + size carry hierarchy.

- **Display / headings**: Geist Sans, weight 600–700, tight tracking (`-0.02em`), `text-wrap: balance`.
- **Body**: Geist Sans 400–500, line-height 1.6, measure ~65ch for prose.
- **Data / labels / code**: Geist Mono. Uppercase eyebrow labels get `letter-spacing: 0.12em`, size 12px, `--color-text-muted`. Use `font-variant-numeric: tabular-nums` for all aligned numbers (prices, stats, tables).

Type scale (rem): 0.75 / 0.875 / 1 / 1.125 / 1.375 / 1.75 / 2.25 / 3 / 4. Stay on the scale.

## Depth, radius, shadow
Technical and precise — NOT soft/rounded-everywhere.
- Radius: `--radius-sm 6px`, `--radius 10px`, `--radius-lg 16px`. Never fully-rounded cards.
- Borders: 1px hairline `--color-line`; elevate with `--color-line-strong` + `--color-surface-2` on hover, not heavy shadows.
- Glow (used sparingly on interactive/aurora elements): `--glow-jade 0 0 24px rgba(39,196,160,0.25)`, `--glow-gold 0 0 24px rgba(245,184,78,0.22)`.
- Elevation shadow (panels): `0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 30px rgba(0,0,0,0.5)`.

## Motion
- Libraries: Framer Motion (component motion), Lenis (smooth scroll), react-three-fiber (3D). All already installed.
- Signature 3D: **AuroraField** — a bespoke WebGL shader ribbon (jade→gold) that drifts and reacts subtly to cursor/scroll, behind the hero. This is the "more 3D" wow; never a particle starfield.
- Entrances: fade + 12px rise, 0.5s, cubic-bezier(0.22,1,0.36,1), staggered per group. Scroll-reveal for sections.
- Hover: 150ms; lift via border/surface shift + faint glow, not scale-jumps.
- **Always** honor `prefers-reduced-motion` — freeze the shader to a static aurora frame and drop entrance transforms.

## Layout
- 12-col fluid grid, max content width 1200px (marketing) / full-bleed dashboards.
- Space with flex/grid `gap`, never per-element margin stacks.
- Generous negative space on obsidian; let the aurora and one strong headline breathe.
- Wide content (tables, charts, code) scrolls inside its own `overflow-x:auto` container.

## Dashboards (the "3D animated smooth dashboard")
- Scanned, not read: summary before detail. Stat tiles in a KPI row up top, each with label (mono, uppercase), big tabular number, and a sparkline with an emphasized aurora endpoint + faint grid.
- Encode state in form + color: status pills/severity stripes using semantic tokens (never the aurora accent).
- Shared dashboard chrome: collapsible left rail, top bar, animated panel mounting (Framer layout), glass-obsidian panels with hairline borders.
- Charts: Recharts, themed to tokens — area fills with aurora gradient at low opacity, faint grid, emphasized endpoints. Follow the `dataviz` skill for palette/marks.

## Guardrails (avoid AI-generic)
- No particle starfields, no violet→cyan, no purple-blue gradient hero, no Inter/Space Grotesk, no emoji section markers, no everything-centered, no rounded-lg on everything, no accent-bar-on-rounded-card.
- Numbered markers (01/02/03) only where content is a true sequence.
- One aurora moment per view; the rest is quiet obsidian precision.
