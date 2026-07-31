// Room definitions for the static-background point-and-click scene type.
//
// bgKey: the texture key for the room's background image (see BootScene for the asset list).
// hotspots and npcs: fx/fy are fractions (0..1) of the WHOLE screen, matched by eye against
//   each room's actual generated artwork — an object can sit anywhere in the image.
//   tint colors the identifying ring around an NPC's portrait badge. portraitKey points at a
//   loaded real photo (see BootScene); if that failed to load, RoomScene falls back to a
//   plain initial-letter badge instead of the photo.
// prevRoom/nextRoom: keys into this same object, used by the on-screen room-to-room nav.
// requires (optional, on a hotspot): gates a clue until ALL given conditions are met —
//   { npc: 'Full Name' } (that person must have been talked to), { evidence: 'id' }
//   (another hotspot must already be found), { killer: 'Full Name' } (only shows up when
//   that person is this game's randomized killer — see src/data/solutions.js),
//   { killerMethod: 'poison' } (only shows up when this game's method, per that same
//   SOLUTIONS entry, matches — used to gate a killer-exclusive clue so it doesn't mislead
//   players in a different-method game), or { optional: true } (only shows up if state.js's
//   isOptionalClueActive randomly rolled this id in for this story slot — a 60% chance,
//   rolled once and cached per slot. Reserved for pure atmosphere and red herrings that are
//   never load-bearing for solving the case, so replaying doesn't always surface the exact
//   same set of side details). RoomScene hides the marker entirely until satisfied, so
//   clues can surface progressively as the case unfolds.
//   A hotspot's `note` can be overridden per-scenario via SOLUTIONS[killerIndex].sceneNotes
//   (keyed by hotspot id) — used for O-01 (the body) and O-02 (his last drink) so the office's
//   wording matches whatever actually happened this game, without needing separate art per
//   method.
// implicates (optional, on a hotspot): the suspect(s) this clue points at — either a name
//   string or an array of names. Drawn as string-lines on the notebook's deduction board.
//   Omit it for atmospheric/neutral clues that don't point at anyone specific.
// redHerring (optional, on a hotspot): true if the clue's own note resolves it as a dead
//   end. Tagged distinctly in the notebook and drawn with a dashed, muted line on the board.
// alibiBreak (optional, on a hotspot): true if the clue's note directly contradicts
//   something a suspect claimed. Tagged in the notebook and feeds the Timeline's
//   "Contradictions Noticed" section.
//
// The nine rooms form a simple loop: frontext -> parkinglot -> leftext -> backext ->
// rightext -> mainbar -> mensroom -> womensroom -> office -> (back to frontext). Any room
// can reach any other by stepping through the loop; it doesn't need to be a full mesh to
// make the bar feel connected.
//
// This build skips the puzzle/pickup/itemLock mechanics entirely (no locked drawers, no
// carryable keys) — Big D's Bar is a tighter, single-night case and none of the rooms
// needed a physical lock to make sense.

export const ROOM_ORDER = [
  'frontext', 'parkinglot', 'leftext', 'backext', 'rightext',
  'mainbar', 'mensroom', 'womensroom', 'office'
];

