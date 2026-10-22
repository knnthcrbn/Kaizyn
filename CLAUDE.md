# Notes for Claude

## Design library

**Constellation background: the user's favourite theme (saved Oct 2026).**
When asked about designs made in the past, or for "that background with the
floating stars where the cursor pulls the lines together", this is the one.
Offer it first for new landing pages, recoloured for the brand.

- Floating nodes that twinkle and drift upward, link up when they pass close,
  and reach for the cursor, over a dark page with a soft brand-coloured glow.
- Reusable code: `design-library/constellation-background.html` in the
  LeadLab-RevOPs repo (recolour with `data-color`, `data-color-2`, `data-bg`,
  `data-density`).
- Live demo with brand presets and a copy-code button:
  https://claude.ai/artifact/7MzEYN3cxkSeRSUond5Wyy

## Pages in this repo

- `you-are-worthy/`: "You are worthy, and God loves you" page for ClickFunnels
  (dark starfield, gold serif headline). Paste `clickfunnels-embed.html` into a
  Custom Code element; `index.html` is the standalone preview.
- `content-hub/`: the Content Hub app (Next.js 16, Tailwind 4, Zustand). The
  brand is black and purple (**#B2B1FF**, exact value confirmed), but that is
  the brand, not the whole UI palette. The app is a neutral dark UI with real
  colour where it means something (green up / red down, pillar colours,
  status). Purple is only for the logo and Claude/AI actions. Tokens live in
  `src/app/globals.css`. Claude runs through `src/app/api/claude/route.ts`. Roadmap order
  is deliberate: social account connections and publishing come LAST (Phase
  5); don't ask for account details before then. `BUILD-PROMPT.md` is the
  full brief. A private hosted copy lives at
  https://claude.ai/artifact/QdLdoiqSi1cYKSP9ipn5iD: rebuild with
  `npm run build:artifact` and republish `artifact-dist/content-hub.html` to
  that URL (Claude there uses the `sample` capability; backups use
  `downloads`). Live on Vercel: https://content-hub-theta-one.vercel.app (project
  `content-hub`, team "Kenneth Corbin's projects"). It is NOT linked to GitHub,
  so a push deploys nothing: redeploy with the Vercel connector's
  `create_deployment` (gitSource knnthcrbn/Kaizyn, ref `main`, root
  `content-hub`). Sign-in password is the `HUB_PASSWORD` env var there; Claude
  needs `ANTHROPIC_API_KEY` added the same way. Vercel's own login wall covers
  previews only, so production shows the app's sign-in.
