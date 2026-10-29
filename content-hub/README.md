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
entered; the session lasts 30 days. The clipper portal (`/clip`,
`/api/clip/*`) is the one exception: it checks the clipper's own key
instead. Settings has **Sign out** and a link to
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

## Studio

`/studio` cuts library footage into a finished video, CapCut-style.

- **Start an edit** with New short (9:16, for Reels, TikTok and Shorts) or
  New YouTube video (16:9, 1920×1080; clips come in whole, and its captions
  start in a lower-third YouTube look). Both open on the clip picker. An
  edit also starts from a moment in the footage library (Edit in Studio) or
  a pipeline card (Edit video: linked to the card, takes its title and
  overlay). Any edit can switch shape at the top, and export in several.
- **Shorts from a long video** (Studio › Shorts from a long video, or Find
  shorts on any library video over a minute): Claude (Sonnet 5.5,
  `/api/studio/shorts`) reads the transcript as numbered lines and picks the
  moments that stand on their own (a hook up front, a payoff at the end, no
  "like I said earlier"), 15–30, 30–60 or 60–90 seconds, up to 5, 10 or 20,
  best first, each with a score, a title, the hook to put on screen, a post
  caption and its pillar. Cuts land on the transcript's own line times, never
  a guessed timestamp. Watch any of them, fix a title or hook, untick the
  weak ones, and Make N shorts: each becomes a 9:16 edit with its hook on
  screen and, if chosen, a pipeline card in Editing (caption, hook, where it
  was clipped from), the dead space cut and captions timed word by word.
  What Claude found is kept in that browser per video, so coming back
  doesn't ask again.
- **Timeline**: a ruler to scrub on, the clips (red marks where something was
  cut out), the zooms, the sound's waveform and the music. Zoom in to slice
  precisely; long edits scroll. Drag across the waveform to select a
  stretch, then Cut out (or Delete). Space plays and pauses from anywhere
  but a text box; ← → step a frame (a second with Shift). The playhead
  drags: paused stays paused, playing carries on from where it's let go.
  ⌘Z / ⇧⌘Z undo and redo (a slider drag is one step; every tool is its own).
- **Remove dead space** cuts the silences between what's said from every
  clip (Tight 0.25 s+, Natural 0.45 s+, Loose 0.8 s+, keeping a little air
  either side). Pauses come back with one tap; cuts made by hand stay. The
  waveform is measured in the browser (`lib/studio/peaks.ts`, kept in
  IndexedDB) from the library copy.
- **Auto captions** listen to the clips in the browser and time every word
  (Whisper through Transformers.js, the `_timestamped` models on WASM; same
  CDN as the library). Where word timing can't load, each phrase's words are
  spread across it. Wording can be fixed or hidden per line, for that edit.
- **AI zoom** (Subtle / Normal / Strong): Claude (Sonnet 5.5,
  `/api/studio/emphasis`) reads the captions as numbered words and picks the
  lines an editor would punch in on (the hook, a number, the turn, the call
  to action). Each becomes an eased zoom on its clip; Strong lines zoom
  further. Zoom here adds one by hand at the playhead.
- **Caption styles**: 12 presets (LeadLab bold, Punchy, Wide, Karaoke,
  Boxed, Neon, Bouncy, YouTube…) and then every control: any font (14
  built in, plus uploads), size, italic, caps, letter spacing, colour, the
  spoken word in any colour or with a box behind it (and a grow), outline
  (colour, width), shadow (colour, opacity, blur, distance, angle),
  background box (colour, opacity, roundness, padding, border), words at
  once and height. Animations: pop, bounce, rise, slide, fade, word by word,
  zoom.
- **Hook text**: the banner, in 8 styles (Instagram white, black box, glass,
  lilac, yellow sticker, red caps, outline, wide headline) with the same
  controls as captions, plus position, line width, how long it shows and an
  animation (pop, rise, slide, fade, typewriter). **Line under it** is a
  second line (white on Instagram blue to start; black, white, red, yellow or
  no box in a tap, any style under More styling) that sits right under the
  banner however many lines the banner wraps to, or at its own height.
