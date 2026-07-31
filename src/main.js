import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import RoomScene from './scenes/RoomScene.js';
import { CHARACTERS } from './data/characters.js';
import { getAllEvidence } from './data/evidenceCatalog.js';
import { SOLUTIONS } from './data/solutions.js';
import { BASE_QUESTIONS, FOLLOWUPS } from './data/questions.js';
import { TIMELINE } from './data/timeline.js';
import { ROOM_ORDER, ROOMS } from './data/rooms.js';
import { ACHIEVEMENTS } from './data/achievements.js';
import {
  FOUND_EVIDENCE, TALKED_TO, onStateChange, resetProgress, hasSavedProgress,
  UNLOCKED_ACHIEVEMENTS, checkAchievements, recordAccusationAttempt, accusationAttempts, killerIndex,
  ASKED_QUESTIONS,
  activeStory, setActiveStory, storyName, renameActiveStory, startRandomStory,
  getSavedStories, renameStory, deleteStory
} from './state.js';
import { initAudio, setMuted, isMuted, playClick, playWinSting, playLoseSting } from './audio.js';

// Fixed for the whole playthrough (only reshuffles via resetProgress on a new
// investigation), so it's safe to resolve once here rather than threading it
// through every function that needs to know the evidence total or the answer.
const SOLUTION = SOLUTIONS[killerIndex];
const ALL_EVIDENCE = getAllEvidence(SOLUTION.killer, SOLUTION.method);

// Note: no global `pixelArt: true` here — it would force nearest-neighbor
// filtering on every texture, which would ruin the photorealistic
// AI-generated backgrounds and portraits (crunchy/aliased instead of smooth).
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 960,
  height: 640,
  backgroundColor: '#0a0908',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 640
  },
  render: { preserveDrawingBuffer: true },
  // A second active pointer is needed for pinch-to-zoom (RoomScene tracks the
  // distance between two simultaneous touches) — Phaser only tracks one by
  // default.
  input: { activePointers: 2 },
  scene: [BootScene, RoomScene]
};

let game = null;

const startBtn = document.getElementById('startBtn');
const startBtnVerbEl = document.getElementById('startBtnVerb');
const startBtnStoryNameEl = document.getElementById('startBtnStoryName');
function renderStartBtnLabel() {
  if (hasSavedProgress()) {
    startBtnVerbEl.textContent = 'Resume Investigation';
    // Quoted and rendered in its own normal-case span (see .start-btn-story-name)
    // so a never-renamed save — literally named "New Investigation" — doesn't
    // collide with the verb into a single uppercase, self-contradictory phrase.
    startBtnStoryNameEl.textContent = `"${storyName}"`;
  } else {
    startBtnVerbEl.textContent = 'Begin the Investigation';
    startBtnStoryNameEl.textContent = '';
  }
}
renderStartBtnLabel();

// Lets a returning player deliberately wipe their saved room/evidence instead
// of always resuming — only shown when there's actually something to clear.
const resetLink = document.getElementById('resetLink');
if (hasSavedProgress()) resetLink.style.display = 'block';
resetLink.addEventListener('click', () => {
  resetProgress();
  location.reload();
});

// Only meaningful once there's an existing save to branch away from — for
// a never-played slot, this would just be a second, redundant way to do
// exactly what "Begin the Investigation" already does.
const newInvestigationControls = document.getElementById('newInvestigationControls');
if (hasSavedProgress()) newInvestigationControls.style.display = 'flex';

// The player's own name for whichever investigation is currently active —
// never the killer's, purely a label they pick for themselves. Renaming
// just relabels the save in place; it doesn't touch progress or reload.
const storyNameInput = document.getElementById('storyNameInput');
storyNameInput.value = storyName;
document.getElementById('renameStoryBtn').addEventListener('click', () => {
  playClick();
  renameActiveStory(storyNameInput.value);
  renderStartBtnLabel();
  renderSavedStories();
});

// Starts something new: if the currently active slot has never actually
// been played, it's rerolled in place (no orphaned empty saves pile up);
// otherwise a brand new save is created so existing progress is never lost.
document.getElementById('randomStoryBtn').addEventListener('click', () => {
  playClick();
  startRandomStory(storyNameInput.value);
  location.reload();
});

// Every other started investigation (the active one already has its own
// Continue button above) — resume, rename inline, or delete. Never labeled
// with who the killer is, just the player's own name and progress so far.
const savedStoriesSection = document.getElementById('savedStoriesSection');
const savedStoriesList = document.getElementById('savedStoriesList');
function renderSavedStories() {
  const others = getSavedStories().filter((s) => s.id !== activeStory);
  if (!others.length) {
    savedStoriesSection.style.display = 'none';
    return;
  }
  savedStoriesSection.style.display = 'block';
  savedStoriesList.innerHTML = others.map((s) => `
    <div class="saved-story-row" data-id="${s.id}">
      <input class="saved-story-name" value="${s.name.replace(/"/g, '&quot;')}" maxlength="60">
      <span class="saved-story-meta">${s.evidenceCount} clue${s.evidenceCount === 1 ? '' : 's'} found</span>
      <button class="btn secondary saved-story-resume">Resume</button>
      <button class="saved-story-delete" title="Delete this investigation" aria-label="Delete this investigation">&times;</button>
    </div>
  `).join('');
  savedStoriesList.querySelectorAll('.saved-story-row').forEach((row) => {
    const id = Number(row.dataset.id);
    const nameEl = row.querySelector('.saved-story-name');
    nameEl.addEventListener('change', () => renameStory(id, nameEl.value));
    row.querySelector('.saved-story-resume').addEventListener('click', () => {
      playClick();
      setActiveStory(id);
      location.reload();
    });
    row.querySelector('.saved-story-delete').addEventListener('click', () => {
      playClick();
      deleteStory(id);
      renderSavedStories();
    });
  });
}
renderSavedStories();

