// Two tiers of question. BASE_QUESTIONS are offered to every suspect from
// the start (each character's answer lives in src/data/characters.js's
// META[name].answers, keyed by these ids).
//
// FOLLOWUPS only appear once their unlock condition is met — asking a
// specific base (or other followup) question of one NPC, or finding a
// specific piece of evidence, can surface a new, pointed question for a
// *different* NPC that references what was just learned. That's the "go
// back and ask them about it" mechanic: the game doesn't hand you the
// connection, asking the right question (or finding the right clue) does.
// `target` is who the new question appears for; `unlocksAfter` is either
// { npc, questionId } (that question must already be in ASKED_QUESTIONS) or
// { evidence: 'id' } (that id must already be in FOUND_EVIDENCE) — see
// RoomScene.js's isFollowupUnlocked. Answers for a followup live in the
// target's `answers` map too, keyed by the followup's own id.
//
// `contradiction: true` marks a followup whose Q&A already reads as two
// accounts not quite lining up — the notebook's Timeline view surfaces these
// under "Contradictions Noticed" once asked. Only tag ones that are true
// every game (same lines regardless of who the killer is this time), so
// this stays flavor/food-for-thought rather than a guilt tell.
export const BASE_QUESTIONS = [
  { id: 'alibi', text: 'Where were you around closing?' },
  { id: 'relationship', text: 'What was your relationship with Derek really like?' },
  { id: 'suspicion', text: "Anyone here you'd point a finger at?" }
];

export const FOLLOWUPS = [
  {
    id: 'confirm-tiny-walkthrough',
    target: 'Jade Marlow',
    unlocksAfter: { npc: 'Tiny Escobar', questionId: 'alibi' },
    text: 'Tiny says he was doing the final walkthrough alone. Did you see him out front while you were closing up?'
  },
  {
    id: 'ask-jade-duffel',
    target: 'Jade Marlow',
    unlocksAfter: { evidence: 'WR-02' },
    text: "There's a bag half-packed in the women's room. Going somewhere?"
  },
  {
    id: 'confirm-sonny-left',
    target: 'Marisol Ortiz',
    unlocksAfter: { npc: 'Sonny Vance', questionId: 'alibi' },
    text: 'Sonny says he left before closing. Did you happen to see him go?'
  },
  {
    id: 'dispute-sonny-timing',
    target: 'Sonny Vance',
    unlocksAfter: { npc: 'Duck Pruitt', questionId: 'alibi' },
    text: "Duck says he saw you still racking balls well after you told me you'd already left. Want to explain that?",
    contradiction: true
  },
  {
    id: 'ask-duck-motel',
    target: 'Duck Pruitt',
    unlocksAfter: { evidence: 'M-05' },
    text: "There's a note addressed to your wife, tucked in Derek's own coat behind the bar. Do you want to tell me about that?"
  },
  {
    id: 'confirm-cruz-wristgrab',
    target: 'Jade Marlow',
    unlocksAfter: { evidence: 'M-09' },
    text: 'Cruz says he saw Derek grab your wrist hard enough to bruise, in the back hallway tonight. Is that true?'
  },
  {
    id: 'ask-cruz-song',
    target: 'DJ Cruz',
    unlocksAfter: { npc: 'Jade Marlow', questionId: 'relationship' },
    text: 'Staff mentioned you dedicated a pretty pointed song tonight, "to somebody who deserves better." Who was that about?'
  },
  {
    id: 'ask-marisol-buyout',
    target: 'Marisol Ortiz',
    unlocksAfter: { evidence: 'M-07' },
    text: "There's buyout paperwork that spilled out of your purse tonight — a pretty low offer for your stake. How did that conversation go?"
  },
  {
    id: 'ask-tiny-contract',
    target: 'Tiny Escobar',
    unlocksAfter: { evidence: 'O-04' },
    text: "There's a draft sale contract on Derek's desk — the whole bar, sold out from under everybody. Did you know?"
  },
  {
    id: 'ask-nikki-return',
    target: 'Nikki Alvarez',
    unlocksAfter: { evidence: 'P-04' },
    text: "Your car's engine was still warm well after you say you left. So — did you really leave at eleven?",
    contradiction: true
  },
  {
    id: 'ask-duck-marisol-sighting',
    target: 'Duck Pruitt',
    unlocksAfter: { npc: 'Marisol Ortiz', questionId: 'alibi' },
    text: 'Marisol says she left before close, same as you claim you were out back the whole time. Did you actually see her go?',
    contradiction: true
  },
  {
    id: 'ask-jade-poison',
    target: 'Jade Marlow',
    unlocksAfter: { evidence: 'M-01' },
    text: "There's a box of rat poison missing from under the sink — your sink. Any idea where it went?"
  },
  {
    id: 'ask-roz-threat',
    target: 'Roz Kessler',
    unlocksAfter: { evidence: 'M-13' },
    text: "There's a bar tab with your name on it, the total circled twice in red. What was Derek planning to do about it?"
  },
  {
    id: 'ask-dale-custody',
    target: 'Dale Bracken',
    unlocksAfter: { evidence: 'M-14' },
    text: "There's an old custody ruling with Derek's testimony quoted right in it. Want to tell me about that?"
  },
  {
    id: 'confirm-dale-roz-restroom',
    target: 'Dale Bracken',
    unlocksAfter: { npc: 'Roz Kessler', questionId: 'alibi' },
    text: "Roz says she can't quite account for a few minutes she claims she spent in the restroom. You were sitting across the room all night — did you notice her get up?"
  },
  {
    id: 'confirm-roz-dale-drinking',
    target: 'Roz Kessler',
    unlocksAfter: { npc: 'Dale Bracken', questionId: 'alibi' },
    text: "Dale says he never left his table except for the restroom. You were married to the man for over twenty years — does that sound about right?"
  },
  {
    id: 'ask-skylar-promise',
    target: 'Skylar Reyes',
    unlocksAfter: { evidence: 'M-17' },
    text: "There's an overdue rent notice with your name on it. What did Derek promise you about that, exactly?"
  },
  {
    id: 'confirm-marisol-skylar',
    target: 'Marisol Ortiz',
    unlocksAfter: { npc: 'Skylar Reyes', questionId: 'suspicion' },
    text: "Skylar seems awfully quick to point a finger at you tonight. Anything you'd like to say to that?"
  }
];
