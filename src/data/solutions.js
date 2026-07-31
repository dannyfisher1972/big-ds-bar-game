// Ten possible ways this night could have gone, chosen at random each time
// a new investigation starts (see state.js's killerIndex and
// NUM_KILLER_VARIANTS), or pinned directly via the title screen's storyline
// picker. Every game, ALL motive clues for the real suspects are visible —
// they're real people with real reasons, not padding. What changes per game
// is the actual method (see `method`, checked via requires.killerMethod in
// rooms.js) and which killer-exclusive physical clue confirms who did this.
// Each suspect here has exactly one method — no alternate-weapon variants —
// so there's exactly one SOLUTIONS entry per suspect.
//
// `sceneNotes` overrides specific hotspot text (by id) for this scenario —
// used by O-01 (the body) and O-02 (his last drink) so the same office
// layout can describe a completely different manner of death without
// needing separate art per scenario.
export const SOLUTIONS = [
  {
    killer: 'Jade Marlow',
    method: 'poison',
    keyEvidence: ['M-02', 'WR-02', 'O-05', 'M-01', 'O-02'],
    sceneNotes: {
      'O-01': "He's slumped back in the office chair, one hand loose at his side. No sign of a struggle — his face has gone faintly grey, and there's a bitter, metallic smell in the air that has nothing to do with the bottle on the desk.",
      'O-02': "The \"owner's shot\" — his nightly ritual, poured by whoever closed with him. He drank it calmly, without a second thought. He never saw a reason not to trust it."
    },
    explanation: [
      "It was Jade. Derek had cornered her in this same office earlier that week and threatened to have her arrested for the tips she'd been skimming the moment she tried to give her notice — trapping her here with no clean way out.",
      "The rat poison missing from under the bar sink traces straight back to the \"owner's shot\" — the whiskey he drank after close every single night, poured by whoever was closing with him. Her own register tally didn't add up either, and a half-packed duffel bag, stashed in the women's room, said exactly how badly she wanted gone.",
      "She's the one who found him during the 2 AM count — which made her the last person anyone thought to suspect. He trusted her enough to drink whatever she handed him without a second look. That's what let her get close enough."
    ]
  },
  {
    killer: 'Tiny Escobar',
    method: 'blunt-force',
    keyEvidence: ['O-04', 'O-06'],
    sceneNotes: {
      'O-01': "He's slumped over the desk, and at a glance it could almost be a bad night catching up with him — except for the dark, matted patch above his ear, easy to miss under the office's bad lighting.",
      'O-02': "Untouched, poured but never finished. Whatever happened in here, it happened before he got around to his nightly ritual."
    },
    explanation: [
      "It was Tiny. He found the sale contract on Derek's own desk while looking for something else entirely — Derek had been quietly negotiating to sell the bar to a developer, every employee gone with no warning and no severance, after Tiny had spent months covering payroll shortfalls out of his own pocket just to keep the place standing.",
      "A bar stool from the floor turned up wiped down and shoved behind the office door — dark flecks still caught in the grip where the cleaning missed. He confronted Derek about the sale during the final walkthrough, and it didn't stay a conversation for long.",
      "Ten years of loyalty, and Derek never even told him the bar was being sold out from under him. He never saw the stool coming, and neither did anyone else in the building."
    ]
  },
  {
    killer: 'Sonny Vance',
    method: 'stabbing',
    keyEvidence: ['M-04', 'P-01'],
    sceneNotes: {
      'O-01': "He's slumped forward over the desk, a dark stain spreading across his shirt. Whatever happened here happened fast, and up close.",
      'O-02': "Knocked over and unfinished, a thin trail of whiskey dried along the edge of the desk. He never got the chance to pick it back up."
    },
    explanation: [
      "It was Sonny. The ledger tucked under the felt of the pool table confirmed what half the bar already suspected — Derek owed him a serious sum and had spent weeks avoiding his calls, which is not a thing you get to do to Sonny indefinitely.",
      "A gym bag in his car, still in the parking lot, held the broken end of a pool cue with a blood-flecked tip — snapped clean off during whatever happened in that office. He told everyone he left before closing. Nobody there could actually say when.",
      "Derek spent eighteen years building a reputation as a man who could talk his way out of anything. That reputation didn't mean much to a man who'd stopped believing his excuses months ago."
    ]
  },
  {
    killer: 'Marisol Ortiz',
    method: 'strangulation',
    keyEvidence: ['M-07', 'O-07'],
    sceneNotes: {
      'O-01': "He's still in the chair, head tipped back, a thin dark line just visible at his throat above the collar. No sign anyone else was ever in the room, if you don't look closely.",
      'O-02': "Poured and left standing, condensation long since dried on the glass. Whatever happened in here, it happened before he ever got around to it."
    },
    explanation: [
      "It was Marisol. The buyout paperwork that spilled out of her purse near her booth told the story — Derek's latest offer for her 40% stake was a lowball insult after twenty-two years of marriage and a decade of being told the real number was \"complicated.\"",
      "The bank's night-deposit bag, its strap torn clean through, was found stuffed back in the safe with the rest of the night's take — the same bag used to hold him down. She held court at that booth for hours, same as every anniversary, and told everyone she left before close.",
      "Derek always assumed Marisol's bitterness was for show — a woman who liked reminding the room she still had a claim, nothing more. He never once thought she'd collect on it herself."
    ]
  },
  {
    killer: 'DJ Cruz',
    method: 'blunt-force',
    keyEvidence: ['M-09', 'M-10', 'M-08'],
    sceneNotes: {
      'O-01': "He's slumped across the desk, a dark bruise blooming at his temple. At a glance it's almost peaceful — except for the wound nobody's supposed to walk away from.",
      'O-02': "Knocked clean off the desk and left where it rolled, a thin crack down one side. Whoever did this wasn't thinking about the glass."
    },
    explanation: [
      "It was Cruz. He'd watched Derek treat Jade like property for months, and that night he finally saw exactly how far it went — Derek grabbing her wrist hard enough to bruise, right there in the back hallway, in full view of anyone who happened to look.",
      "He dedicated a pointed song earlier that night \"to somebody who deserves better\" — staff remember it clearly, even if nobody put it together until later. A vinyl crate from the karaoke stage turned up wiped down and shoved under the DJ booth, one corner still faintly stained.",
      "He slipped away from the booth for maybe twenty minutes, by his own account. That was more than enough time. Derek never once thought the quiet kid running the karaoke machine was capable of this — that was exactly the point."
    ]
  },
  {
    killer: 'Duck Pruitt',
    method: 'stabbing',
    keyEvidence: ['M-05', 'M-06'],
    sceneNotes: {
      'O-01': "He's slumped in the desk chair, several thin puncture wounds visible through his shirt. Whatever hit him, it hit more than once.",
      'O-02': "Untouched on the desk, the ice long melted. He never got around to it tonight."
    },
    explanation: [
      "It was Duck. Forty years of friendship, and he found out the same night everyone else nearly did — a motel note addressed to his own wife, tucked in Derek's coat behind the bar, in Derek's own handwriting, over a year of it.",
      "A handful of steel-tip darts turned up missing from the board's usual set — one recovered afterward with dried blood still on the point. He'd stepped out back for a cigarette around closing, same as always, except this time he didn't come straight back.",
      "Derek spent his whole life picking careless fights he could always talk his way out of. He picked the wrong one, with the wrong oldest friend, on the one night that friend had nothing left to lose."
    ]
  },
  {
    // Nikki didn't want a fight — she came back for what was hers, and it
    // went wrong fast. The office looks like an accident at first glance
    // (see discoveryDelayed/firstGlanceNote), so the room stays hidden
    // behind a single "look closer" hotspot until the player commits to it —
    // see RoomScene.js's preDiscovery handling for the office.
    killer: 'Nikki Alvarez',
    method: 'staged-accident',
    discoveryDelayed: true,
    firstGlanceNote: "From the doorway, it looks like he simply missed a step on the way down — sprawled at the bottom of the back stairs, half in the office, half not. You'll need to look closer.",
    keyEvidence: ['O-08', 'B-05', 'P-04'],
    sceneNotes: {
      'O-01': "Up close, it doesn't read as a fall anymore — the angle's wrong, and there's a mark at the back of his skull that a stumble down a flight of stairs doesn't explain on its own. Someone wanted this to look like an accident, and very nearly managed it.",
      'O-02': "Untouched, still cold. He never made it to his nightly ritual at all tonight."
    },
    explanation: [
      "It was Nikki. Fired in front of the whole bar hours earlier and told to clear her locker before the party even ended, she told everyone she left around eleven. Her car said otherwise — the engine was still warm well past the time she claimed to be gone.",
      "She came back for her things, and for her final paycheck — withheld, sitting in the office the whole time, exactly where Derek left it out of spite. Scuff and drag marks on the steep back stairs told the rest: he didn't fall. He was pushed, and then arranged to look like he had.",
      "A torn scrap of her apron, snagged on the stairway railing, was the one piece she couldn't take back with her. Derek fired a lot of people over the years. He never once thought one of them would come back the same night."
    ]
  },
  {
    killer: 'Roz Kessler',
    method: 'poison',
    keyEvidence: ['M-13', 'M-15'],
    sceneNotes: {
      'O-01': "He's slumped in the office chair, hands loose at his sides. No sign of a struggle — just a waxy grey cast to his face, and a faint chalky residue clinging to the rim of the glass on the desk.",
      'O-02': "The \"owner's shot,\" poured by whoever closed with him that night, same as every night. He drank the whole thing without noticing anything was off — he never had a reason to."
    },
    explanation: [
      "It was Roz. Derek had quietly let her tab run for years — half pity, half good business, a regular who was good for the room's atmosphere even drunk. That arrangement ended the week he told her he was through covering for her: pay up, or he'd call her grown kids himself and tell them everything, publicly, at the anniversary party.",
      "A pill bottle turned up in her purse, left hooked on the back of her usual chair — her own prescription, rattling near-empty, a fine crushed residue still clinging to the inside of the cap. She told everyone she never left her table except for a few minutes in the restroom. Those few minutes were apparently enough.",
      "Derek liked to say Roz was harmless — a sad, funny drunk who paid her tab eventually, one way or another. He never once considered that threatening to humiliate her in front of her own children might be the one thing she wouldn't just sit there and take."
    ]
  },
  {
    killer: 'Dale Bracken',
    method: 'blunt-force',
    keyEvidence: ['M-14', 'M-16'],
    sceneNotes: {
      'O-01': "He's slumped forward across the desk, a dark, deep bruise visible along the back of his skull. Whatever hit him, it hit hard, and just the once.",
      'O-02': "Untouched, still full, condensation long gone. He never got the chance to pour himself a second thought about closing up for the night."
    },
    explanation: [
      "It was Dale. Derek testified against him in the divorce, about the drinking he'd watched firsthand from behind his own bar for years — testimony that cost Dale the custody case and any real settlement, on top of a marriage that was already ending anyway.",
      "A heavy glass ashtray from his own table turned up wiped clean and sitting oddly spotless in the middle of the night's usual mess — everything else at that table was exactly as sticky and cluttered as you'd expect. He says he never left his seat except for the restroom, same story as his ex-wife, sitting on the opposite side of a room he still can't bring himself to look across.",
      "Derek always figured Dale's grudge was just a drunk's grudge — the kind that talks big and never actually moves. He found out too late exactly how wrong that assumption was."
    ]
  },
  {
    killer: 'Skylar Reyes',
    method: 'strangulation',
    keyEvidence: ['M-17', 'O-09'],
    sceneNotes: {
      'O-01': "He's still in the chair, head tipped back, a thin dark line just visible at his throat above the collar. No sign anyone else was ever in the room, if you don't look closely.",
      'O-02': "Poured and left standing, condensation long since dried on the glass. Whatever happened in here, it happened before he ever got around to it."
    },
    explanation: [
      "It was Skylar. She'd been counting on Derek to cover last month's rent — he'd talked her into counting on it, out loud, more than once. Tonight, in front of half the bar, he told her it was over and that the money wasn't coming either, in the same breath, like neither one was worth softening.",
      "A thin silk scarf — hers, the one she'd been wearing earlier that night — turned up knotted and buried in the office trash, stuffed under enough loose paper that it clearly wasn't meant to be found right away. She says she stepped out back for air around the time it happened. Alone, with nobody to say otherwise.",
      "Derek liked to think the arrangement was easy for both of them, right up until the night he tried to end it and take her landlord's patience along with it. He never once thought she'd be the one left with nothing to lose."
    ]
  }
];