startBtn.addEventListener('click', () => {
  document.getElementById('titleScreen').classList.add('hidden');
  initAudio(); // first user gesture on the page — safe to start the AudioContext here
  if (!game) {
    game = new Phaser.Game(config);
    window.__game = game;
  }
});

// Click-to-enlarge lightbox for Derek's portrait on the briefing screen.
const victimModal = document.getElementById('victimModal');
document.getElementById('victimPortrait').addEventListener('click', () => {
  victimModal.classList.add('open');
});

// In-game "Case File" — lets the player revisit the murder briefing and
// Derek's dossier at any point during play, not just before starting.
const caseFileModal = document.getElementById('caseFileModal');
document.getElementById('caseFileBtn').addEventListener('click', () => {
  playClick();
  caseFileModal.classList.add('open');
});

// Real portrait path for a character, plus an inline-SVG fallback (a ring in
// their board color around their initial) for anyone whose art hasn't been
// generated yet. Needed because these are plain <img> tags outside Phaser —
// RoomScene's own placeholder system doesn't cover the title screen, board,
// or accusation grid. A same-origin dev server returning 200 for a missing
// file (instead of a 404) would otherwise show a broken-image icon here.
function portraitSrc(c) {
  return `${import.meta.env.BASE_URL}assets/ai-art/${c.portraitKey.replace('portrait-', '')}.png`;
}
function portraitFallbackSrc(c) {
  const color = '#' + c.tint.toString(16).padStart(6, '0');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`
    + `<rect width="100" height="100" fill="#2a2622"/>`
    + `<circle cx="50" cy="50" r="45" fill="none" stroke="${color}" stroke-width="4"/>`
    + `<text x="50" y="64" font-family="Georgia,serif" font-size="46" font-weight="700" fill="#e9e6da" text-anchor="middle">${c.name.charAt(0)}</text>`
    + `</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
function portraitImgAttrs(c) {
  return `src="${portraitSrc(c)}" onerror="this.onerror=null;this.src='${portraitFallbackSrc(c)}'"`;
}

// The full-screen "Meet the Regulars" cast modal, opened from its own
// button on the briefing screen rather than a side panel — the sidebar
// version left the roster below the fold (and off-screen entirely) on
// mobile, so a returning-to-scroll discovery wasn't reliable. Built from
// src/data/characters.js so it stays in sync with the NPCs actually placed
// in each room. Grid card click swaps to a single-character detail view
// within the same modal; "Back" swaps back. Re-opening the modal always
// resets to the grid, since it's the only entry point.
const castModal = document.getElementById('castModal');
const castGridView = document.getElementById('castGridView');
const castDetailView = document.getElementById('castDetailView');
const castGrid = document.getElementById('castGrid');
const castDetailImg = document.getElementById('castDetailImg');
const castDetailName = document.getElementById('castDetailName');
const castDetailRole = document.getElementById('castDetailRole');
const castDetailBio = document.getElementById('castDetailBio');

// Derek isn't in CHARACTERS (built from ROOMS' npcs — he's the victim, never
// an NPC you talk to, so he'd wrongly show up on the deduction board and
// retalk panel if he were). He still belongs in the regulars' roster though,
// so he's added here only, for the grid's benefit.
const BIGD_HOUSEHOLD_ENTRY = {
  name: 'Derek "Big D" Delgado',
  // portraitFallbackSrc() below reads `tint` unconditionally (it builds the
  // onerror fallback string eagerly, not lazily inside the error handler),
  // so every card in this grid needs one, not just the CHARACTERS entries
  // that come with their own board/portrait-ring color from rooms.js.
  tint: 0xe8a33d,
  portraitKey: 'portrait-bigd',
  role: "The Victim — Owner, Big D's Bar",
  bio: "Derek built Big D's Bar from nothing into the only place in town worth showing up to on a Friday, over eighteen years. Charismatic behind the bar and controlling everywhere else, he kept careful track of exactly what everyone around him owed — in money, in loyalty, or in silence."
};

[BIGD_HOUSEHOLD_ENTRY, ...CHARACTERS].forEach((c) => {
  const shownName = c.displayName || c.name;
  const card = document.createElement('div');
  card.className = 'cast-card';
  card.innerHTML = `
    <img ${portraitImgAttrs(c)} alt="${shownName}">
    <span class="cast-card-name">${shownName}</span>
    <span class="cast-card-role">${c.role || ''}</span>
  `;
  card.addEventListener('click', () => {
    castDetailImg.onerror = () => { castDetailImg.onerror = null; castDetailImg.src = portraitFallbackSrc(c); };
    castDetailImg.src = portraitSrc(c);
    castDetailImg.alt = shownName;
    castDetailName.textContent = shownName;
    castDetailRole.textContent = c.role || '';
    castDetailBio.textContent = c.bio || '';
    castGridView.style.display = 'none';
    castDetailView.style.display = 'block';
  });
  castGrid.appendChild(card);
});

document.getElementById('castDetailBack').addEventListener('click', () => {
  castDetailView.style.display = 'none';
  castGridView.style.display = 'block';
});

document.getElementById('meetHouseholdBtn').addEventListener('click', () => {
  playClick();
  castDetailView.style.display = 'none';
  castGridView.style.display = 'block';
  castModal.classList.add('open');
});

// Both lightboxes (Derek's dossier and each suspect's bio) share the
// .person-modal class, so one set of handlers closes whichever is open. For
// castModal specifically, "close" while a character's detail is showing
// should back out to the regulars grid instead of leaving the modal
// entirely — a player closing Jade's bio almost certainly meant "stop
// looking at Jade," not "stop looking at the regulars."
function closePersonModal(modal) {
  if (modal === castModal && castDetailView.style.display !== 'none') {
    castDetailView.style.display = 'none';
    castGridView.style.display = 'block';
    return;
  }
  modal.classList.remove('open');
}
document.querySelectorAll('.person-modal-close').forEach((btn) => {
  btn.addEventListener('click', () => closePersonModal(btn.closest('.person-modal')));
});
document.querySelectorAll('.person-modal').forEach((modal) => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closePersonModal(modal);
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.person-modal.open').forEach((m) => closePersonModal(m));
  }
});
// Any <button> keeps DOM focus after being clicked, so a later Space/Enter
// press can silently re-trigger it (room-nav arrows are the case that bit
// us). Blurring right after the click removes that lingering focus everywhere,
// not just for room-nav buttons.
document.addEventListener('click', (e) => {
  if (e.target instanceof HTMLButtonElement) {
    e.target.blur();
  }
});

