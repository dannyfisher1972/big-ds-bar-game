// Shared game-progress state: which evidence has been found, which NPCs have
// been talked to, which rooms have been visited, which questions have been
// asked, which killer this playthrough got, and the current room.
//
// Progress lives in independent "story slots" (each its own localStorage
// entry, keyed by an opaque incrementing id — never the killer's name, so
// nothing here can spoil the mystery before the player even starts). A
// separate pointer tracks which slot is currently active. The player names
// their own investigations; starting a random one either rerolls the active
// slot in place (if it's never been touched) or creates a brand new slot
// (if the active one already has progress worth keeping) — either way nothing
// gets silently overwritten, and unstarted slots don't pile up as orphans.
//
// RoomScene, the notebook panel, the progress counter, and the accusation
// screen all read/write through here instead of keeping their own copies.

const STORAGE_PREFIX = 'bigdsbar-save-story-';
const ACTIVE_STORY_KEY = 'bigdsbar-active-story';
const NEXT_ID_KEY = 'bigdsbar-next-story-id';

// Exactly one scenario per suspect this build — Jade (poison), Tiny
// (blunt-force), Sonny (stabbing), Marisol (strangulation), Cruz
// (blunt-force), Duck (stabbing), Nikki (staged-accident), Roz (poison),
// Dale (blunt-force), Skylar (strangulation) — see src/data/solutions.js.
// Kept as a bare count rather than importing that module, so this stays
// decoupled from game content — update this if that ever changes.
const NUM_KILLER_VARIANTS = 10;

// Beta/QA hook: ?scenario=N in the URL forces that killerIndex instead of
// rolling randomly, so a specific tester can be pointed at a specific
// scenario for coverage testing. Invisible to normal play — no query param
// means no change in behavior.
function pickKillerIndex() {
  try {
    const forced = new URLSearchParams(window.location.search).get('scenario');
    if (forced !== null) {
      const n = parseInt(forced, 10);
      if (Number.isInteger(n) && n >= 0 && n < NUM_KILLER_VARIANTS) return n;
    }
  } catch {
    // no-op — fall through to a random pick
  }
  return Math.floor(Math.random() * NUM_KILLER_VARIANTS);
}

