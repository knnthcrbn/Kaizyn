import type { ContentItem, Pillar, Format, Story, VoiceEntry, ScriptMode } from "./types";

// Starter content so the hub isn't empty on day one. Anything in [brackets] is
// a detail only you know: fill it in before it goes on camera.

const t0 = Date.UTC(2026, 9, 22);

function idea(
  n: number,
  title: string,
  pillar: Pillar,
  format: Format,
  scriptMode: ScriptMode,
  hooks: string[],
  overlay: string,
  notes: string,
  storyIds: string[] = [],
): ContentItem {
  return {
    id: `seed-idea-${n}`,
    title,
    pillar,
    format,
    stage: "idea",
    hooks,
    chosenHook: 0,
    overlay,
    scriptMode,
    script: "",
    caption: "",
    notes,
    storyIds,
    createdAt: t0 + n,
    updatedAt: t0 + n,
  };
}

export const SEED_ITEMS: ContentItem[] = [
  idea(
    1,
    "Why your Facebook ads die after 3 days",
    "business",
    "short",
    "talking-short",
    [
      "Your ad didn't stop working. You ran out of people who care.",
      "If your ads crush for three days then fall off a cliff, watch this.",
      "Most people kill their best ad way too early. This is how I know when to actually turn one off.",
    ],
    "your ad isn't broken. your audience is tired.",
    "Creative fatigue vs. a broken offer. Show a real (anonymised) client chart if you can.",
  ),
  idea(
    2,
    "The person I waited too long to let go",
    "business",
    "short",
    "story",
    [
      "Hiring slow is easy. Firing fast is the part nobody wants to talk about.",
      "If you're asking yourself whether to let someone go, you already know.",
      "The most expensive person on my team was the one I was scared to let go.",
    ],
    "you already know who it is.",
    "Leadership. Keep it about the lesson, not the person. No names.",
    ["seed-story-firing"],
  ),
  idea(
    3,
    "How we actually run Meta ads for a new client (full breakdown)",
    "business",
    "long",
    "youtube-long",
    [
      "This is the exact process we run on every new client account, start to finish.",
      "I'm going to show you what we do in the first seven days of a new ad account.",
      "Most agencies won't show you this, because then you wouldn't need them.",
    ],
    "OUR EXACT PROCESS",
    "Long form. Screen-record Ads Manager with client data hidden. Overlay text doubles as thumbnail text.",
  ),
  idea(
    4,
    "Talk less on sales calls",
    "business",
    "short",
    "talking-short",
    [
      "The best sales call I ever had, I barely said anything.",
      "If you're doing most of the talking on a sales call, you're losing it.",
      "Quit pitching. Ask this one question instead.",
    ],
    "talk less. ask better.",
    "Sales. Pick the one question you actually use and show it.",
  ),
  idea(
    5,
    "Building in silence",
    "lifestyle",
    "broll",
    "broll-overlay",
    [
      "nobody claps for the 6am version of you",
      "they'll see the results. they won't see the nights.",
      "nobody's coming. good. get up anyway.",
    ],
    "nobody claps for the 6am version of you",
    "Early morning B-roll: alarm, coffee, laptop glow, gym. Test each line as a trial reel.",
  ),
  idea(
    6,
    "Your circle",
    "lifestyle",
    "broll",
    "broll-overlay",
    [
      "your circle is either pulling you up or keeping you comfortable",
      "outgrowing people isn't mean. it's just what happens when you grow.",
      "the room you're in is your ceiling",
    ],
    "your circle is either pulling you up or keeping you comfortable",
    "Friends / team / dinner B-roll. Built to be reposted.",
  ),
  idea(
    7,
    "What running an agency actually looks like",
    "lifestyle",
    "broll",
    "broll-overlay",
    [
      "pov: you run a marketing agency and your phone never stops",
      "what 'being your own boss' actually looks like",
      "the part of entrepreneurship nobody posts",
    ],
    "pov: you run a marketing agency and your phone never stops",
    "Fast cuts: calls, Slack pings, whiteboard, late nights. Real, not glamorous.",
  ),
  idea(
    8,
    "I died and came back. This is what changed.",
    "personal",
    "short",
    "story",
    [
      "I died in a motorcycle accident. Coming back changed how I spend every single day.",
      "Nobody tells you what it's like to get a second shot. So I will.",
      "The doctors said [what they told you]. This is what that did to me.",
    ],
    "i died at [age]. this is what i'd tell anyone still waiting.",
    "Confirm how you want to describe the accident before this goes out.",
    ["seed-story-accident"],
  ),
  idea(
    9,
    "The full story: my motorcycle accident",
    "personal",
    "long",
    "youtube-long",
    [
      "I've never told this whole story on camera.",
      "[Date]. I got on my bike like any other day.",
      "This is the day I died, and everything that came after.",
    ],
    "THE DAY I DIED",
    "YouTube long form. Record the story bank entry out loud first in the Voice Lab, then structure it.",
    ["seed-story-accident"],
  ),
  idea(
    10,
    "What my relationship taught me about leading a team",
    "personal",
    "short",
    "talking-short",
    [
      "My lady is the reason I'm a better boss. Let me explain.",
      "Everything I know about communication I learned at home, not in business.",
      "The best leadership advice I ever got didn't come from a business book.",
    ],
    "the best leadership lessons don't come from business books",
    "Check what your partner is comfortable having on camera first.",
    ["seed-story-partner"],
  ),
];

