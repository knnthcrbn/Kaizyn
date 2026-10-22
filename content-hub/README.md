# Content Hub

One place to go from "no idea" to "posted": a pipeline for every video, Claude
built in to write in your voice, and a daily screen that makes creating a habit.

## Design

A neutral dark UI where colour carries meaning, not decoration:

- **Green / red:** up or down vs last week (always with an arrow and sign)
- **Blue / orange / green:** the Business, Lifestyle and Personal pillars
  (checked for colour-blind separation)
- **Amber:** warnings, like the pipeline bottleneck or a date due today
- **Brand purple `#B2B1FF`:** the logo and anything Claude does

Tokens live in `src/app/globals.css`.

`BUILD-PROMPT.md` is the full brief this was built from.

## Open it

A private copy runs on claude.ai: https://claude.ai/artifact/QdLdoiqSi1cYKSP9ipn5iD
(only you can open it). There, Claude runs on your claude.ai account, so no
API key is needed; it asks your permission the first time. Data is saved in
the browser you use it in. The microphone isn't available in that copy.

To update it after changing the code, run `npm run build:artifact` and
republish `artifact-dist/content-hub.html` to the same artifact. The build
bundles the same screens into one page (`src/artifact/`) with in-page
navigation instead of Next.js routes.

## Deploy (recommended: Vercel + Supabase)

The same setup as the Leads Management App, and the natural home for a
Next.js app:

1. **Vercel** (hosting). In vercel.com → Add New → Project, import
   `knnthcrbn/kaizyn` and set **Root Directory** to `content-hub`. Every push
   then deploys on its own.
2. **Environment variables** (Vercel → Project → Settings → Environment
   Variables):
   - `HUB_PASSWORD`: the sign-in password. Leave it unset and the hub is open.
   - `AUTH_SECRET`: any long random string; it signs the session cookie.
   - `ANTHROPIC_API_KEY`: turns on Claude.
3. **Supabase** (next step, not wired yet): a database so phone and laptop
   share the same data, file storage for videos in the Studio phase, and
   email sign-in if a team joins later.

## Sign-in

`/login` is the sign-in screen: the saved constellation background in brand
purple, the logo hovering on a glass tile that tilts toward the cursor, and
pieces of the hub drifting around it (wide screens). `src/proxy.ts` sends
everything else, including the Claude route, to it until the password is
entered; the session lasts 30 days. Settings has **Sign out** and a link to
the screen.

## Run it

```bash
cd content-hub
npm install
npm run dev
```

Open http://localhost:3000.

### Connect Claude

The Claude panel, the voice profile builder and the idea generator need an
Anthropic API key. Get one at console.anthropic.com, then create
`content-hub/.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Restart `npm run dev`. Everything else in the hub works without a key.

## What's in Phase 1

| Screen | What it does |
| --- | --- |
| Today | This week vs last week (ideas, scripts, recordings, posts), up-next queue, consistency grid and streaks, pipeline bottleneck, pillar mix |
| Pipeline | 10-stage board or list (Idea → Analysed). Drag cards; open one to edit hooks, overlay text, script, caption, notes and linked stories |
| Ideas | Ideas by pillar, one-click "script it", and an idea generator for when you're blank |
| Voice Lab | Talk (live transcription in Chrome/Edge/Safari) or paste; builds your voice corpus and voice profile; anti-AI checker |
| Hooks & overlays | 15 hook types and 12 on-screen text patterns with examples per pillar, plus the trial reel testing routine |
| Story bank | Your stories and lessons, with questions to draw them out; "interview me" and "turn into a video" |
| Swipe file | Save videos that stopped your scroll; Claude breaks down the pattern |
| Playbooks | Frameworks from 10 content coaches, plus retention and YouTube packaging principles, with sources |
| Settings | Claude connection status, backup / restore, roadmap |

Every card editor has a **teleprompter** (space to play, arrows for speed,
mirror mode) and Claude actions that write straight into the card.

Shortcuts: `C` capture an idea, `⌘K` / `Ctrl+K` search and jump, `⌘J` /
`Ctrl+J` open Claude, `Esc` close.

## Where data lives

For now, everything is saved in this browser (localStorage). Use
**Settings → Download backup** to keep a copy or move to another computer. A
real database and login come with the later phases, when accounts and
publishing are added.

## Roadmap

1. **Shell + writing system** (this)
2. Studio: editing, auto-captions, overlays, exports, repurposing, B-roll library
3. Calendar and habit: posting goals, batch recording days, weekly review
4. Analytics and testing: results per post, trial reel A/B log, trending audio
5. Accounts and publishing: main + clipping pages, multi-account scheduling

## Code map

- `src/app/*/page.tsx`: one file per screen
- `src/app/api/claude/route.ts`: the server route that talks to Claude (streams replies)
- `src/lib/store.ts`: all hub data and actions (Zustand, saved to localStorage)
- `src/lib/seed.ts`: starter ideas, story prompts and your first voice samples
- `src/lib/antiAi.ts`: the phrases that make writing sound generated
- `src/lib/research.json`: the coach, hook and overlay research
- `src/components/shell/`: sidebar, Claude panel, command palette