// --- Progress counter ---------------------------------------------------
const progressBadge = document.getElementById('progressBadge');
function renderProgress() {
  progressBadge.textContent = `${FOUND_EVIDENCE.size} / ${ALL_EVIDENCE.length} clues found`;
}
onStateChange(renderProgress);
renderProgress();

// --- Onboarding hint dismissal ----------------------------------------------
// #hint / #hint-touch sit at a fixed spot near the top of the game area (see
// index.html) — fine as a one-time nudge, but on a short mobile landscape
// viewport that fixed position can land right on top of a room's own
// top-row clues, and CSS alone has no way to know the player already got
// the message. Once they've found anything or talked to anyone, they've
// demonstrated they know to tap glowing things — hide it for good so it
// stops covering clues for the rest of the playthrough.
const hintEl = document.getElementById('hint');
const hintTouchEl = document.getElementById('hint-touch');
function renderHintVisibility() {
  const seenIt = FOUND_EVIDENCE.size > 0 || TALKED_TO.size > 0;
  // Clearing back to '' (rather than never touching it) lets a brand new
  // investigation slot show the hint again instead of staying hidden from
  // a previous playthrough's progress.
  hintEl.style.display = seenIt ? 'none' : '';
  hintTouchEl.style.display = seenIt ? 'none' : '';
}
onStateChange(renderHintVisibility);
renderHintVisibility();

// --- Mute toggle ---------------------------------------------------------
// Two buttons — one on the title screen, one in the in-game HUD — both
// reflect the same underlying muted flag in audio.js, so toggling either
// updates both.
const muteBtn = document.getElementById('muteBtn');
const titleMuteBtn = document.getElementById('titleMuteBtn');
function syncMuteButtons() {
  muteBtn.textContent = isMuted() ? '🔇' : '🔊';
  titleMuteBtn.textContent = isMuted() ? '🔇 Sound Off' : '🔊 Sound';
}
function toggleMute() {
  setMuted(!isMuted());
  syncMuteButtons();
}
muteBtn.addEventListener('click', toggleMute);
titleMuteBtn.addEventListener('click', toggleMute);
syncMuteButtons();

// --- Case notebook ---------------------------------------------------------
const notebookModal = document.getElementById('notebookModal');
const notebookEvidenceEl = document.getElementById('notebookEvidence');
const notebookPeopleEl = document.getElementById('notebookPeople');

// Rooms in bar-tour order, for grouping the evidence list the way the
// player actually walked through the bar.
const ROOM_LABEL_ORDER = [
  ...ROOM_ORDER.map((key) => ROOMS[key].label),
  ...Object.keys(ROOMS).filter((key) => !ROOM_ORDER.includes(key)).map((key) => ROOMS[key].label)
];

// A hotspot's note can vary by scenario (see solutions.js's sceneNotes,
// resolved the same way RoomScene does it in-game) — without this, the
// notebook could show generic poison-flavored wording for a game that was
// actually blunt-force, smothering, etc., contradicting what the player
// actually read when they found it.
function resolveNoteForNotebook(entry) {
  return SOLUTION.sceneNotes?.[entry.id] ?? entry.note;
}