- **Banner versions for trial reels**: under the banner, **Test other
  banners** lists up to 10 lines (A to J), everything else the same. **Write
  with Claude** (Sonnet, `/api/studio/hooks`) adds lines that each take a
  different hook type, told what's said in the clip, the line under it and
  the lines you already have. Tap a letter to see that one on the video.
  Export then makes every version at once ("<title> B 9x16"), and **Save to
  Footage and line up N trial reels** puts each in Footage › Exports (not
  re-transcribed) and on the calendar as one trial reel test: one account,
  minutes apart, one caption. On Today, each version has its own **Video**
  button: on a phone it opens the share sheet (Save Video, or straight to
  Instagram), on a computer it downloads.
- **Fonts**: Druk Wide is a paid Commercial Type font, so it can't be built
  in: upload the licensed .otf (Captions or Hook text › Font) and the whole
  team can use it. Unbounded Black is the free wide stand-in. Uploads live
  in shared storage under `studio/fonts/`.
- **Music**: upload a song or sound (or pick one the team uploaded, under
  `studio/audio/`), set its volume, where in the song to start, and fade
  in/out. The clips' own sound has its own volume (up to 200% in the
  export).
- **Export** 9:16, 4:5, 1:1 and 16:9. The video is made in the browser
  (Mediabunny + WebCodecs): each clip is streamed from the library, drawn
  frame by frame with the same `drawFrame` the preview uses, and encoded as
  MP4 (H.264/AAC) where the browser can, WebM (VP9/Opus) otherwise. Sound
  is made in 8-second windows ahead of the frames. An edit over 3 minutes
  asks where to save first (Chrome/Edge) and streams to that file, so a
  long YouTube video never has to fit in memory. Short exports download and
  can be saved to Footage › Exports for the team.

Edits are small records (no video in them) in the shared hub, so the team
sees and edits the same ones. Code: `src/lib/studio/` (`types.ts` model and
segments, `captions.ts`, `render.ts`, `export.ts`, `ops.ts` the tools,
`peaks.ts`, `fonts.ts`, `presets.ts`), `src/components/studio/`,
`src/app/studio/`, `src/app/api/studio/`.

## Calendar

`/calendar`, four tabs:

- **Calendar**: week and month views of every post (planned, posted,
  skipped), every card's due date and every recording day. Drag any of them to
  another day; times stay the same. One video on many accounts shows as one
  line ("×13"); open it for the posting checklist. Recorded videos with
  nothing scheduled wait in **Ready to schedule**: drag one onto a day. A
  heads-up shows when next week is short of the goals.
- **Recording days** (batch mode): plan a session, line up 5 to 10 scripts
  (one tap adds everything Ready to record, or ask Claude what to record),
  then **Start recording**: the teleprompter runs them back to back
  (← → between scripts) and each one ticked moves its card to Recorded.
- **Weekly review**: the week's numbers (videos posted, views logged, days
  active, goals, best posts), four questions (what worked, what didn't, what
  you learned, the focus for next week) and **Draft my review**: Claude reads
  the week and writes double down / drop / test next. The latest review's
  focus goes to Claude with every request.
- **Goals**: videos a week per platform and pillar. A video counts once per
  platform however many accounts it goes to (100 clipping pages posting one
  reel is one Instagram post toward the goal).

## Analytics

`/analytics`, four tabs:

- **Results**: posts, views, shares, saves and follows for 7 / 30 / 90 days
  against the period before, and every post's numbers in a sortable table.
  Numbers are typed in from the app's insights (the platforms only share them
  with a connected app, which is Phase 5): one post at a time, or every post
  waiting on one **Log results** sheet. "12.4k" works. Logging results moves
  the card to Analysed.
- **What's working**: the median per post (so one viral video doesn't flatter
  its group) by hook type, pillar, length, platform, time and day posted,
  overlay text, trending sound, account type and trial reel, for views,
  % watched, shares, saves or follows. Groups under 3 posts are faded.
  **Tag hook types** has Claude (Haiku, `/api/analytics/hooks`) sort every
  card's hook into the hook library's types; each can be changed on its card.