export const SEED_STORIES: Story[] = [
  {
    id: "seed-story-accident",
    title: "The motorcycle accident",
    whatHappened: "",
    lesson: "",
    themes: ["second chances", "perspective", "urgency", "faith"],
    questions: [
      "Walk me through that day, starting a few hours before.",
      "What's the last thing you remember? What's the first thing after?",
      "What did the doctors tell you, and how did you take it?",
      "What did you stop doing after? What did you start?",
      "What would you say to someone who's waiting for 'someday'?",
    ],
    createdAt: t0,
  },
  {
    id: "seed-story-agency",
    title: "Starting the agency",
    whatHappened: "",
    lesson: "",
    themes: ["business", "risk", "starting"],
    questions: [
      "What were you doing right before you started it?",
      "Who was your first client and how did you land them?",
      "What almost made you quit in the first year?",
    ],
    createdAt: t0 + 1,
  },
  {
    id: "seed-story-firing",
    title: "The hardest person I had to let go",
    whatHappened: "",
    lesson: "",
    themes: ["leadership", "team", "hard decisions"],
    questions: [
      "When did you first know it wasn't working?",
      "Why did you wait?",
      "What did keeping them around actually cost you and the team?",
      "What do you do differently now?",
    ],
    createdAt: t0 + 2,
  },
  {
    id: "seed-story-ad-flop",
    title: "An ad campaign that flopped",
    whatHappened: "",
    lesson: "",
    themes: ["meta ads", "failure", "testing"],
    questions: [
      "What did you expect to happen?",
      "What actually happened, in numbers?",
      "What did you change, and what happened next?",
    ],
    createdAt: t0 + 3,
  },
  {
    id: "seed-story-partner",
    title: "What my lady taught me",
    whatHappened: "",
    lesson: "",
    themes: ["relationship", "communication", "leadership"],
    questions: [
      "What's something your partner does that you've copied at work?",
      "A disagreement that changed how you communicate?",
      "What are they comfortable sharing on camera?",
    ],
    createdAt: t0 + 4,
  },
];

// Your own words, from the voice note that started this hub. This is the first
// entry in your voice corpus: the way you actually talk.
export const SEED_VOICE: VoiceEntry[] = [
  {
    id: "seed-voice-1",
    source: "seed",
    createdAt: t0,
    text: `All right, I'm just going to talk out loud so you can get the general consensus, and then obviously we're going to have to refine it. But what I'm realizing in the day and age that we live in is content is king. And so I have been trying my hardest to like do content, and it's just extremely hard for me. And I'm realizing I'm not happy because I'm not actually creating content. And there's a saying where it's like in the book Atomic Habits, it's like, you don't fall to your habits, you fall to the level of systems you have in place. And so I just need to create a process that helps me. I have noticed I try to use AI to help with scripting. And a lot of the times it just sounds too robotic and too AI-ish. It's too perfect. And I really don't have stuff to give you that is my voice. So it's like, we're having to like start from scratch. And the kind of realm that I'm in is like really anything. I talk about business. So it's like we run a marketing company. So within that, there's different things we're learning as far as like Facebook advertising, leadership, managing a team, sales, like everything business acumen I'm talking about. Also, the other side of that is like it is lifestyle. So there's gonna be lifestyle stuff where people are just clipping stuff up, B-roll. And then there's just like a text overlay on the screen that is tangible that people will resonate with and which why they would want to repost it. Then there's also just me talking about personal stuff. Like obviously I was killed in a motorcycle accident. So like there's a lot of life experiences or lessons that I can give there. I have a lady. So it's like, it's my brand and I don't want to be, I know people say niche down, but I want to talk about everything. I just want to create this all-inclusive hub that will help me systemize everything where I can really just find myself the ability to get in a flow state.`,
  },
  {
    id: "seed-voice-2",
    source: "seed",
    createdAt: t0 + 1,
    text: `I'll give you all the account stuff later down the road. Like, that's step 10. We don't really necessarily need all that right now. Like, I just, we got to start building out the shell and take it one step at a time.`,
  },
];
