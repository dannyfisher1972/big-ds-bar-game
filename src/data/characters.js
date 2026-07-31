import { ROOMS } from './rooms.js';

// Household-roster metadata for the briefing screen's suspect panel — role,
// bio, and question answers (see src/data/questions.js for BASE_QUESTIONS
// and FOLLOWUPS — a character's `answers` map holds both, keyed by id), kept
// separate from rooms.js so the in-scene NPC data (portrait, tint, alibi
// line) stays free of screen-specific content.
//
// Nobody here has a second "Alt" phrasing for
// their base answers — with only ten suspects and one method apiece, that
// extra layer of replay variety wasn't worth the added content for this
// build. RoomScene.js/main.js's pickDialogueVariant machinery still exists
// and still works if a future pass wants to add `${id}Alt` fields; it's just
// unused here.
const META = {
  'Jade Marlow': {
    role: 'Bartender, 4 Years',
    bio: "Sharp, guarded, and closing in on her exit — she's been quietly skimming a cut of the till for months to fund leaving town for good. Derek was generous with her hours and handsy with everything else; she'd learned to keep one eye on the register and the other on the door. Bisexual, and about as private about that as she is about everything else in her life. She's the one who did the 2 AM close-out count and found him.",
    answers: {
      alibi: 'Behind the bar doing the final register count, same as every closing shift, right up until I found him.',
      relationship: "He was generous with the schedule and handsy with everything else. I'd started quietly applying to bartend somewhere — anywhere — that wasn't here.",
      suspicion: "Sonny's \"friendly reminders\" about what Derek owed him stopped sounding friendly a while back. Make of that what you want.",
      'confirm-tiny-walkthrough': "I saw him out front once, maybe half past one, doing his usual rounds. Didn't think anything of it — that's just Tiny.",
      'ask-jade-duffel': "So I've got a bag packed. That's not a crime, last I checked. I've been planning to leave this town for months — this just made the decision for me.",
      'confirm-cruz-wristgrab': "Yeah. That happened. I told him to let go and he did, eventually. I didn't think Cruz even saw it.",
      'ask-jade-poison': "That's supposed to be under the sink for the actual rats we've got. I couldn't tell you where it went."
    }
  },
  'Danny "Tiny" Fisher': {
    role: 'Bouncer / Night Manager, 10 Years',
    bio: "Ex-boxer, ten years of loyalty to Derek, and lately covering payroll shortfalls out of his own pocket without being asked. He found the sale paperwork himself, going through the desk for something unrelated — Derek was quietly negotiating to sell the bar out from under every person who worked there, no warning, no severance.",
    answers: {
      alibi: 'Doing the last walkthrough — locking the patio, then the front door. Alone, same as always.',
      relationship: "Ten years, and I never once had to wonder if he had my back. Turns out I should have wondered harder.",
      suspicion: "Sonny's been circling Derek all month like he's owed something. Maybe he is.",
      'ask-tiny-contract': "Found it by accident, looking for a spare key. Whole place, sold right out from under everybody, and he was never going to tell us until the papers were already signed."
    }
  },
  'Sonny Vance': {
    role: 'Pool-Table Regular',
    bio: "A fixture at the pool table on any given night, and the man Derek owed a serious sum to. He'd started avoiding Sonny's calls, which is not a thing you do to Sonny for long.",
    answers: {
      alibi: 'Playing pool with the regulars most of the night. I left before closing — ask anybody.',
      relationship: "Derek and I go back further than this bar does. Money makes friends complicated. That's not new information.",
      suspicion: "That kid at the DJ booth's been staring daggers at Derek all night, every night, for months. I'd start there.",
      'dispute-sonny-timing': "Duck's got the time wrong. I was heading out around then, not still racking balls. People remember what they want to remember."
    }
  },
  'Marisol Ortiz': {
    role: "Derek's Ex-Wife",
    bio: "Holds 40% of the bar on paper from the divorce settlement, hasn't seen a dime of it, and shows up on big nights specifically to remind everyone she still has a claim. Bitter, sharp-tongued, impossible to ignore.",
    answers: {
      alibi: 'Holding court in the corner booth with the old regulars, same as I do every anniversary. I left before close.',
      relationship: "Twenty-two years married to that man, and buying out my own stake was somehow always \"complicated.\" It stopped being complicated the moment he needed my signature on something else.",
      suspicion: "Jade's been awfully interested in that register lately, for someone who supposedly just counts it.",
      'confirm-sonny-left': "I couldn't tell you — I'd already gone myself by the time he says he left. Convenient for both of us, I suppose.",
      'ask-marisol-buyout': "That number was an insult and he knew it. Twenty-two years, and that's what he thought I was worth. I told him exactly that, and then I left.",
      'confirm-marisol-skylar': "Let her point wherever she likes. I've got twenty-two years and a paper stake in this place to be bitter about. She's got a few months and a broken promise. I know which one of those sounds like a motive to me, and it isn't mine."
    }
  },
  'DJ Cruz': {
    role: 'DJ / Karaoke Host, 2 Years',
    bio: "Runs the karaoke booth and the sound system, quietly in love with Jade, and has spent months watching Derek treat her like something he owned. Something specific happened tonight that he can't quite talk about yet.",
    answers: {
      alibi: 'Behind the booth all night. I stepped away during a song, maybe twenty minutes, tops.',
      relationship: "He signed my checks. That's the whole relationship, as far as he was concerned.",
      suspicion: "I don't know. Ask Sonny why he's suddenly so friendly with everybody tonight.",
      'ask-cruz-song': "Yeah, I dedicated it to somebody. I'm not going to pretend it wasn't about Jade — everybody in that room could see how he treated her. Somebody should've said something a long time ago."
    }
  },
  'Duck Pruitt': {
    role: "Derek's Oldest Friend",
    bio: "Derek's friend since high school, dart-league fixture, and — as of tonight — aware that Derek had been sleeping with his wife for over a year. He found out the same way everyone finds out eventually: by accident, and badly.",
    answers: {
      alibi: 'Darts most of the night, then out back for a smoke around closing. On my own.',
      relationship: "Forty years of friendship. I keep waiting to feel like that's still true.",
      suspicion: "Marisol never did stop thinking that bar owes her something. Maybe tonight she decided to collect.",
      'ask-duck-motel': "So you found it. Yeah. Over a year, apparently, and I'm the last one who knew. I don't especially want to talk about what I felt when I read that.",
      'ask-duck-marisol-sighting': "I wasn't watching the booth, if that's what you're asking. I was out back with my own cigarette and my own problems that night."
    }
  },
  'Nikki Alvarez': {
    role: 'Cocktail Waitress',
    bio: "Fired in front of the whole bar earlier tonight for turning Derek down one time too many, and told to clear her locker before the party even ended. She says she left. The timeline says otherwise.",
    answers: {
      alibi: "I left right after he fired me, around eleven. I wasn't sticking around to watch everybody else keep partying.",
      relationship: "He hired me because I was cute and fired me because I wouldn't pretend that was a compliment.",
      suspicion: "Ask Tiny what he was really doing out back tonight. He's not usually that jumpy.",
      'ask-nikki-return': "Fine — I came back, okay? For my things, and for the paycheck he was too petty to actually hand me. I wasn't going to leave empty-handed after the night he gave me."
    }
  },
  'Roz Kessler': {
    role: 'Bar Regular, "The Lush"',
    bio: "Fifty-eight years old and a fixture at her usual table for as long as anyone at Big D's can remember, working through a bar tab she hasn't come close to paying down in months. Sharp-tongued and funny when she feels like it, brittle and defensive the second anyone gets near the truth of how bad the drinking's actually gotten. Derek let her tab run for years — half pity, half good business, a drunk regular being good for a room's atmosphere — until recently, when he started threatening to call her grown kids and lay the whole thing out for them, publicly, right at the anniversary party, unless she settled up.",
    answers: {
      alibi: "Sitting right at my usual table most of the night, nursing my usual. Stepped away for a few minutes — powder room — I couldn't tell you exactly when, and I don't see why it matters.",
      relationship: "He let my tab run longer than any sane bartender should have. Called it a favor, all these years. Felt more like a leash the longer it went on.",
      suspicion: "Ask Dale where he really was all night. Man's had a grudge against Derek for years — that's old news for anybody who's spent five minutes in this bar.",
      'ask-roz-threat': "Fine — he said he'd call my kids. Tell them everything, right there at the party, in front of God and everybody, unless I paid up. Twenty-two years married to Dale taught me exactly what that kind of threat sounds like, and it wasn't a bluff.",
      'confirm-roz-dale-drinking': "That sounds exactly like him. Nail himself to a barstool and call it dignity. Some things don't change just because the divorce went through."
    }
  },
  'Dale Bracken': {
    role: "Bar Regular, Roz's Ex-Husband",
    bio: "Sixty years old, also a fixture at Big D's, also a heavy drinker — quieter and more sullen about it than his ex-wife Roz, who holds down her own table across the room. They divorced bitterly a few years back and now orbit the same bar most nights without speaking a word to each other, each parked at his and her own table, the whole room long since used to stepping around the two of them. Derek testified against him in the divorce, about the drinking he'd watched firsthand from behind his own bar for years — testimony that cost Dale the custody case and most of a fair settlement.",
    answers: {
      alibi: "Sitting at my own table the whole night, drinking steadily. Only got up for the restroom, same as I always do. Wasn't watching the clock.",
      relationship: "He watched me drink from behind that bar for years and then stood up in a courtroom and told my own lawyer every detail. That's the relationship.",
      suspicion: "Ask Roz. Same old habit — we've been blaming each other for things since before the divorce was even final.",
      'ask-dale-custody': "You found that, huh. Yeah. His testimony's right there on the second page, word for word. Cost me the kids and most of what I was owed. Forty years of buying his drinks and that's what he decided I was worth.",
      'confirm-dale-roz-restroom': "Wouldn't know. Wasn't watching her. We don't do that for each other anymore — haven't in years."
    }
  },
  'Skylar Reyes': {
    role: "Derek's On-and-Off Girlfriend",
    bio: "Twenty-three, and Derek's been seeing her on and off for the past several months — everyone at the bar knows exactly what that arrangement is. He liked being seen with someone young and pretty; she liked not having to worry about rent. Confident, guarded, blunt when pressed, and not remotely ashamed of the deal she made. She's dated women before too, when it comes up, which isn't often. Tonight, in front of half the bar, Derek ended it and went back on his promise to cover last month's rent — the one he'd talked her into actually counting on.",
    answers: {
      alibi: "Around the bar most of the night, same as usual. Stepped out back for some air around when they're saying it happened. Alone — nobody to back that up, and I know how that sounds.",
      relationship: "He liked being seen with me. I liked not stressing about rent. Neither of us pretended it was more than that, so don't act shocked on my behalf.",
      suspicion: "Ask the woman who actually had a real reason to hate him. I just lost an apartment tonight. She lost a lot more than that, a long time ago.",
      'ask-skylar-promise': "He told me it was over in front of half this bar, and then he told me the rent money wasn't coming either — like that was a small thing to mention in the same breath. I've got till the end of the week to figure out where I'm sleeping."
    }
  }
};

export const CHARACTERS = Object.values(ROOMS)
  .flatMap(room => room.npcs || [])
  .map(npc => ({ ...npc, ...META[npc.name] }));