function renderNotebook() {
  const found = ALL_EVIDENCE.filter((e) => FOUND_EVIDENCE.has(e.id));
  const byRoom = new Map();
  found.forEach((e) => {
    if (!byRoom.has(e.room)) byRoom.set(e.room, []);
    byRoom.get(e.room).push(e);
  });
  const roomsInOrder = [...byRoom.keys()].sort(
    (a, b) => ROOM_LABEL_ORDER.indexOf(a) - ROOM_LABEL_ORDER.indexOf(b)
  );

  notebookEvidenceEl.innerHTML = found.length
    ? roomsInOrder.map((room) => `
        <div class="notebook-room-group">
          <h4 class="notebook-room-heading">${room}</h4>
          ${byRoom.get(room).map((e) => {
            const implicatesTag = e.implicates
              ? `<span class="implicates-tag">${(Array.isArray(e.implicates) ? e.implicates : [e.implicates]).map((n) => SUSPECT_DISPLAY_NAMES[n] || n).join(', ')}</span>`
              : '';
            return `
              <div class="notebook-entry">
                <div class="notebook-entry-head">
                  <b>${e.name}</b>
                  <span class="notebook-tags">
                    ${e.redHerring ? '<span class="dead-end-tag">Dead End</span>' : ''}
                    ${e.alibiBreak ? '<span class="alibi-break-tag">Alibi Break</span>' : ''}
                    ${e.pickup ? '<span class="item-tag">Item</span>' : ''}
                    ${implicatesTag}
                  </span>
                </div>
                <p>${resolveNoteForNotebook(e)}</p>
              </div>
            `;
          }).join('')}
        </div>
      `).join('')
    : '<p class="notebook-empty">No evidence found yet.</p>';
  const remaining = ALL_EVIDENCE.length - found.length;
  if (remaining > 0) {
    notebookEvidenceEl.innerHTML += `<p class="notebook-empty">${remaining} more clue${remaining === 1 ? '' : 's'} still out there.</p>`;
  }

  const talked = CHARACTERS.filter((c) => TALKED_TO.has(c.name));
  notebookPeopleEl.innerHTML = talked.length
    ? talked.map((c) => {
      const askable = [...BASE_QUESTIONS, ...FOLLOWUPS.filter((f) => f.target === c.name)];
      const asked = askable.filter((q) => ASKED_QUESTIONS.has(`${c.name}|${q.id}`));
      const qAndA = asked.length
        ? asked.map((q) => `<p class="notebook-qa"><em>${q.text}</em><br>${c.answers?.[q.id] || ''}</p>`).join('')
        : '';
      return `
        <div class="notebook-entry">
          <b>${c.displayName || c.name}</b>
          <span>${c.role || ''} · ${asked.length} of ${askable.length} question${askable.length === 1 ? '' : 's'} asked</span>
          <p>"${c.line.replace(/^"|"$/g, '')}"</p>
          ${qAndA}
        </div>
      `;
    }).join('')
    : '<p class="notebook-empty">You haven\'t spoken to anyone yet.</p>';
}

// --- Deduction board -----------------------------------------------------
// Suspects sit in evenly-spaced rows across the top and bottom; found
// evidence that implicates someone gets a card in the middle with a
// string-line drawn to them. Undiscovered evidence simply isn't shown, so
// the board can't spoil what a clue reveals before the player finds it.
//
// Two things used to make this confusing at 10 suspects: the row math only
// ever placed things at "row 0" or "the bottom row," so a 3rd row of
// suspects landed exactly on top of the 1st extra row instead of getting
// its own line; and the suspect/evidence cards were positioned with raw
// pixel offsets sized for a 720x420 canvas while the SVG lines scaled with
// the container via viewBox — the two coordinate systems only agreed when
// the modal happened to render at exactly that width. Both are fixed below:
// positions are computed per-row (any row count, any row size, centered
// independently), and everything — lines and cards alike — is placed with
// percentages of BOARD_W/BOARD_H so they scale together.
const boardWrap = document.getElementById('boardWrap');
const BOARD_W = 900, BOARD_H = 480;
const pctX = (x) => `${(x / BOARD_W) * 100}%`;
const pctY = (y) => `${(y / BOARD_H) * 100}%`;

// Every suspect gets their own color, used for both their portrait ring and
// any line connecting evidence to them — so following "which clues point at
// Sonny" is a matter of looking for his color, not untangling same-colored
// string crossing the whole board.
const SUSPECT_COLORS = {};
// Evidence's `implicates` field (rooms.js) always names the fixed internal
// identifier (matching a hotspot's `requires: { killer/npc: ... }` gates),
// never the display name — this map is how notebook/board text showing an
// `implicates` value gets the player-facing name instead. Every character in
// this cast displays under that same fixed name, but the indirection is kept
// in case a future character ever needs the two to differ.
const SUSPECT_DISPLAY_NAMES = {};
CHARACTERS.forEach((c, i) => {
  SUSPECT_COLORS[c.name] = `hsl(${Math.round((i * 360) / CHARACTERS.length)}, 60%, 68%)`;
  SUSPECT_DISPLAY_NAMES[c.name] = c.displayName || c.name;
});