- **Trial reel tests**: two to ten versions of one thing (the line on
  screen, the spoken hook, the caption, the sound…), each planned as an
  Instagram trial reel. Banner tests made in Studio (above) come with each
  version's video. Log each version's numbers, pick the winner (it says when
  the gap is too small to trust, and waits until every version has numbers)
  and put it on the card; a Studio banner test puts it back on screen in the
  edit too. What a test taught you goes to Claude.
- **Trending audio**: sounds spotted in the app, from spotted to saved to
  used to faded, with how posts using each did. The platforms don't let other
  apps attach their music, so a post with a sound reminds whoever posts it to
  add it in the app. **Ask Claude what's trending** searches the web.

**Feedback into Claude**: once 3 posts have views, every Claude request
carries a short summary of what has performed (best hook types, pillars,
lengths, times, top posts, what tests taught), the goals and this week's
progress, what's scheduled, the next recording day and the last review's
focus (`lib/insights.ts` `performanceSummary`, `lib/plan.ts` `planSummary`).
An open card also sends its posts and results.

## Accounts and scheduling

`/accounts` keeps your main profiles and every clipping page: paste handles
or links (a hundred at once), pick the platform, main or clipping, a group
("IG clips A") and what they post. Only handles are stored, never logins.

**Schedule** (from the Calendar, a card's Posts tab, or Accounts) sends one
video to many accounts: tick whole groups or single accounts, the first time,
the minutes between posts and a random ± so clipping pages never post in the
same minute or on a visible beat (held to 30% of the gap, so no two land
closer than 40% of it). **A caption per account** has Claude
(Sonnet, `/api/plan/captions`) write different captions per platform, which
take turns across the accounts. Posts can carry a trending sound and go out
as trial reels.

Until a posting service is connected (the last step), posting is a
checklist: **Today › Posting today** lists what's due with the caption to
copy and the account to post from; tick it off, or mark a whole group posted
at once. The first post moves its card to Posted.

## Clipping

`/clipping` runs a team of clippers who post your clips from their own
accounts and get paid only for real views from the United States.

**Clippers** each get a private link (`/clip#k=…`, no hub password): the
clips to post, their accounts, their posts and earnings, and a leaderboard.
Copy the link from the Clippers tab and send it to them; **New link** cuts
off the old one, and removing a clipper turns their link off. A clipper's
link opens only their own records, never the rest of the hub.

**Drops** send a clip to every clipper at once: a video from the footage
library (exports first), hooks and captions (Claude writes caption variants),
a brief, the platforms, a rate per 1,000 US views (or each clipper's own), a
cap per post and a budget. Each clipper sees the hooks and captions in a
different order, so a hundred pages don't post the same words.

**What a clipper sends:** they add each account with a screenshot of
the profile and Instagram's "About this account" (just the profile on other
platforms), which Claude reads for the handle, where it's based, when it
joined and its followers.
For each post, the link and screenshots of its insights: Claude (Sonnet,
`src/lib/proofs.ts`) reads the views, likes, comments, shares, saves, reach
and the viewers' countries, and notes anything that doesn't add up. Typed
numbers fill gaps; a typed number that disagrees with the screenshot is
flagged. They send a fresh screenshot later with **Update numbers**.

**Review** (`src/lib/clipping.ts` `flagsFor`) marks each post Likely fake,
Check it or Looks clean: the same link twice, views that went down between
readings (the platform removing fake views), likes + comments + shares under
0.4% of 5,000+ views, an account based abroad, under 20% (or 50%) US viewers,
no country breakdown, no screenshots, a screenshot showing another handle, a
new account with 50k+ views, every view on day one then nothing, and
Claude's own concerns. Approving pays views × US share ÷ 1,000 × the rate,
capped per post and by what's left of the drop's budget. **Approve N clean
posts** does the clean ones past their hold in one go.

**Payouts:** an approved post is payable 7 days after it went up
(`HOLD_DAYS`), long enough for fake views to be cleaned out and show. Pay
makes a payout of a clipper's payable posts; download the spreadsheet, send
the money however you pay them, then **Mark paid**. Money never goes through
the hub.

**Overview:** this month's views, verified US views, money owed, posts
waiting to be checked (and how many look fake), clippers ranked by verified
US views, and where every account is based.

What the screenshots can't promise: a screenshot can be edited. The flags
catch what bought views usually leave behind, and the 7-day hold catches
views the platform removes, but the real fix is the platforms' own numbers:
connecting each account through the Instagram Graph API (reach by country)
and TikTok's Business API (audience countries) would replace the
screenshots. TikTok doesn't show where an account was made, only its profile.

The hub never creates accounts: Instagram and TikTok ban accounts made in
bulk, and the ones linked to them, in waves. Accounts are made by hand by
the team or the clippers, then added here.

## On your phone

Open the hub in Safari, tap Share → **Add to Home Screen**. It opens full
screen with its own icon, like an app. In Chrome on a laptop, use the install
icon in the address bar.

## What's in Phase 1

| Screen | What it does |
| --- | --- |
| Today | What's posting today (the checklist), this week's goals, the next recording day, results and weekly-review nudges, this week vs last week, up-next queue, consistency grid and streaks, pipeline bottleneck, pillar mix |
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

The calendar, results, tests, sounds, goals, recording days, reviews,
accounts, clippers, drops, clippers' posts and payouts are shared the same
way (one record per post, account, test…). Clippers' routes write to the
same document on the server (`src/lib/hubServer.ts` `changeHub`), and their
proof screenshots sit privately under `clipping/proof/`, shown only to
someone signed in.

Studio's uploaded fonts and music sit in the same store, under
`studio/fonts/` and `studio/audio/`, for the whole team.

Use **Settings → Download backup** to keep a copy any time. The claude.ai
copy has no server, so it keeps its data in that browser.

## Roadmap

1. **Shell + writing system** (this)
2. Studio (built): the searchable footage library, editing, auto captions, AI zoom, overlays, music, exports, repurposing long videos into shorts
3. Calendar and habit (built): calendar, posting goals, batch recording days, weekly review
4. Analytics and testing (built): results per post, what's working, trial reel A/B tests, trending audio, results fed back into Claude
5. Accounts and publishing: accounts, groups and multi-account scheduling with staggered times and caption variants (built, posted from a checklist); next, connecting a posting service so posts go out on their own
6. Clipping network (built): clippers' private links, drops, proof read by Claude, fake-view flags, pay for US views only, payouts. Next: connecting clippers' accounts through the platforms' APIs in place of screenshots

## Code map

- `src/app/*/page.tsx`: one file per screen
- `src/app/api/claude/route.ts`: the server route that talks to Claude (streams thinking, text, searches and sources)
- `src/lib/chats.ts`: saved chats and the send/stream/stop logic; `src/components/chat/`: the chat UI
- `src/lib/store.ts`: all hub data and actions (Zustand, saved to localStorage)
- `src/lib/studio/`, `src/components/studio/`: the Studio editor (see Studio above)
- `src/lib/plan.ts`: posts, goals, staggered times, marking posted, Claude's plan summary; `src/components/plan/`: calendar, schedule and post dialogs, recording days, weekly review, goals
- `src/lib/insights.ts`: results compared by hook type, pillar, length and time, test winners, Claude's performance summary; `src/components/analytics/`: the Analytics tabs and the test dialog
- `src/lib/clipping.ts`: the clipping rules (flags, pay, hold, links), shared by the portal and the Clipping screen; `src/lib/proofs.ts`: Claude reading screenshots; `src/lib/clipServer.ts`: the portal's key check, rate limit and proof storage; `src/app/clip/`, `src/app/api/clip/`: the clipper portal; `src/components/clipping/`: the Clipping tabs
- `src/lib/hubServer.ts`: reading and writing the shared document on the server (used by `/api/hub` and the clipper routes)
- `src/lib/hookTypes.ts`: the hook library's type names (a small copy of research.json's)
- `src/lib/sync.ts`: team sync in the browser; `src/lib/hubsync.ts`: the shared document and its merge rules; `src/app/api/hub/route.ts`: the server side
- `src/lib/seed.ts`: starter ideas, story prompts and your first voice samples
- `src/lib/antiAi.ts`: the phrases that make writing sound generated
- `src/lib/research.json`: the coach, hook and overlay research
- `src/components/shell/`: sidebar, Claude panel, command palette