function nextStoryId() {
  try {
    const raw = localStorage.getItem(NEXT_ID_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    const id = Number.isInteger(n) && n > 0 ? n : 1;
    localStorage.setItem(NEXT_ID_KEY, String(id + 1));
    return id;
  } catch {
    return Date.now();
  }
}

function freshSlotData(name) {
  return {
    name: (name && name.trim()) ? name.trim() : 'New Investigation',
    updatedAt: Date.now(),
    evidence: [], talkedTo: [], room: null, roomsVisited: [], achievements: [],
    accusationAttempts: 0, askedQuestions: [], bodyDiscovered: false,
    optionalRolls: {}, dialogueRolls: {},
    killerIndex: pickKillerIndex()
  };
}

function normalizeSlotData(parsed) {
  const fresh = freshSlotData();
  if (!parsed) return fresh;
  return {
    name: (typeof parsed.name === 'string' && parsed.name.trim()) ? parsed.name.trim() : fresh.name,
    updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : fresh.updatedAt,
    evidence: Array.isArray(parsed.evidence) ? parsed.evidence : fresh.evidence,
    talkedTo: Array.isArray(parsed.talkedTo) ? parsed.talkedTo : fresh.talkedTo,
    room: parsed.room || null,
    roomsVisited: Array.isArray(parsed.roomsVisited) ? parsed.roomsVisited : fresh.roomsVisited,
    achievements: Array.isArray(parsed.achievements) ? parsed.achievements : fresh.achievements,
    accusationAttempts: typeof parsed.accusationAttempts === 'number' ? parsed.accusationAttempts : 0,
    askedQuestions: Array.isArray(parsed.askedQuestions) ? parsed.askedQuestions : fresh.askedQuestions,
    bodyDiscovered: typeof parsed.bodyDiscovered === 'boolean' ? parsed.bodyDiscovered : false,
    optionalRolls: (parsed.optionalRolls && typeof parsed.optionalRolls === 'object' && !Array.isArray(parsed.optionalRolls))
      ? parsed.optionalRolls : fresh.optionalRolls,
    dialogueRolls: (parsed.dialogueRolls && typeof parsed.dialogueRolls === 'object' && !Array.isArray(parsed.dialogueRolls))
      ? parsed.dialogueRolls : fresh.dialogueRolls,
    killerIndex: typeof parsed.killerIndex === 'number' ? parsed.killerIndex : fresh.killerIndex
  };
}

function readSlotRaw(storyId) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + storyId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSlotRaw(storyId, data) {
  try {
    localStorage.setItem(STORAGE_PREFIX + storyId, JSON.stringify(data));
  } catch {
    // localStorage unavailable (private browsing, quota) — play continues, it just won't resume after a reload
  }
}

function loadActiveStoryId() {
  try {
    const raw = localStorage.getItem(ACTIVE_STORY_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    return (Number.isInteger(n) && n > 0) ? n : null;
  } catch {
    return null;
  }
}

// Reads a slot, and if it's never been touched before, immediately writes
// its freshly-rolled killer back to localStorage — locking that choice in
// for the slot right away, so a reload before any other action can't
// reroll who did it.
function loadSlot(storyId) {
  const existing = readSlotRaw(storyId);
  const data = normalizeSlotData(existing);
  if (!existing) writeSlotRaw(storyId, data);
  return data;
}

export let activeStory = loadActiveStoryId();
if (activeStory === null) {
  activeStory = nextStoryId();
  try { localStorage.setItem(ACTIVE_STORY_KEY, String(activeStory)); } catch { /* ignore */ }
}
const saved = loadSlot(activeStory);

export const FOUND_EVIDENCE = new Set(saved.evidence);
export const TALKED_TO = new Set(saved.talkedTo);
export const ROOMS_VISITED = new Set(saved.roomsVisited);
export const UNLOCKED_ACHIEVEMENTS = new Set(saved.achievements);
export const ASKED_QUESTIONS = new Set(saved.askedQuestions);
// Which "optional" hotspots (rooms.js's requires.optional flag — pure
// atmosphere and red herrings, never anything needed to solve the case) are
// actually present this game. Rolled lazily, once per id, the first time
// it's asked about, then cached here for the rest of the playthrough — so
// two different story slots end up with a different mix of side detail,
// instead of every game surfacing the exact same set of extras.
const OPTIONAL_ROLLS = { ...saved.optionalRolls };
// Which variant of a line with more than one possible phrasing plays this
// game — rolled lazily and cached the same way as OPTIONAL_ROLLS above, but
// for dialogue rather than hotspots. None of this build's characters
// actually define a second phrasing (see characters.js's note on that), so
// this stays effectively unused for now — the machinery's kept in case a
// future pass wants to add `${id}Alt` fields.
const DIALOGUE_ROLLS = { ...saved.dialogueRolls };
export let currentRoom = saved.room;
export let accusationAttempts = saved.accusationAttempts;
// For Nikki's staged-accident scenario (see solutions.js's discoveryDelayed),
// the death looks like a drunk stumble at a glance — the office starts
// without a visible body until the player looks closer. This flips true the
// first time that happens, revealing the office's real clues from then on.
// Irrelevant (and ignored) for every other scenario, where the body is
// there from the start.
export let bodyDiscovered = saved.bodyDiscovered;
export let killerIndex = saved.killerIndex;
// The player's own name for this investigation — shown on the title screen's
// "Continue" button and in the saved-investigations list. Never the killer's
// name; purely a label the player picks for themselves.
export let storyName = saved.name;

const listeners = new Set();
export function onStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function persist() {
  writeSlotRaw(activeStory, {
    name: storyName,
    updatedAt: Date.now(),
    evidence: [...FOUND_EVIDENCE],
    talkedTo: [...TALKED_TO],
    room: currentRoom,
    roomsVisited: [...ROOMS_VISITED],
    achievements: [...UNLOCKED_ACHIEVEMENTS],
    accusationAttempts,
    askedQuestions: [...ASKED_QUESTIONS],
    bodyDiscovered,
    optionalRolls: { ...OPTIONAL_ROLLS },
    dialogueRolls: { ...DIALOGUE_ROLLS },
    killerIndex
  });
  listeners.forEach(fn => fn());
}

// Picks (and permanently caches) which of `count` variants of a line plays
// this story slot, keyed by whatever string the caller passes (e.g. an NPC
// name). Never rolled per-scenario or tied to killerIndex — see
// DIALOGUE_ROLLS above for why that matters.
export function pickDialogueVariant(key, count) {
  if (Object.prototype.hasOwnProperty.call(DIALOGUE_ROLLS, key)) return DIALOGUE_ROLLS[key];
  const variant = Math.floor(Math.random() * count);
  DIALOGUE_ROLLS[key] = variant;
  persist();
  return variant;
}

// 60% of eligible hotspots show up in any given game — enough that a replay
// still feels substantially the same (this isn't meant to hide anything
// load-bearing), but different enough that you won't see the exact same set
// of side details and red herrings every single time.
const OPTIONAL_INCLUSION_CHANCE = 0.6;

export function isOptionalClueActive(id) {
  if (Object.prototype.hasOwnProperty.call(OPTIONAL_ROLLS, id)) return OPTIONAL_ROLLS[id];
  const active = Math.random() < OPTIONAL_INCLUSION_CHANCE;
  OPTIONAL_ROLLS[id] = active;
  persist();
  return active;
}

// Also true once an accusation's been made, even if it happened with zero
// evidence collected (the soft-gate lets a player push through the warning)
// — otherwise a finished, won-or-lost case could look "never touched" and
// get silently reused or hidden by startRandomStory()/getSavedStories().
export function hasSavedProgress() {
  return FOUND_EVIDENCE.size > 0 || TALKED_TO.size > 0 || accusationAttempts > 0;
}

export function markEvidenceFound(id) {
  if (FOUND_EVIDENCE.has(id)) return;
  FOUND_EVIDENCE.add(id);
  persist();
}

export function markTalkedTo(name) {
  if (TALKED_TO.has(name)) return;
  TALKED_TO.add(name);
  persist();
}

export function markRoomVisited(key) {
  if (ROOMS_VISITED.has(key)) return;
  ROOMS_VISITED.add(key);
  persist();
}

export function setCurrentRoom(key) {
  currentRoom = key;
  persist();
}

export function recordAccusationAttempt() {
  accusationAttempts += 1;
  persist();
}

export function markQuestionAsked(npcName, questionId) {
  const key = `${npcName}|${questionId}`;
  if (ASKED_QUESTIONS.has(key)) return;
  ASKED_QUESTIONS.add(key);
  persist();
}

export function markBodyDiscovered() {
  if (bodyDiscovered) return;
  bodyDiscovered = true;
  persist();
}

// Re-evaluates every achievement against current progress and unlocks any
// newly-earned ones. Totals are passed in (rather than imported here) so this
// module doesn't need to know about the room/evidence/character data shapes.
// `lastAccusationCorrect` should only be passed at the moment of an actual
// accusation — omitting it elsewhere prevents "First Instinct" from being
// evaluated against stale state on unrelated changes.
export function checkAchievements({ totalEvidence, totalRooms, totalCharacters, lastAccusationCorrect, allQuestionsAsked }) {
  const newly = [];
  const unlock = (id) => {
    if (!UNLOCKED_ACHIEVEMENTS.has(id)) {
      UNLOCKED_ACHIEVEMENTS.add(id);
      newly.push(id);
    }
  };
  if (FOUND_EVIDENCE.size >= totalEvidence) unlock('thorough');
  if (ROOMS_VISITED.size >= totalRooms) unlock('full-house');
  if (TALKED_TO.size >= totalCharacters) unlock('interrogator');
  if (lastAccusationCorrect && accusationAttempts === 1) unlock('first-instinct');
  if (allQuestionsAsked) unlock('no-stone-unturned');
  if (newly.length) persist();
  return newly;
}

// Restarts THIS story slot from scratch — clears its progress and rerolls
// its killer, same slot id. An explicit name (if given) replaces the old
// one; otherwise the slot keeps whatever it was called.
export function resetProgress(name) {
  FOUND_EVIDENCE.clear();
  TALKED_TO.clear();
  ROOMS_VISITED.clear();
  UNLOCKED_ACHIEVEMENTS.clear();
  ASKED_QUESTIONS.clear();
  currentRoom = null;
  accusationAttempts = 0;
  bodyDiscovered = false;
  for (const key of Object.keys(OPTIONAL_ROLLS)) delete OPTIONAL_ROLLS[key];
  for (const key of Object.keys(DIALOGUE_ROLLS)) delete DIALOGUE_ROLLS[key];
  killerIndex = pickKillerIndex();
  if (name && name.trim()) storyName = name.trim();
  persist();
}

export function renameActiveStory(name) {
  if (!name || !name.trim()) return;
  storyName = name.trim();
  persist();
}

// Called by the title screen's "Random Investigation" button. If the
// currently active slot has never actually been played, it's reused in
// place (rerolled and renamed) instead of left behind as an empty orphan;
// if it already has real progress, a brand new slot is created so nothing
// gets overwritten. Either way, the caller should reload the page afterward
// so this module re-initializes from the (possibly new) active slot.
export function startRandomStory(name) {
  if (!hasSavedProgress()) {
    resetProgress(name || 'New Investigation');
    return activeStory;
  }
  const id = nextStoryId();
  writeSlotRaw(id, freshSlotData(name || 'New Investigation'));
  setActiveStory(id);
  return id;
}

// Switches which slot is active. Does not reload itself — callers should
// reload the page afterward so this module re-initializes from the newly
// active slot (killerIndex/etc. are resolved once at module load).
export function setActiveStory(storyId) {
  try {
    localStorage.setItem(ACTIVE_STORY_KEY, String(storyId));
  } catch {
    // ignore — worst case the picker's selection doesn't stick across reload
  }
}

export function renameStory(storyId, name) {
  if (!name || !name.trim()) return;
  const raw = readSlotRaw(storyId);
  if (!raw) return;
  raw.name = name.trim();
  writeSlotRaw(storyId, raw);
}

export function deleteStory(storyId) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + storyId);
  } catch {
    // ignore
  }
}

// Every started investigation (never the unstarted default slot a fresh
// visit silently creates), for the title screen's "continue" list. Sorted
// most-recently-played first. Deliberately never reveals who the killer is —
// just the player's own name for it and how much evidence has been found.
export function getSavedStories() {
  const stories = [];
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(STORAGE_PREFIX)) continue;
      const id = parseInt(key.slice(STORAGE_PREFIX.length), 10);
      if (!Number.isInteger(id)) continue;
      const raw = readSlotRaw(id);
      if (!raw) continue;
      const evidenceCount = Array.isArray(raw.evidence) ? raw.evidence.length : 0;
      const talkedToCount = Array.isArray(raw.talkedTo) ? raw.talkedTo.length : 0;
      const accusationCount = typeof raw.accusationAttempts === 'number' ? raw.accusationAttempts : 0;
      if (evidenceCount === 0 && talkedToCount === 0 && accusationCount === 0) continue;
      stories.push({
        id,
        name: (typeof raw.name === 'string' && raw.name.trim()) ? raw.name.trim() : `Investigation ${id}`,
        evidenceCount,
        updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0
      });
    }
  } catch {
    // ignore — worst case the list just shows nothing
  }
  return stories.sort((a, b) => b.updatedAt - a.updatedAt);
}
