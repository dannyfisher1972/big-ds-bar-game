// A curated timeline of the night, in chronological order — independent of
// which killer this game got, since it's built entirely from shared,
// killer-invariant testimony. Each entry only appears once its reveal
// condition is actually satisfied (a specific clue found, or a specific
// question asked of a specific person), so the timeline can't hand the
// player anything they haven't learned themselves yet.
//
// reveal is either { evidence: 'id' } or { npc: 'Full Name', questionId: 'id' }.
export const TIMELINE = [
  {
    time: '22:45', label: '10:45 PM',
    text: 'Derek fires Nikki in front of the whole bar and tells her to clear her locker.',
    reveal: { npc: 'Nikki Alvarez', questionId: 'alibi' }
  },
  {
    time: '23:00', label: '11:00 PM',
    text: 'Duck steps out back for a cigarette after a tense night of darts.',
    reveal: { npc: 'Duck Pruitt', questionId: 'alibi' }
  },
  {
    time: '23:10', label: '11:10 PM',
    text: "Sonny is still at the pool table, though he'll later say he'd already left by now.",
    reveal: { npc: 'Sonny Vance', questionId: 'alibi' }
  },
  {
    time: '23:20', label: '11:20 PM',
    text: 'Marisol holds court in the corner booth, needling the regulars about her stake in the bar.',
    reveal: { npc: 'Marisol Ortiz', questionId: 'alibi' }
  },
  {
    time: '23:30', label: '11:30 PM',
    text: 'DJ Cruz dedicates a pointed song "to somebody who deserves better."',
    reveal: { evidence: 'M-10' }
  },
  {
    time: '23:40', label: '11:40 PM',
    text: 'Tiny begins the final walkthrough, locking up the patio.',
    reveal: { npc: 'Danny "Tiny" Fisher', questionId: 'alibi' }
  },
  {
    time: '23:50', label: '11:50 PM',
    text: "Jade pours Derek's nightly \"owner's shot\" as he starts the close-out.",
    reveal: { evidence: 'O-02' }
  },
  {
    time: '00:15', label: '12:15 AM',
    text: "Nikki's car is still in the lot, engine still warm, long after she says she left.",
    reveal: { evidence: 'P-04' }
  },
  {
    time: '01:50', label: '1:50 AM',
    text: 'Jade finds Derek in the office during the final register count.',
    reveal: { evidence: 'O-01' }
  }
];