// Centers `count` items evenly across [margin, total-margin], returning the
// position for `index`. A single item centers on the midpoint instead of
// dividing by zero.
function evenSpread(index, count, total, margin) {
  if (count <= 1) return total / 2;
  return margin + (index / (count - 1)) * (total - 2 * margin);
}

function renderBoard() {
  const cols = Math.min(5, CHARACTERS.length) || 1;
  const rows = Math.ceil(CHARACTERS.length / cols);
  const suspectPos = {};
  for (let row = 0; row < rows; row++) {
    const rowItems = CHARACTERS.slice(row * cols, row * cols + cols);
    const y = evenSpread(row, rows, BOARD_H, 50);
    rowItems.forEach((c, colIdx) => {
      suspectPos[c.name] = { x: evenSpread(colIdx, rowItems.length, BOARD_W, 90), y };
    });
  }

  // Grouping same-suspect clues together (rather than plain discovery order)
  // keeps their lines running roughly parallel instead of crossing the
  // whole board to interleave with someone else's.
  const foundWithLinks = ALL_EVIDENCE
    .filter((e) => FOUND_EVIDENCE.has(e.id) && e.implicates)
    .slice()
    .sort((a, b) => {
      const an = Array.isArray(a.implicates) ? a.implicates[0] : a.implicates;
      const bn = Array.isArray(b.implicates) ? b.implicates[0] : b.implicates;
      return an.localeCompare(bn);
    });

  const evCols = Math.max(1, Math.min(4, foundWithLinks.length));
  const evRows = Math.ceil(foundWithLinks.length / evCols) || 1;
  const evYStart = BOARD_H * 0.28, evYEnd = BOARD_H * 0.72;
  const evPos = [];
  for (let row = 0; row < evRows; row++) {
    const rowItems = foundWithLinks.slice(row * evCols, row * evCols + evCols);
    const y = evenSpread(row, evRows, evYEnd - evYStart, 0) + evYStart;
    rowItems.forEach((entry, colIdx) => {
      evPos.push({ entry, x: evenSpread(colIdx, rowItems.length, BOARD_W, 80), y });
    });
  }

  let svgLines = '';
  evPos.forEach(({ entry, x, y }) => {
    const targets = Array.isArray(entry.implicates) ? entry.implicates : [entry.implicates];
    targets.forEach((name) => {
      const sp = suspectPos[name];
      if (!sp) return;
      const color = entry.redHerring ? '#6a6a5f' : (SUSPECT_COLORS[name] || '#d989bc');
      svgLines += `<line x1="${x}" y1="${y}" x2="${sp.x}" y2="${sp.y}"
        stroke="${color}"
        stroke-width="${entry.redHerring ? 1 : 1.8}"
        stroke-dasharray="${entry.redHerring ? '4,4' : 'none'}"
        opacity="${entry.redHerring ? 0.5 : 0.8}" />`;
    });
  });

  const suspectHtml = CHARACTERS.map((c) => `
    <div class="board-suspect" style="left:${pctX(suspectPos[c.name].x)}; top:${pctY(suspectPos[c.name].y)};">
      <img ${portraitImgAttrs(c)} alt="${c.displayName || c.name}" style="border-color:${SUSPECT_COLORS[c.name]};">
      <span>${c.displayName || c.name}</span>
    </div>
  `).join('');

  const evidenceHtml = evPos.map(({ entry, x, y }) => `
    <div class="board-evidence" style="left:${pctX(x)}; top:${pctY(y)};">${entry.name}</div>
  `).join('');

  boardWrap.innerHTML = `
    <svg viewBox="0 0 ${BOARD_W} ${BOARD_H}" preserveAspectRatio="none">${svgLines}</svg>
    ${suspectHtml}
    ${evidenceHtml}
  `;
  if (!foundWithLinks.length) {
    boardWrap.innerHTML += '<p class="notebook-empty" style="position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);">Find some evidence to start connecting the case.</p>';
  }
}

// --- Timeline -------------------------------------------------------------
// Built from a fixed, killer-invariant script of the night (src/data/timeline.js);
// each entry only renders once its own reveal condition — a specific clue
// found, or a specific question asked of a specific person — is actually
// true, so this never hands the player something they haven't learned yet.
function timelineRevealed(reveal) {
  if (reveal.evidence) return FOUND_EVIDENCE.has(reveal.evidence);
  if (reveal.npc && reveal.questionId) return ASKED_QUESTIONS.has(`${reveal.npc}|${reveal.questionId}`);
  return false;
}

const timelineListEl = document.getElementById('timelineList');
function renderTimeline() {
  const revealed = TIMELINE.filter((t) => timelineRevealed(t.reveal));
  timelineListEl.innerHTML = revealed.length
    ? revealed.map((t) => `
      <div class="timeline-entry">
        <span class="timeline-time">${t.label}</span>
        <span class="timeline-dot"></span>
        <span class="timeline-text">${t.text}</span>
      </div>
    `).join('')
    : '<p class="notebook-empty">Nothing placed on the timeline yet — find clues and ask people about their evenings.</p>';
  renderContradictions();
}