export const ROOMS = {
  frontext: {
    label: "Big D's Bar — Front Patio",
    bgKey: 'bg-frontext',
    prevRoom: 'office',
    nextRoom: 'parkinglot',
    hotspots: [
      {
        id: 'F-01',
        fx: 0.59,
        fy: 0.45,
        name: '18th-anniversary flyers, taped to the door',
        note: '"18 YEARS OF BIG D\'S — FREE WELL DRINKS TILL MIDNIGHT." Somebody printed a few hundred of these. Most of them are still stacked by the register, untouched.'
      },
      {
        id: 'F-02',
        fx: 0.86,
        fy: 0.38,
        name: 'A broken patio umbrella, folded wrong',
        note: 'Snapped at the hinge and left leaning against a table. Could\'ve been the wind. Could\'ve been somebody in a hurry.',
        requires: { optional: true }
      },
      {
        id: 'F-03',
        fx: 0.56,
        fy: 0.58,
        name: 'The "Closed" sign, flipped early',
        note: 'Turned around a good hour before the party actually wound down — Derek liked to flip it himself, once the last stragglers were in for the night.',
        requires: { optional: true }
      },
      {
        id: 'F-04',
        fx: 0.22,
        fy: 0.68,
        name: 'A dropped bar tab, paid in full',
        note: 'Somebody\'s anniversary tab, signed and tipped generously. Nothing here but a good night, cut short.',
        redHerring: true,
        requires: { optional: true }
      },
      {
        id: 'F-05',
        fx: 0.42,
        fy: 0.4,
        name: 'A cracked window pane, patched over with duct tape',
        note: 'Been like that since spring, if the yellowed tape is anything to go by. Never quite made it onto anyone\'s to-do list.',
        requires: { optional: true }
      },
      {
        id: 'F-06',
        fx: 0.32,
        fy: 0.78,
        name: 'A muddy shoe print, turned back toward the door',
        note: 'One set of prints, in and back out again. Could be anyone who stepped onto the wet patio tonight and thought better of it — half this bar did exactly that.',
        redHerring: true,
        requires: { optional: true }
      }
    ],
    npcs: [
      {
        tint: 0x8fa9c9,
        name: 'Danny "Tiny" Fisher',
        portraitKey: 'portrait-tiny',
        fx: 0.64,
        fy: 0.58,
        line: '"Ten years I\'ve had this man\'s back. Now there\'s a body in his office and half this bar looking at me like I did it."'
      }
    ]
  },

  parkinglot: {
    label: 'The Parking Lot',
    bgKey: 'bg-parkinglot',
    prevRoom: 'frontext',
    nextRoom: 'leftext',
    hotspots: [
      {
        id: 'P-01',
        fx: 0.22,
        fy: 0.55,
        name: "Sonny's car, a gym bag on the back seat",
        note: "Unzipped, like whoever put it there didn't much care who saw. Inside: the broken end of a pool cue, the tip dark and flecked, snapped clean where it shouldn't snap.",
        requires: { killer: 'Sonny Vance', killerMethod: 'stabbing' },
        implicates: 'Sonny Vance'
      },
      {
        id: 'P-02',
        fx: 0.5,
        fy: 0.78,
        name: 'Broken glass and skid marks near the curb',
        note: "Somebody peeled out of here in a hurry at some point tonight — hard to say when, with a lot in this bad a state of repair to begin with.",
        requires: { optional: true }
      },
      {
        id: 'P-03',
        fx: 0.85,
        fy: 0.3,
        name: 'A dead security camera, cable dangling',
        note: "Been broken for months, by the look of the dust on the housing — a running joke among the staff, not a cover-up. No footage from out here tonight, whatever anybody hoped for.",
        redHerring: true,
        requires: { optional: true }
      },
      {
        id: 'P-04',
        fx: 0.65,
        fy: 0.55,
        name: "Nikki's car, engine still faintly warm",
        note: "She says she left right after she got fired, around eleven. The hood's still warm to the touch — long after eleven, whatever she says about it.",
        implicates: 'Nikki Alvarez',
        alibiBreak: true
      },
      {
        id: 'P-05',
        fx: 0.38,
        fy: 0.62,
        name: "Duck's truck, tailgate hanging open",
        note: 'Nothing in the bed but a spare tire and a case of empties. He\'s been meaning to return those for a month.',
        requires: { optional: true }
      },
      {
        id: 'P-06',
        fx: 0.12,
        fy: 0.82,
        name: 'A crushed beer can, half-sunk in the gravel',
        note: 'Somebody\'s idea of cleaning up after themselves. Could\'ve been dropped any night this month.',
        redHerring: true,
        requires: { optional: true }
      }
    ],
    npcs: [
      {
        tint: 0xe8a33d,
        name: 'Nikki Alvarez',
        portraitKey: 'portrait-nikki',
        fx: 0.65,
        fy: 0.5,
        line: '"Guess it doesn\'t matter that he fired me anymore, huh. Kind of hard to feel bad about that part tonight."'
      }
    ]
  },

  leftext: {
    label: 'Side Alley',
    bgKey: 'bg-leftext',
    prevRoom: 'parkinglot',
    nextRoom: 'backext',
    hotspots: [
      {
        id: 'L-01',
        fx: 0.53,
        fy: 0.22,
        name: 'AC units, one dripping steadily',
        note: 'Ancient, all three of them, held together with duct tape and a maintenance contract Derek kept "meaning to renew."'
      },
      {
        id: 'L-02',
        fx: 0.2,
        fy: 0.55,
        name: 'Graffiti, half under a fresh coat of paint',
        note: '"J + ?" scratched into the brick, the second initial worn away entirely. Could be anybody. Could be nothing — bar walls collect this kind of thing for decades.',
        redHerring: true,
        implicates: 'Jade Marlow',
        requires: { optional: true }
      },
      {
        id: 'L-03',
        fx: 0.5,
        fy: 0.82,
        name: 'A stack of empty kegs, one badly dented',
        note: 'Rolled out here after tonight\'s crowd went through them faster than usual. The dent looks older than tonight.',
        requires: { optional: true }
      },
      {
        id: 'L-04',
        fx: 0.75,
        fy: 0.68,
        name: 'A flattened cardboard box, gone soft with rain',
        note: 'Recycling that never quite makes it to the bin. Somebody complained about it constantly and never once fixed it themselves.',
        requires: { optional: true }
      },
      {
        id: 'L-05',
        fx: 0.28,
        fy: 0.38,
        name: 'A single work glove, dropped near the wall',
        note: 'Left by whoever took the recycling out last, probably. Nobody\'s claimed it.',
        redHerring: true,
        requires: { optional: true }
      }
    ],
    npcs: []
  },

  backext: {
    label: 'Behind the Bar',
    bgKey: 'bg-backext',
    prevRoom: 'leftext',
    nextRoom: 'rightext',
    hotspots: [
      {
        id: 'B-01',
        fx: 0.33,
        fy: 0.11,
        name: 'The red glow of the exit sign, flickering',
        note: "Been flickering for a year. Derek always said he'd get to it. He never did."
      },
      {
        id: 'B-02',
        fx: 0.1,
        fy: 0.58,
        name: 'The dumpster, reeking of spilled beer',
        note: "A busted keg tap and a torn stack of old flyers from some anniversary years back — 15 years, by the print on them. Nothing here but the usual mess.",
        redHerring: true,
        requires: { optional: true }
      },
      {
        id: 'B-03',
        fx: 0.6,
        fy: 0.8,
        name: 'A scatter of cigarette butts by the delivery door',
        note: "The regular smoke-break spot. Half the bar passed through here at some point tonight — no way to pin down who, or when, from this alone."
      },
      {
        id: 'B-04',
        fx: 0.63,
        fy: 0.45,
        name: 'The kitchen delivery door, propped with a bent bottle cap',
        note: 'Left cracked open for the smoke breaks. Not locked once, all night, by anyone\'s account.',
        requires: { optional: true }
      },
      {
        id: 'B-05',
        fx: 0.78,
        fy: 0.83,
        name: 'The back stairs down to the office door',
        note: "Steep, narrow, and poorly lit — a bad place to lose your footing. Fresh scuff marks drag across two of the steps, and a torn scrap of black fabric is snagged on the railing near the bottom, at just about apron height.",
        requires: { killer: 'Nikki Alvarez', killerMethod: 'staged-accident' },
        implicates: 'Nikki Alvarez'
      },
      {
        id: 'B-06',
        fx: 0.48,
        fy: 0.72,
        name: 'An overturned folding chair by the smoke-break spot',
        note: 'Knocked over sometime tonight and never set back up — could\'ve been the wind, could\'ve been somebody in a hurry. Half the chairs out here wobble anyway.',
        requires: { optional: true }
      },
      {
        id: 'B-07',
        fx: 0.15,
        fy: 0.72,
        name: 'A torn beer coaster, rain-soaked and stuck to the concrete',
        note: 'Somebody\'s bar napkin doodle, smeared past reading by the rain. Just trash, same as everything else out here.',
        redHerring: true,
        requires: { optional: true }
      }
    ],
    npcs: []
  },

  rightext: {
    label: 'Kitchen Side',
    bgKey: 'bg-rightext',
    prevRoom: 'backext',
    nextRoom: 'mainbar',
    hotspots: [
      {
        id: 'R-01',
        fx: 0.62,
        fy: 0.5,
        name: 'The kitchen delivery door, propped with a crate',
        note: 'The kitchen closed at ten, same as always. Nobody\'s been in or out of here since.'
      },
      {
        id: 'R-02',
        fx: 0.87,
        fy: 0.78,
        name: 'Propane tanks, chained to the wall',
        note: 'For the patio heaters. Nothing unusual — just the ordinary machinery of keeping a bar running.',
        requires: { optional: true }
      },
      {
        id: 'R-03',
        fx: 0.82,
        fy: 0.07,
        name: 'A security camera, actually working this time',
        note: "Blinking red, recording faithfully — pointed at an empty stretch of wall, angled wrong since the day it went up. Useless, but not for any sinister reason.",
        requires: { optional: true }
      },
      {
        id: 'R-04',
        fx: 0.25,
        fy: 0.6,
        name: 'A stack of empty liquor boxes, flattened for recycling',
        note: 'Broken down after tonight\'s rush. Whoever did it stacked them neater than most people bother to.',
        requires: { optional: true }
      },
      {
        id: 'R-05',
        fx: 0.5,
        fy: 0.88,
        name: 'A rain-soaked delivery invoice, pinned under a loose brick',
        note: "Tonight's liquor order, signed for around six. Nothing unusual — the party needed restocking same as any big night.",
        requires: { optional: true }
      }
    ],
    npcs: []
  },

  mainbar: {
    label: "The Main Room",
    bgKey: 'bg-mainbar',
    prevRoom: 'rightext',
    nextRoom: 'mensroom',
    hotspots: [
      {
        id: 'M-01',
        fx: 0.05,
        fy: 0.52,
        name: 'A box of rat poison, missing from under the sink',
        note: "Every bar keeps some — for the actual rats. This one's supposed to live under the sink behind the bar. It doesn't, not anymore.",
        requires: { killer: 'Jade Marlow', killerMethod: 'poison' },
        implicates: 'Jade Marlow'
      },
      {
        id: 'M-02',
        fx: 0.14,
        fy: 0.42,
        name: "Jade's register tape, the numbers not quite matching",
        note: "Small amounts, skimmed carefully over months — not enough to notice unless you were looking, which nobody was, until now.",
        requires: { npc: 'Jade Marlow' },
        implicates: 'Jade Marlow'
      },
      {
        id: 'M-03',
        fx: 0.44,
        fy: 0.62,
        name: "Sonny's drink, poured and left untouched",
        note: 'Sitting by the pool table since well before close, the ice long since melted flat. Odd, for a man who claims he left before closing — he never got around to finishing it.',
        requires: { killer: 'Sonny Vance' },
        implicates: 'Sonny Vance',
        alibiBreak: true
      },
      {
        id: 'M-04',
        fx: 0.62,
        fy: 0.58,
        name: "A ledger, tucked under the pool table's felt",
        note: "Sonny's own handwriting: a running tally of everything Derek owed him, month by month, the number only ever growing. Derek had stopped taking his calls weeks ago.",
        requires: { npc: 'Sonny Vance' },
        implicates: 'Sonny Vance'
      },
      {
        id: 'M-05',
        fx: 0.08,
        fy: 0.3,
        name: "A note tucked into Derek's coat, behind the bar",
        note: 'A motel receipt, folded around a note addressed to Duck\'s wife — in Derek\'s own handwriting. Whatever this was, it had been going on for over a year.',
        requires: { npc: 'Duck Pruitt' },
        implicates: 'Duck Pruitt'
      },
      {
        id: 'M-06',
        fx: 0.62,
        fy: 0.35,
        name: 'A handful of darts missing from the board',
        note: "The house set always runs light by a few — regulars walk off with them constantly. One turned up later, off to the side, with dried blood still on the point.",
        requires: { killer: 'Duck Pruitt', killerMethod: 'stabbing' },
        implicates: 'Duck Pruitt'
      },
      {
        id: 'M-07',
        fx: 0.63,
        fy: 0.5,
        name: "Buyout paperwork, spilled from Marisol's purse",
        note: "Derek's latest offer for her 40% stake in the bar — a number so low it reads almost like an insult, after twenty-two years of marriage and a decade of 'we'll figure it out.'",
        requires: { npc: 'Marisol Ortiz' },
        implicates: 'Marisol Ortiz'
      },
      {
        id: 'M-08',
        fx: 0.8,
        fy: 0.5,
        name: 'A vinyl crate, wiped clean, shoved under the DJ booth',
        note: "One corner still carries a faint dark stain the rag missed. Doesn't belong under there — the crates usually stack against the back wall.",
        requires: { killer: 'DJ Cruz', killerMethod: 'blunt-force' },
        implicates: 'DJ Cruz'
      },
      {
        id: 'M-09',
        fx: 0.85,
        fy: 0.34,
        name: "Something DJ Cruz can't stop thinking about",
        note: "He saw Derek grab Jade's wrist hard enough to bruise, right in the back hallway, earlier tonight — in full view of anyone who happened to be looking his way. He was.",
        requires: { npc: 'DJ Cruz' },
        implicates: 'DJ Cruz'
      },
      {
        id: 'M-10',
        fx: 0.78,
        fy: 0.44,
        name: "The karaoke setlist, one song underlined twice",
        note: 'Dedicated earlier tonight "to somebody who deserves better" — staff remember it clearly, even if nobody thought much of it until now.',
        requires: { npc: 'Jade Marlow' },
        implicates: 'DJ Cruz'
      },
      {
        id: 'M-11',
        fx: 0.45,
        fy: 0.72,
        name: 'A torn raffle ticket, half-burned in an ashtray',
        note: "Somebody's losing anniversary raffle number, nothing more. Doesn't match anything else in the building.",
        redHerring: true,
        implicates: 'Sonny Vance',
        requires: { optional: true }
      },
      {
        id: 'M-12',
        fx: 0.5,
        fy: 0.08,
        name: 'The anniversary banner, half torn down',
        note: '"18 YEARS!" in gold letters, one corner ripped loose sometime during the party and never fixed.',
        requires: { optional: true }
      },
      {
        id: 'M-13',
        fx: 0.1,
        fy: 0.66,
        name: "Roz's bar tab, the total circled twice in red pen",
        note: "Written up months ago and never quite settled. Derek finally lost patience with letting it slide — he'd started threatening to call her grown kids and lay the whole thing out for them, publicly, right at the anniversary party, unless she paid every cent.",
        requires: { npc: 'Roz Kessler' },
        implicates: 'Roz Kessler'
      },
      {
        id: 'M-14',
        fx: 0.92,
        fy: 0.85,
        name: "An old custody ruling, folded and re-folded until it's falling apart",
        note: "Derek's own testimony is quoted on the second page — about the drinking he'd watched firsthand from behind his bar for years. It cost Dale the kids and most of the settlement he might otherwise have walked away with.",
        requires: { npc: 'Dale Bracken' },
        implicates: 'Dale Bracken'
      },
      {
        id: 'M-15',
        fx: 0.15,
        fy: 0.85,
        name: "Roz's purse, hooked on the back of her chair",
        note: "An amber pill bottle rattles near-empty inside — her own prescription, sedatives and heart medication both. A crushed, chalky residue clings to the inside of the cap, and to a balled-up cocktail napkin folded in next to it.",
        requires: { killer: 'Roz Kessler', killerMethod: 'poison' },
        implicates: 'Roz Kessler'
      },
      {
        id: 'M-16',
        fx: 0.88,
        fy: 0.88,
        name: "A heavy glass ashtray on Dale's table, wiped unnaturally clean",
        note: "Every other surface at his table is a mess of spilled beer and cigarette ash, same as it's been all night. This one ashtray has been wiped down to a shine, the edges still faintly damp.",
        requires: { killer: 'Dale Bracken', killerMethod: 'blunt-force' },
        implicates: 'Dale Bracken'
      },
      {
        id: 'M-17',
        fx: 0.22,
        fy: 0.44,
        name: "A landlord's final notice, three days overdue, tucked into Skylar's clutch on the bar",
        note: "Addressed to Skylar, not Derek — she'd been counting on him to cover it, out loud, in front of people, for weeks. Tonight he told her it wasn't happening. He told her the two of them weren't happening either, in the same breath, in front of half the bar.",
        requires: { npc: 'Skylar Reyes' },
        implicates: 'Skylar Reyes'
      }
    ],
    npcs: [
      {
        tint: 0xff6fa8,
        name: 'Jade Marlow',
        portraitKey: 'portrait-jade',
        fx: 0.15,
        fy: 0.32,
        line: '"I found him. I keep waiting for that to stop being the only thing anyone wants to talk to me about tonight."'
      },
      {
        tint: 0xc9a24a,
        name: 'Sonny Vance',
        portraitKey: 'portrait-sonny',
        fx: 0.5,
        fy: 0.48,
        line: '"Whatever you heard about me and Derek, I didn\'t need him dead. Dead men are terrible at paying what they owe."'
      },
      {
        tint: 0xd97a9c,
        name: 'Marisol Ortiz',
        portraitKey: 'portrait-marisol',
        fx: 0.62,
        fy: 0.47,
        line: '"Twenty-two years married to that man, and I still heard he was dead from a bartender half my age."'
      },
      {
        tint: 0x3ddad7,
        name: 'DJ Cruz',
        portraitKey: 'portrait-cruz',
        fx: 0.82,
        fy: 0.38,
        line: '"Somebody\'s going to ask if I\'m broken up about this. I\'d rather talk about literally anything else."'
      },
      {
        tint: 0xb5c98f,
        name: 'Duck Pruitt',
        portraitKey: 'portrait-duck',
        fx: 0.58,
        fy: 0.42,
        line: '"Forty years I knew that man. Turns out I didn\'t know him at all, not by the end of it."'
      },
      {
        tint: 0x9b7fd4,
        name: 'Roz Kessler',
        portraitKey: 'portrait-roz',
        fx: 0.08,
        fy: 0.78,
        line: '"Well, he\'s not calling anybody\'s kids now, is he. Don\'t look at me like that — I\'m allowed to say it."'
      },
      {
        tint: 0x7f9bd4,
        name: 'Dale Bracken',
        portraitKey: 'portrait-dale',
        fx: 0.95,
        fy: 0.82,
        line: '"Everybody in this room\'s got a story about Derek tonight. Mine\'s just uglier than most of theirs."'
      },
      {
        tint: 0xe85d75,
        name: 'Skylar Reyes',
        portraitKey: 'portrait-skylar',
        fx: 0.25,
        fy: 0.48,
        line: '"He humiliated me in front of this whole bar a few hours ago. Forgive me if I\'m not first in line to cry about him."'
      }
    ]
  },

  mensroom: {
    label: "Men's Room",
    bgKey: 'bg-mensroom',
    prevRoom: 'mainbar',
    nextRoom: 'womensroom',
    hotspots: [
      {
        id: 'N-01',
        fx: 0.48,
        fy: 0.3,
        name: 'A hand-drawn caricature, taped to the stall door',
        note: "Derek, unmistakably, drawn with an enormous grin and an even bigger tab. Somebody's idea of a joke, years old by the look of the tape.",
        requires: { optional: true }
      },
      {
        id: 'N-02',
        fx: 0.6,
        fy: 0.35,
        name: 'Graffiti on the wall, half scratched out',
        note: '"D + M forever," scratched out hard enough to gouge the paint underneath. Old — from back when Derek and Marisol still meant something to each other, probably. Not tonight\'s business.',
        redHerring: true,
        implicates: 'Marisol Ortiz',
        requires: { optional: true }
      },
      {
        id: 'N-03',
        fx: 0.76,
        fy: 0.29,
        name: 'A jammed paper towel dispenser',
        note: 'Empty and jammed, same as it\'s been for a month. On the maintenance list Tiny keeps meaning to get to.',
        requires: { optional: true }
      }
    ],
    npcs: []
  },

  womensroom: {
    label: "Women's Room",
    bgKey: 'bg-womensroom',
    prevRoom: 'mensroom',
    nextRoom: 'office',
    hotspots: [
      {
        id: 'WR-01',
        fx: 0.85,
        fy: 0.3,
        name: 'A lipstick note scrawled across the mirror',
        note: '"Happy Anniversary, jerk." No signature — could be anybody who ever worked a shift here.',
        redHerring: true,
        requires: { optional: true }
      },
      {
        id: 'WR-02',
        fx: 0.25,
        fy: 0.82,
        name: 'A duffel bag, half-packed, stashed in the corner',
        note: "Jade's — a change of clothes, a folded stack of cash, and a bus schedule circled in pen. She's been planning to leave town for a while now.",
        requires: { npc: 'Jade Marlow' },
        implicates: 'Jade Marlow'
      },
      {
        id: 'WR-03',
        fx: 0.35,
        fy: 0.6,
        name: 'A stall door, lock broken clean off',
        note: 'Been broken for as long as anyone can remember. Just one more thing on the list nobody ever gets to.',
        requires: { optional: true }
      }
    ],
    npcs: []
  },

  office: {
    label: "Derek's Office",
    bgKey: 'bg-office',
    prevRoom: 'womensroom',
    nextRoom: 'frontext',
    hotspots: [
      {
        id: 'O-01',
        fx: 0.5,
        fy: 0.55,
        name: "Derek's body",
        note: "He's slumped in the chair behind the desk, exactly as Jade found him during the 2 AM count. No sign of struggle — his hands rest naturally, one loosely near a cold whiskey glass."
      },
      {
        id: 'O-02',
        fx: 0.58,
        fy: 0.66,
        name: 'The "owner\'s shot" — a whiskey glass, cold',
        note: "His nightly ritual, after close, poured by whoever closed with him that night. He drank it without a second thought, same as he had a thousand nights before this one."
      },
      {
        id: 'O-03',
        fx: 0.79,
        fy: 0.33,
        name: 'A framed photo, Derek and Marisol on opening night',
        note: "Eighteen years old, curling at the corners. Two people who clearly liked each other once, a long time before any of this."
      },
      {
        id: 'O-04',
        fx: 0.85,
        fy: 0.58,
        name: 'A draft sale contract, sitting on the desk',
        note: "A development firm's letterhead, and Derek's signature already penciled in. The whole bar, sold out from under every single person who works here — no warning, no severance, nothing.",
        requires: { npc: 'Danny "Tiny" Fisher' },
        implicates: 'Danny "Tiny" Fisher'
      },
      {
        id: 'O-05',
        fx: 0.37,
        fy: 0.44,
        name: "The night's safe count, well short of the register tape",
        note: "A gap between what the register says came in and what actually made it to the safe — small, but consistent, month over month, in a pattern that traces straight back to Jade's own tally.",
        requires: { npc: 'Jade Marlow' },
        implicates: 'Jade Marlow'
      },
      {
        id: 'O-06',
        fx: 0.88,
        fy: 0.7,
        name: 'A bar stool, wiped down, propped behind the door',
        note: "Doesn't belong in here at all — every stool in the building lives out front. Wiped clean, but a few dark flecks remain caught in the joint where the rag missed.",
        requires: { killer: 'Danny "Tiny" Fisher', killerMethod: 'blunt-force' },
        implicates: 'Danny "Tiny" Fisher'
      },
      {
        id: 'O-07',
        fx: 0.4,
        fy: 0.5,
        name: 'The night-deposit bag, strap torn clean through',
        note: "Stuffed back into the open safe with the rest of the night's take, the canvas strap ripped rather than cut — exactly the kind of thing that leaves a mark on somebody's throat.",
        requires: { killer: 'Marisol Ortiz', killerMethod: 'strangulation' },
        implicates: 'Marisol Ortiz'
      },
      {
        id: 'O-08',
        fx: 0.55,
        fy: 0.85,
        name: "Nikki's final paycheck, still in its envelope",
        note: "Made out, sealed, and withheld — sitting in Derek's own desk drawer instead of in her hands, exactly the kind of petty last word he liked to have.",
        requires: { npc: 'Nikki Alvarez' },
        implicates: 'Nikki Alvarez'
      },
      {
        id: 'O-09',
        fx: 0.68,
        fy: 0.85,
        name: 'A thin silk scarf, knotted, stuffed into the office trash bin',
        note: "Skylar's — the same one she was wearing earlier tonight, according to more than one person at the party. Knotted tight enough that it didn't come undone on its own, and buried under enough loose paper that whoever put it there wasn't in a hurry to have it found.",
        requires: { killer: 'Skylar Reyes', killerMethod: 'strangulation' },
        implicates: 'Skylar Reyes'
      }
    ],
    npcs: []
  }
};
