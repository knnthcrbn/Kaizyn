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
  needs `ANTHROPIC_API_KEY` added the same way. Claude chat (`/chat` and the
  ⌘J panel) is meant to stand in for the Claude app: model and effort
  pickers, web search, attachments, saved chats (IndexedDB, one entry per
  chat). Models and prices: `src/lib/models.ts`. Earlier turns go back to the
  API as text only, never replayed thinking blocks. Vercel's own login wall covers
  previews only, so production shows the app's sign-in. The footage
  library (`/library`, built 23 Oct 2026) is live: private Vercel Blob store
  `content-hub-footage` (BLOB_READ_WRITE_TOKEN; `.footage-dev/` on disk when
  it's absent), processing in the uploader's browser (Mediabunny for frames,
  audio and GPS/date tags; Whisper via Transformers.js from jsDelivr; Claude
  Haiku 5.5 describes frames). The sandbox's Chromium can't decode H.264/AAC,
  so test with VP9/Opus WebM clips. Details in the README. Team sync (built
  23 Oct 2026): cards, stories, voice notes, voice profile and swipe file are
  one shared document, `hub/state.json` in that Blob store, merged per record
  by `updatedAt` with tombstones (`src/lib/hubsync.ts`, `src/lib/sync.ts`,
  `/api/hub`). Every store action that changes a record must bump its
  `updatedAt`, or the change never syncs. Reset and restore replace the hub
  for everyone. Test sync against `next build && next start`: on 23 Oct
  `next dev` kept reloading itself in the sandbox. Studio (`/studio`, built
  27 Oct 2026): edits are a synced collection (`edits`, `lib/studio/types.ts`);
  preview and export share `lib/studio/render.ts` `drawFrame`, so what plays
  is what exports; export runs in the browser with Mediabunny (MP4 H.264/AAC,
  WebM fallback; the sandbox Chromium only makes WebM). Captions copy
  LeadLab's bold look from `lead-lab-ai/studio/captions.py` (Montserrat
  ExtraBold 108px on 1080, 7px outline, yellow/blue/green spoken word, 3 words
  / 11 letters, y 1130 of 1920). Studio 2 (27 Oct): clips carry `cuts`,
  `zooms` and auto-caption `words`, all in source time (`segments()` turns
  a clip minus its cuts into pieces; use it, not in/out, for edit time);
  dead space, waveform cut, AI zoom (Sonnet 5.5 via `/api/studio/emphasis`)
  and auto captions (word-timestamp Whisper) live in `lib/studio/ops.ts`,
  each one undo step. Fonts and music go to `studio/fonts|audio/` in the
  footage store. Druk Wide is paid: the user uploads their .otf; Unbounded
  is the stand-in. Test auto captions with a fake transformers module routed
  in place of the jsDelivr URL, AI zoom with a mock on ANTHROPIC_BASE_URL.
  If the stored hub is wiped, browsers that
  synced before put everything back (the hub's `rev` going backwards, or no
  stored file, is the signal).