// Two independent sources feed this section: a followup tagged
// `contradiction: true` (see questions.js — always the same lines every
// game, so it's flavor/food-for-thought, never a guilt tell) and a piece of
// physical evidence tagged `alibiBreak: true` (see rooms.js — a clue whose
// own note sets someone's claimed account against a contrary fact). Either
// way, this just collects the "wait, those two accounts don't quite match"
// moments the player already unlocked in one place, instead of relying on
// them to remember a conversation or a clue from several rooms back.
const contradictionsSectionEl = document.getElementById('contradictionsSection');
const contradictionsListEl = document.getElementById('contradictionsList');
function renderContradictions() {
  const noticedFollowups = FOLLOWUPS.filter((f) => f.contradiction && ASKED_QUESTIONS.has(`${f.target}|${f.id}`));
  const noticedEvidence = ALL_EVIDENCE.filter((e) => e.alibiBreak && FOUND_EVIDENCE.has(e.id));
  contradictionsSectionEl.style.display = (noticedFollowups.length || noticedEvidence.length) ? '' : 'none';
  if (!noticedFollowups.length && !noticedEvidence.length) return;
  const followupHtml = noticedFollowups.map((f) => {
    const target = CHARACTERS.find((c) => c.name === f.target);
    const answer = target?.answers?.[f.id] || '';
    return `
      <div class="contradiction-entry">
        <span class="contradiction-icon">⚠</span>
        <span class="contradiction-body"><em>${f.target}</em> — ${answer}</span>
      </div>
    `;
  }).join('');
  const evidenceHtml = noticedEvidence.map((e) => `
    <div class="contradiction-entry">
      <span class="contradiction-icon">⚠</span>
      <span class="contradiction-body"><em>${e.name}</em> — ${resolveNoteForNotebook(e)}</span>
    </div>
  `).join('');
  contradictionsListEl.innerHTML = followupHtml + evidenceHtml;
}

// --- Notebook view switching ------------------------------------------------
const notebookViews = {
  list: { btn: document.getElementById('notebookListBtn'), el: document.getElementById('notebookListView') },
  timeline: { btn: document.getElementById('notebookTimelineBtn'), el: document.getElementById('notebookTimelineView'), onShow: renderTimeline },
  board: { btn: document.getElementById('notebookBoardBtn'), el: document.getElementById('notebookBoardView'), onShow: renderBoard }
};
Object.entries(notebookViews).forEach(([key, view]) => {
  view.btn.addEventListener('click', () => {
    Object.values(notebookViews).forEach((v) => { v.btn.classList.remove('active'); v.el.style.display = 'none'; });
    view.btn.classList.add('active');
    view.el.style.display = '';
    if (view.onShow) view.onShow();
  });
});

// --- Achievements ---------------------------------------------------------
const achievementsRowEl = document.getElementById('achievementsRow');
function renderAchievements() {
  achievementsRowEl.innerHTML = ACHIEVEMENTS.map((a) => {
    const unlocked = UNLOCKED_ACHIEVEMENTS.has(a.id);
    return `
      <div class="achievement-badge ${unlocked ? 'unlocked' : ''}">
        <span class="ach-icon">${unlocked ? '🏆' : '🔒'}</span>
        <span>
          <b>${a.title}</b>
          <span>${a.description}</span>
        </span>
      </div>
    `;
  }).join('');
}

const achievementToast = document.getElementById('achievementToast');
let toastQueue = [];
let toastBusy = false;
function showNextToast() {
  if (toastBusy || !toastQueue.length) return;
  const ach = toastQueue.shift();
  toastBusy = true;
  achievementToast.innerHTML = `<b>🏆 Achievement Unlocked</b><span>${ach.title}</span>`;
  achievementToast.classList.add('show');
  setTimeout(() => {
    achievementToast.classList.remove('show');
    setTimeout(() => { toastBusy = false; showNextToast(); }, 300);
  }, 3000);
}
function handleNewAchievements(ids) {
  if (!ids.length) return;
  ids.forEach((id) => {
    const ach = ACHIEVEMENTS.find((a) => a.id === id);
    if (ach) toastQueue.push(ach);
  });
  showNextToast();
  renderAchievements();
}

// Mirrors RoomScene.js's isFollowupUnlocked — duplicated rather than shared
// since this module has no access to the live scene, but keep them in sync.
function isFollowupUnlockedForAchievement(f) {
  if (f.unlocksAfter.evidence) return FOUND_EVIDENCE.has(f.unlocksAfter.evidence);
  if (f.unlocksAfter.npc && f.unlocksAfter.questionId) {
    return ASKED_QUESTIONS.has(`${f.unlocksAfter.npc}|${f.unlocksAfter.questionId}`);
  }
  return false;
}

