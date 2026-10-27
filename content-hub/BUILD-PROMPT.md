# Content Hub: the build prompt

Paste everything below the line into a new Claude session (Claude Code works
best, since it can build and push the app). Fill in the `[brackets]` first, or
leave them and Claude will ask.

---

## Who you are

You're three people in one: a senior product engineer who ships polished,
modern web apps; a short- and long-form content strategist who has studied the
best creators and content coaches working today; and a ghostwriter whose
scripts sound like a real person talking, not like AI.

## Who I am, and why this matters

I run a marketing agency. I know content is king, and I'm not making any. That
makes me unhappy. I've tried, it's hard, and every AI script I get back sounds
robotic and too polished. Atomic Habits says you don't rise to your goals, you
fall to the level of your systems. I don't have a system. **Build me one**: a
single hub where I can get into flow and go from "no idea" to "posted
everywhere" without friction.

My brand is me, and I'm deliberately **not** niching down. I talk about:

1. **Business**: Facebook/Meta advertising, marketing, sales, leadership,
   managing a team, hiring, general business sense, what we're learning
   running our agency.
2. **Lifestyle**: B-roll and clips with a text overlay that people relate to
   and want to repost. Little or no talking.
3. **Personal story**: life lessons. I [died / was clinically dead] in a
   motorcycle accident and came back, and that shapes how I see everything.
   My relationship with my partner [name, and what they're comfortable having
   on camera]. Other life experiences.

Formats: **short form** (Reels, TikTok, Shorts, trial reels) and **long form**
(YouTube).

My social setup: my main accounts, plus **several Instagram clipping pages**
we run, which I want to publish to from one place. Accounts:
[list handles and platforms].

## What to build: the Content Hub

A web app I can open every day. Treat the items below as requirements, then
push back where something's a bad idea or not technically possible.

### 1. Pipeline (the backbone)
A kanban board and a list view of every piece of content, moving through:

`Idea → Researching → Scripting → Ready to record → Recorded → Editing →
Review → Scheduled → Posted → Analysed`

- Each card holds: pillar (Business / Lifestyle / Personal), format (short /
  long / carousel / text-on-B-roll), target accounts, hook, script, raw
  footage, edited export, caption, hashtags, audio, thumbnail, due date,
  status, and notes.
- Drag between stages; filter by pillar, format, account, and stage.
- Show which stage things get stuck in, so I can see my bottleneck.

### 2. Claude built into the hub
A chat panel docked in the app, available on every screen, using the Claude
API. It must know the context: the card I'm on, my voice profile, my story
bank, my hook library, and what has performed well. It can write straight into
a card (a script, hooks, a caption) when I accept the suggestion.

### 3. Scripting that sounds like me (the most important part)
I don't have a body of writing in my voice yet, so build the system that
creates one:
- **Voice capture.** I talk out loud (voice memo or in-app recording), the
  app transcribes it, and the transcripts become my **voice corpus**. Rambling
  like this prompt is the raw material. Seed the corpus with this prompt.
- **Voice profile.** Generated from the corpus and kept up to date: my
  phrases, rhythm, slang, sentence length, how I open and close, and words I'd
  never say.
- **Anti-AI rules.** Every script is checked against a banned list ("in
  today's world", "let's dive in", "game-changer", "unlock", "here's the
  thing", em-dash-heavy rhythm, groups of three, neat moral at the end, and
  anything else that sounds generated). Keep imperfection: fragments,
  restarts, and the way people actually talk.
- **Script modes:** talking-head short (hook / body / payoff / CTA), YouTube
  long form (title, thumbnail concept, hook, outline with retention beats,
  B-roll cues), text-on-B-roll overlay copy, and story mode (pulls from the
  story bank).
- **Bullet mode.** Sometimes I just want talking points, not a word-for-word
  script, so I sound natural.
- **"Interview me" mode.** Claude asks me questions, I answer out loud, and
  it builds the script from my answers. My words, structured.

### 4. Research and ideas
- **Creator research.** Who are the top content coaches and creators right
  now (short-form and YouTube strategy), and what are their frameworks for
  hooks, retention, and packaging? Summarise them into usable playbooks inside
  the hub, with sources.
- **Hook library.** Proven hook formats grouped by type (contrarian, story,
  mistake, number, curiosity gap, and so on), with examples for each of my
  pillars.
- **Text-overlay / banner library.** On-screen hook text to test on **trial
  reels**: several variants per video, with results logged.
- **Idea generator for when I'm blank:** by pillar, from my story bank, from
  trends in my space, from comments and questions people ask me, and from
  things that happened at the agency this week.
- **Swipe file.** Save a link to a reel or video I liked, and Claude breaks
  down why it works (hook, structure, pacing, payoff).

### 5. Story bank
A searchable library of my life stories and lessons (the accident, business
wins and failures, team moments, relationship lessons), each tagged by theme
and by which lessons it can support. One story can power dozens of videos.

### 6. Editing and export (like the LeadLab Studio we built)
[Describe or link LeadLab Studio here so Claude can reuse its patterns.]
- Trim and cut, text overlays, burned-in **auto-captions** (transcription
  with word-level timing, styled in my brand), and export at 9:16, 1:1, and
  16:9.
- **Repurposing.** Turn one long YouTube video into suggested short clips
  (best moments found from the transcript) and push them into the pipeline as
  new cards.
- **B-roll library.** Upload and tag my lifestyle footage so text-on-B-roll
  posts take minutes. (Now part of the footage library below.)

