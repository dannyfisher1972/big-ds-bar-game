import { ROOMS } from './rooms.js';
import { isOptionalClueActive } from '../state.js';

// Flat list of every hotspot across every room, tagged with its room label.
// Used by the progress counter (total count), the notebook panel (to show
// found evidence with its room of origin), and the deduction board.
//
// Takes the current game's killer name and this game's murder method, and
// excludes hotspots exclusive to a variant that ISN'T this game's
// (requires.killer or requires.killerMethod set to something else) — those
// can never be found this playthrough, so counting them would make 100%
// evidence impossible and wreck the progress counter and the "Thorough
// Investigator" achievement. requires.optional works the same way, but the
// exclusion is randomized per story slot rather than tied to who the killer
// is — see state.js's isOptionalClueActive — so two different games don't
// always surface the exact same set of atmosphere/red-herring clues.
export function getAllEvidence(currentKiller, currentMethod) {
  return Object.values(ROOMS)
    .flatMap(room => (room.hotspots || []).map(h => ({ ...h, room: room.label })))
    .filter(h => !h.requires?.killer || h.requires.killer === currentKiller)
    .filter(h => !h.requires?.killerMethod || h.requires.killerMethod === currentMethod)
    .filter(h => !h.requires?.optional || isOptionalClueActive(h.id));
}