// True once every base question, plus every follow-up that's actually
// unlocked so far, has been asked of every single person in the house — a
// stricter superset of "Interrogator" (which only requires talking to them).
function allAvailableQuestionsAsked() {
  if (TALKED_TO.size < CHARACTERS.length) return false;
  return CHARACTERS.every((c) => {
    const askable = [
      ...BASE_QUESTIONS,
      ...FOLLOWUPS.filter((f) => f.target === c.name && isFollowupUnlockedForAchievement(f))
    ];
    return askable.every((q) => ASKED_QUESTIONS.has(`${c.name}|${q.id}`));
  });
}

function achievementTotals(extra) {
  return {
    totalEvidence: ALL_EVIDENCE.length, totalRooms: ROOM_ORDER.length, totalCharacters: CHARACTERS.length,
    allQuestionsAsked: allAvailableQuestionsAsked(),
    ...extra
  };
}

onStateChange(() => handleNewAchievements(checkAchievements(achievementTotals({}))));
renderAchievements();

document.getElementById('notebookBtn').addEventListener('click', () => {
  playClick();
  renderNotebook();
  renderAchievements();
  const activeView = Object.values(notebookViews).find((v) => v.btn.classList.contains('active'));
  if (activeView?.onShow) activeView.onShow();
  notebookModal.classList.add('open');
});

// --- Accusation ---------------------------------------------------------
const accuseModal = document.getElementById('accuseModal');
const accuseGrid = document.getElementById('accuseGrid');
const accuseConfirmBtn = document.getElementById('accuseConfirmBtn');
const accuseWarningEl = document.getElementById('accuseWarning');
const accuseSubEl = document.getElementById('accuseSub');
const accuseBtn = document.getElementById('accuseBtn');
let selectedSuspect = null;
let accusePendingConfirm = false;

// Three tries total, right or wrong — not three WRONG tries. Getting it
// right on try 1 or 2 ends things anyway; this cap only really bites when
// all three come up empty, at which point the case closes for good and the
// HUD button locks out rather than letting the player grind through guesses.
const MAX_ACCUSATIONS = 3;

function renderAccuseAvailability() {
  const remaining = Math.max(0, MAX_ACCUSATIONS - accusationAttempts);
  if (remaining > 0) {
    accuseSubEl.textContent = `Choose carefully — you have ${remaining} accusation${remaining === 1 ? '' : 's'} left.`;
    accuseBtn.disabled = false;
    accuseBtn.title = '';
  } else {
    accuseSubEl.textContent = `You've used all ${MAX_ACCUSATIONS} of your accusations. The case is closed.`;
    accuseBtn.disabled = true;
    accuseBtn.title = 'No accusations left this investigation';
  }
}
renderAccuseAvailability();
onStateChange(renderAccuseAvailability);

// Below this fraction of evidence actually pointing at the accused person,
// confirming asks once more before committing — a nudge against guessing
// blind, not a hard block. Clicking "Confirm Accusation" again (now
// relabeled) goes through.
const LOW_EVIDENCE_THRESHOLD = 1 / 3;

// What actually supports naming a given suspect: clues exclusive to them
// being this game's killer (requires.killer, gated so they can never
// appear for anyone else), plus any clue that names them via `implicates` —
// deliberately excluding redHerring entries, since those resolve as dead
// ends and shouldn't count toward a case against anyone. This is checked
// per accused suspect rather than as a flat "% of all evidence found"
// count, so a player who found exactly the handful of clues that actually
// implicate their pick isn't nagged the same as someone guessing blind —
// and, just as important, someone who found lots of OTHER suspects'
// evidence but nothing on their actual pick still gets asked to reconsider.
function suspectEvidence(suspectName) {
  return ALL_EVIDENCE.filter((e) => {
    if (e.redHerring) return false;
    const namesThisSuspect = e.implicates &&
      (Array.isArray(e.implicates) ? e.implicates.includes(suspectName) : e.implicates === suspectName);
    return namesThisSuspect || e.requires?.killer === suspectName;
  });
}

function resetAccuseConfirmState() {
  accusePendingConfirm = false;
  accuseConfirmBtn.textContent = 'Confirm Accusation';
  accuseWarningEl.style.display = 'none';
}

CHARACTERS.forEach((c) => {
  const cell = document.createElement('div');
  cell.className = 'accuse-suspect';
  cell.innerHTML = `
    <img ${portraitImgAttrs(c)} alt="${c.name}">
    <span>${c.name}</span>
  `;
  cell.addEventListener('click', () => {
    selectedSuspect = c;
    document.querySelectorAll('.accuse-suspect').forEach((el) => el.classList.remove('selected'));
    cell.classList.add('selected');
    accuseConfirmBtn.disabled = false;
    resetAccuseConfirmState(); // switching suspects should re-ask, not carry over a pending confirm
  });
  accuseGrid.appendChild(cell);
});

// Every scenario in this build has a real killer — Nikki's staged-accident
// scenario is still a murder, just one made to look like a fall — so there's
// no "It Was an Accident" tile here.

accuseBtn.addEventListener('click', () => {
  if (accusationAttempts >= MAX_ACCUSATIONS) return; // button is disabled too; this is just a backstop
  playClick();
  resetAccuseConfirmState();
  accuseModal.classList.add('open');
});

