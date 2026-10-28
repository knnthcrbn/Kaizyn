// The hook library's types (research.json hookTypes), names only, for tagging
// cards and comparing results. A copy rather than an import: research.json is
// large and this is needed on every screen (Claude's context reads it).
// Keep the ids in step when hook types are added there.
export const HOOK_TYPES: { id: string; name: string }[] = [
  { id: "contrarian", name: "Contrarian" },
  { id: "mistake", name: "Mistake / Stop doing this" },
  { id: "in-medias-res", name: "Story in medias res" },
  { id: "number-list", name: "Number / List" },
  { id: "curiosity-gap", name: "Curiosity gap" },
  { id: "how-i-result", name: "\"How I\" result" },
  { id: "callout", name: "Callout" },
  { id: "question", name: "Question" },
  { id: "bold-claim", name: "Bold claim" },
  { id: "pov-relatable", name: "POV / Relatable moment" },
  { id: "before-after", name: "Before / After" },
  { id: "experiment", name: "I tried it / Experiment" },
  { id: "secret-insider", name: "Secret / Insider" },
  { id: "visual-reveal", name: "Visual reveal / Pattern interrupt" },
  { id: "fomo-timely", name: "FOMO / Timely warning" },
  { id: "prediction", name: "Prediction / Fortune teller" },
  { id: "investigator", name: "Investigator / I found" },
  { id: "case-study", name: "Case study / Teacher" },
  { id: "social-proof", name: "Name drop / Social proof" },
  { id: "cost-confession", name: "Cost confession" },
  { id: "credibility-curiosity", name: "Credibility + curiosity" },
  { id: "price-comparison", name: "This vs that / Price comparison" },
  { id: "ranking", name: "Ranking / Tier list" },
  { id: "comment-reply", name: "Reply to a comment" },
  { id: "day-in-life", name: "Day in the life" },
  { id: "behind-the-scenes", name: "Behind the scenes / Watch me" },
  { id: "news-reaction", name: "News reaction / Green screen" },
  { id: "series", name: "Series / Day [N] of" },
  { id: "wish-i-knew", name: "Wish I knew / Younger self" },
  { id: "stakes-tease", name: "Stakes tease / Ending first" },
];

export const hookTypeName = (id?: string) => HOOK_TYPES.find((h) => h.id === id)?.name;