Built 27 Oct 2026 as the Studio (`/studio`): trim and cut from the footage
library, LeadLab Studio's bold captions (`lead-lab-ai/studio/captions.py`)
from the library's transcripts, hook text from the card, export at 9:16, 4:5,
1:1 and 16:9 in the browser. Captions time each spoken phrase and spread its
words by length rather than true word-level timing. Repurposing is still to
come.

### 6b. Footage library: a searchable catalog of every raw video
(Added 23 Oct 2026, my brain dump.) Like Google Drive for all our raw
footage, but searchable by what's in it, so the editing team can pull clips
that fit the idea they're cutting.
- Drop in raw videos; organise them in folders; segment them.
- Every video gets its transcript extracted, and the hub knows what is
  *shown* in it, not just what's said.
- Anyone on the team (me included) searches a term: "dog", "car", "Tesla",
  "$1 million month", "Fort Lauderdale". Results are the moments in the
  videos where it's said or shown, filterable, so an editor jumps straight to
  the clip.

Built 23 Oct 2026; how it works is in the README under "Footage library".
Storage ended up as a private Vercel Blob store rather than Supabase.

How we'd build it (Claude's notes, before building):
- Transcript with word timestamps per video (speech-to-text; Claude can't
  take audio).
- What's on screen: frames every ~2 seconds, described by Claude (people,
  objects, cars and brands, setting, on-screen text), grouped into shots.
  Haiku 5.5 makes this cheap, roughly 15-25¢ per hour of footage.
- Where and when: phone footage carries GPS and a date, so "Fort Lauderdale"
  can come straight from the file, not a guess.
- Search by keyword and by meaning ("a million a month" finds "$1M month"),
  with filters for folder, pillar, date, place, and said vs shown. A result
  plays from that second and can open in the Studio as a clip.
- Needs a shared backend: video storage, a database and team logins
  (Supabase is the plan), plus a processing worker for big files. If the
  footage already lives in Google Drive, the hub can index those folders
  instead of re-uploading.

### 7. Audio
I want trending audio. **Be honest about the limits.** The official
Instagram and TikTok APIs generally don't let a third-party app attach their
in-app music library to a post. Design the best workable option. For example:
a trending-audio tracker that tells me which sound to add in-app at publish
time, a "finish in app" handoff, and/or a royalty-free/licensed library for
posts that go out fully automated. Verify the current API rules before
deciding.

### 8. Scheduling and multi-account publishing
- Connect all my accounts: Instagram (main and clipping pages), TikTok,
  YouTube, Facebook, and [LinkedIn / X / Threads?].
- Schedule one post to many accounts, with **per-account caption variants**
  and **staggered times**, so clipping pages don't post identical content at
  the same minute.
- Calendar view (week and month) with drag-to-reschedule.
- Captions and hashtags per platform, with Claude drafting them.
- Evaluate building directly on the Meta Graph / TikTok / YouTube APIs
  (requires app review and business accounts) against a unified posting API
  (e.g. Ayrshare, Upload-Post, or similar). Recommend one with cost and
  trade-offs.

### 9. Analytics feedback loop
Pull views, retention, shares, saves, follows, and comments per post back
into its card. Tag what worked (hook type, pillar, overlay variant, audio,
length, post time) and feed it back into ideation and scripting, so the
system gets smarter about **my** audience every week.

### 10. Built for the habit, not just the tool
- **Today view**: the one screen I open. What to record, what to review,
  what's posting, and my streak.
- **Batch mode**: plan a recording day. Line up 5–10 scripts, then use a
  built-in **teleprompter** to record them back to back.
- **Quick capture** from my phone (mobile-friendly or PWA): voice note,
  link, or thought straight into the Idea column.
- **Posting cadence goals** per pillar and platform, with a weekly review
  ritual (what worked, what's next).
- Streaks and progress, because I need momentum.

## Design
- Dark theme; modern, minimal, clean, the way a Fortune 500 product would
  look (think Linear, Vercel, Stripe).
- My brand is black and purple (**#B2B1FF**, exact value), but the app
  shouldn't be all black and purple. Use a neutral dark base and real colour
  where it carries meaning: green for up, red for down, distinct colours for
  categories and status. Keep purple as a brand touch.
- Keyboard-first (command palette on ⌘K), fast, and smooth micro-animations.

## Team and access (confirm)
[Is this just me, or will editors / a VA / clippers use it? If others will,
add roles: owner, editor, and clipper; per-card assignment; and
review/approval comments in the Review stage.]

## How I want you to work
1. **Don't start coding yet.** First ask me every question you need answered
   (keep it to one tight list). Then propose: the architecture, the stack,
   the third-party services and their monthly cost, and a **phased roadmap**
   where Phase 1 is something I can use this week.
2. A suggested phase order, which you can change if you justify it:
   - **Phase 1**: pipeline board, Claude panel, voice capture and voice
     profile, scripting modes, hook library, story bank, Today view.
     (This alone gets me creating.)
   - **Phase 2**: footage library first (6b), then editor,
     auto-captions, exports, repurposing.
   - **Phase 3**: calendar, posting goals, batch recording days, weekly
     review.
   - **Phase 4**: analytics loop, trial-reel testing, trending-audio
     tracker.
   - **Phase 5 (last)**: account connections, scheduling, multi-account
     publishing. Account details come at this step, not before.
3. Do the creator and hook research for real (search the web, cite sources).
   Don't rely on memory.
4. Flag anything that platform rules make impossible or risky, and offer the
   closest alternative.
5. Then generate my **first 10 video ideas** (spread across all three
   pillars), each with 3 hook options and an overlay-text variant, so I can
   start creating today while the hub gets built.