const endModal = document.getElementById('endModal');
const endCard = document.getElementById('endCard');
const endTitle = document.getElementById('endTitle');
const endSub = document.getElementById('endSub');
const endExplanation = document.getElementById('endExplanation');
const endKeepBtn = document.getElementById('endKeepBtn');

// Frames how thorough the investigation actually was, rather than treating
// every correct (or wrong) guess the same regardless of how much evidence
// backed it up.
function describeCaseStrength(count, total, correct) {
  const fraction = total > 0 ? count / total : 0;
  if (correct) {
    if (fraction >= 0.75) return `an airtight case — ${count} of ${total} clues, all pointing the same way`;
    if (fraction >= 0.4) return `a solid case, built on ${count} of ${total} clues`;
    return `honestly, more of a lucky guess than a case — only ${count} of ${total} clues found`;
  }
  if (fraction >= 0.75) return `a thorough investigation that still landed on the wrong name`;
  if (fraction >= 0.4) return `a reasonable case, built on ${count} of ${total} clues — just aimed at the wrong person`;
  return `not much to go on — only ${count} of ${total} clues found before naming a name`;
}

// A short framing line ahead of the full explanation, so a thin-evidence
// guess doesn't read identically to one backed by nearly everything in the
// notebook — describeCaseStrength's note (the numeric tally) still runs
// after the explanation; this is tone, not a repeat of that count.
function epilogueIntro(count, total, correct) {
  const fraction = total > 0 ? count / total : 0;
  if (correct) {
    if (fraction >= 0.75) return "You laid it all out, piece by piece. Here's how it adds up.";
    if (fraction >= 0.4) return "You had enough to be sure. Here's the rest of it.";
    return "You called it right, more on instinct than proof. Here's everything you didn't stay to find.";
  }
  if (fraction >= 0.75) return 'You did the work and still named the wrong person. Here\'s what actually happened.';
  if (fraction >= 0.4) return "You had a real case — just not against the right person. Here's the truth of it.";
  return "You barely scratched the surface before naming a name. Here's what you missed.";
}

accuseConfirmBtn.addEventListener('click', () => {
  if (!selectedSuspect) return;

  const relevant = suspectEvidence(selectedSuspect.name);
  const relevantFound = relevant.filter((e) => FOUND_EVIDENCE.has(e.id)).length;
  const fraction = relevant.length > 0 ? relevantFound / relevant.length : 0;
  if (fraction < LOW_EVIDENCE_THRESHOLD && !accusePendingConfirm) {
    playClick();
    accusePendingConfirm = true;
    accuseWarningEl.textContent = relevant.length > 0
      ? `You've only found ${relevantFound} of ${relevant.length} clues actually pointing to ${selectedSuspect.name}. Accuse anyway?`
      : `Nothing you've found so far points to ${selectedSuspect.name}. Accuse anyway?`;
    accuseWarningEl.style.display = 'block';
    accuseConfirmBtn.textContent = 'Yes, Accuse Anyway';
    return;
  }

  playClick();
  accuseModal.classList.remove('open');

  recordAccusationAttempt();
  const correct = selectedSuspect.name === SOLUTION.killer;
  const exhausted = !correct && accusationAttempts >= MAX_ACCUSATIONS;
  handleNewAchievements(checkAchievements(achievementTotals({ lastAccusationCorrect: correct })));
  correct ? playWinSting() : playLoseSting();
  endCard.className = 'end-card ' + (correct ? 'win' : 'lose');
  endTitle.textContent = correct ? 'Case Closed' : (exhausted ? 'The Case Goes Cold' : 'The Wrong Verdict');
  endSub.textContent = correct
    ? `You named ${selectedSuspect.name} — and you were right.`
    : `You named ${selectedSuspect.name}. It wasn't them.`;
  const explanationParas = SOLUTION.explanation;
  const strengthNote = describeCaseStrength(FOUND_EVIDENCE.size, ALL_EVIDENCE.length, correct);
  const introNote = epilogueIntro(FOUND_EVIDENCE.size, ALL_EVIDENCE.length, correct);
  const exhaustedNote = exhausted
    ? `<p class="end-strength-note"><em>Three accusations, three wrong names. Big D's Bar keeps its secrets now.</em></p>`
    : '';
  endExplanation.innerHTML = `<p class="end-epilogue-intro"><em>${introNote}</em></p>`
    + explanationParas.map((p) => `<p>${p}</p>`).join('')
    + `<p class="end-strength-note"><em>${strengthNote.charAt(0).toUpperCase() + strengthNote.slice(1)}.</em></p>`
    + exhaustedNote;
  // Once the third wrong guess is spent, there's nothing left to "keep
  // investigating" toward — only starting a fresh case makes sense.
  endKeepBtn.style.display = exhausted ? 'none' : '';
  endModal.classList.add('open');
});

document.getElementById('endKeepBtn').addEventListener('click', () => {
  endModal.classList.remove('open');
});
document.getElementById('endNewBtn').addEventListener('click', () => {
  // Not resetProgress() — the case you just closed is a finished save worth
  // keeping. startRandomStory() only reuses a slot in place if it was never
  // actually played; a completed investigation always gets a fresh one.
  startRandomStory();
  location.reload();
});
