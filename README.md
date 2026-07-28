# تريس · TRES

Homepage for **TRES** — a specialty coffee shop in Taif (الطائف). Arabic-only, RTL.
Built from the Claude Design handoff bundle (`TRES Homepage.dc.html`), recreated
pixel-faithfully in **Next.js 16 (App Router) + React 19**.

## Brand

| token | value | use |
| --- | --- | --- |
| burgundy | `#700D28` | primary background / ink |
| burgundy-deep | `#5A0A20` | origins section, scrolled nav |
| burgundy-darkest | `#3A0714` | footer |
| blush | `#EFB4A2` | accent, CTAs, headings |
| cream | `#F7F0EA` | text on dark, menu section bg |
| rose | `#F3D9CF` | body copy on dark |

Fonts: **Helvetica Neue Arabic** (display, local), **IBM Plex Sans Arabic**
(body), **Space Grotesk** (Latin labels) — all via `next/font`.

## Sections

Hero (spinning text ring + floating mascot) · Origins (3 cards) · Menu
(sticky signature + price list) · Story (Shubra Palace) · CTA band · Footer.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

Brand assets live in `public/assets/` (mascot, building, Arabic font).

## Staff operations

The staff dashboard is available at `/staff`, daily report and operations
forms are under `/staff/submissions`, and supervisor/shift-manager reporting is
under `/staff/reports`. The owner bootstrap screen for branches, staff
accounts, and daily duties is at `/admin/operations`.

1. Copy `.env.example` to `.env.local` and set the Supabase/admin values.
2. Apply all SQL migrations:

```bash
node scripts/db-migrate.mjs
```

3. Sign in to `/admin`, create a branch, then create staff accounts.

Static security and role-boundary checks:

```bash
npm run test:staff:static
```

See [`docs/staff-operations-plan.md`](docs/staff-operations-plan.md) for the
codebase gap analysis, role matrix, rollout notes, and remaining stages.

## Next up (from the design brief)

Inner pages — **المنيو / قصتنا / فروعنا** — in the same direction.
Branches, hours, and social links in the footer are placeholders pending real data.
