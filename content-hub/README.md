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

## Deploy

Live at **https://content-hub-theta-one.vercel.app** (Vercel project
`content-hub`).

- The project is not linked to GitHub (the Vercel GitHub app isn't installed
  on this account), so a push does not deploy. Redeploy from `main` with
  Vercel → Deployments → Redeploy, or ask Claude to deploy it.
- **Environment variables** (Vercel → Project → Settings → Environment
  Variables), then redeploy for a change to take effect:
  - `HUB_PASSWORD`: the sign-in password. Leave it unset and the hub is open.
  - `AUTH_SECRET`: any long random string; it signs the session cookie.
    Changing it signs everyone out.
  - `ANTHROPIC_API_KEY`: turns on Claude (not set yet).
- Vercel's own login wall applies to preview deployments only, so production
  shows the hub's sign-in screen.
- **Supabase** (next step, not wired yet): a database so phone and laptop
  share the same data, file storage for videos in the Studio phase, and
  email sign-in if a team joins later.

## Sign-in

`/login` is the sign-in screen: the saved constellation background in brand
purple and the logo hovering on a glass tile that tilts toward the cursor.
`src/proxy.ts` sends
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

Claude needs an Anthropic API key (console.anthropic.com → Billing, then API
Keys). On Vercel, add it as `ANTHROPIC_API_KEY` under Settings → Environment
Variables and redeploy. Locally, put it in `content-hub/.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

API use is billed per reply, separately from a Claude subscription. Each reply
shows its estimated cost, and Settings shows the month's total. Everything
else in the hub works without a key.

## Claude in the hub

`/chat` is Claude full screen, meant to replace opening the Claude app; the
**Ask Claude** panel (⌘J) shows the same chats beside any screen.

- **Model and effort** under the message box: Opus 5.5 (default), Sonnet 5.5,
  Haiku 5.5, Fable 5.1; effort Low to Max. A new chat starts with whatever
  was used last. The list and prices live in `src/lib/models.ts`.
- **Web search** (globe) lets Claude look things up and read links, with
  sources under the answer. **Hub context** (layers) sends your voice
  profile, samples, stories and the open card; turn it off for plain Claude.
- **Attachments**: images and PDFs (up to 4.4 MB, uploaded once to
  Anthropic's Files API) and text files (sent inline). Paste or drop them in.
- Thinking is shown as a summary you can expand. Chats are saved in this
  browser (IndexedDB), searchable, and included in the backup.

## Footage library

**Footage** (`/library`) holds the team's raw video: drop videos or whole
folders in (sub-folders are kept), organise them in folders, and search what
was said or shown. Typing "Tesla", "$1 million a month" or "Fort Lauderdale"
lists the moments, each with a thumbnail and timestamp; clicking one plays
from that second. A moment can be linked, or added to a pipeline card.

How each video becomes searchable, all in the uploader's browser while the
file uploads (keep the tab open until it says Searchable):

- **Said:** Whisper (Transformers.js, loaded from its CDN on first use, the
  ~80 MB model then cached) transcribes it with timestamps. Free, private.
- **Shown:** a frame every 1-5 seconds goes to Claude Haiku 5.5, which groups
  them into shots and describes each (people, objects, cars and models, the
  setting, on-screen text) with search tags. Roughly 15-25¢ per hour of footage.
- **Where and when:** read from the file's own GPS and date tags (iPhone and
  most Android phones), and the place named ("Fort Lauderdale, Florida").
- **Smart search** asks Claude for other ways the search might have been said
  ("a million a month" for "$1 million month").

Videos live in a private Vercel Blob store (`content-hub-footage`) and only
reach a browser through the signed-in hub (`/api/library/file`, with Range
for scrubbing). Records are JSON per video in the same store, so the whole
team sees the same library. Without `BLOB_READ_WRITE_TOKEN` (local
development) everything goes to `.footage-dev/` on disk instead. Any
teammate can re-run processing on a stored video ("Process now"/"Process
again"), reading it from storage. Code: `src/lib/footage/`,
`src/app/api/library/`, `src/app/library/`.

## On your phone

Open the hub in Safari, tap Share → **Add to Home Screen**. It opens full
screen with its own icon, like an app. In Chrome on a laptop, use the install
icon in the address bar.

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

The hub is shared. Everyone who signs in sees the same cards, stories, voice
notes, voice profile, swipe file and streak, and the same footage library.
Claude chats stay on each device (IndexedDB).

**Team sync** keeps each browser's copy in step with one document on the
server, `hub/state.json` in the same private Blob store as the footage
(`.footage-dev/` when run locally):

- Edits save in the browser first, as before, then go up a few seconds
  later (batched while typing, sent at once when the tab is hidden). Other
  people's edits come down every minute while someone is using the tab, and
  whenever it comes back into view. The cloud in the top bar shows the state;
  click it to sync now.
- Every save and check is a Blob operation the Vercel plan counts, so a tab
  nobody has touched for 5 minutes stops checking, and the server answers
  repeat checks from memory for 20 seconds. Each save numbers the hub
  (`rev`), so a browser never steps back to an older copy.
- Each card, story, voice note and swipe item keeps its own `updatedAt`, and
  the newest copy wins, one record at a time. Two people working on
  different cards never collide. If two people edit the *same* card in the
  same minute, the later save wins the whole card.
- A deleted record leaves a dated tombstone, so a browser with an old copy
  can't bring it back.
- Offline edits wait in the browser and go up when it's back online.
- The server writes only if nobody wrote in between (Blob `ifMatch`), and
  otherwise re-reads and merges again, so simultaneous saves all land.
- **Reset** and **Restore from backup** replace the hub for the whole team.
  They start a new generation, and every browser takes it on its next sync.
- The first time a browser syncs, it merges what it had with the team's
  hub. Starter cards nobody touched follow the team.

Use **Settings → Download backup** to keep a copy any time. The claude.ai
copy has no server, so it keeps its data in that browser.

## Roadmap

1. **Shell + writing system** (this)
2. Studio: the searchable footage library (live), then editing, auto-captions, overlays, exports, repurposing
3. Calendar and habit: posting goals, batch recording days, weekly review
4. Analytics and testing: results per post, trial reel A/B log, trending audio
5. Accounts and publishing: main + clipping pages, multi-account scheduling

## Code map

- `src/app/*/page.tsx`: one file per screen
- `src/app/api/claude/route.ts`: the server route that talks to Claude (streams thinking, text, searches and sources)
- `src/lib/chats.ts`: saved chats and the send/stream/stop logic; `src/components/chat/`: the chat UI
- `src/lib/store.ts`: all hub data and actions (Zustand, saved to localStorage)
- `src/lib/sync.ts`: team sync in the browser; `src/lib/hubsync.ts`: the shared document and its merge rules; `src/app/api/hub/route.ts`: the server side
- `src/lib/seed.ts`: starter ideas, story prompts and your first voice samples
- `src/lib/antiAi.ts`: the phrases that make writing sound generated
- `src/lib/research.json`: the coach, hook and overlay research
- `src/components/shell/`: sidebar, Claude panel, command palette
