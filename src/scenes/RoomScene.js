import Phaser from 'phaser';
import { ROOMS } from '../data/rooms.js';
import { CHARACTERS } from '../data/characters.js';
import { BASE_QUESTIONS, FOLLOWUPS } from '../data/questions.js';
import { SOLUTIONS } from '../data/solutions.js';
import {
  FOUND_EVIDENCE, TALKED_TO, markEvidenceFound, markTalkedTo, setCurrentRoom, markRoomVisited,
  killerIndex, markQuestionAsked, ASKED_QUESTIONS, bodyDiscovered, markBodyDiscovered,
  isOptionalClueActive, pickDialogueVariant
} from '../state.js';
import { playClick, playTypeTick } from '../audio.js';

const CURRENT_KILLER = SOLUTIONS[killerIndex].killer;
const CURRENT_METHOD = SOLUTIONS[killerIndex].method;
const CURRENT_SCENE_NOTES = SOLUTIONS[killerIndex].sceneNotes || {};
// Nikki's staged-accident scenario (see solutions.js's discoveryDelayed) has
// a death that looks like a drunk stumble at a glance — for that one, the
// office opens without a visible body until the player takes a closer look.
// Every other scenario ignores this entirely and shows the body from the
// first visit, as before.
const CURRENT_DISCOVERY_DELAYED = !!SOLUTIONS[killerIndex].discoveryDelayed;
const CURRENT_FIRST_GLANCE_NOTE = SOLUTIONS[killerIndex].firstGlanceNote;
// The room the body actually lives in — used both to gate preDiscovery below
// and to place the first-glance marker at the same spot O-01 sits once the
// room renders normally.
const BODY_ROOM_KEY = 'office';
const BODY_HOTSPOT_FX = 0.5;
const BODY_HOTSPOT_FY = 0.55;

// Hotspot markers are drawn from a 32px texture inside Phaser's fixed
// 960x640 canvas, which then gets CSS-scaled to fit the device — on a phone
// in landscape that canvas can render at well under half size, so the old
// 0.6 scale worked out to roughly 9px on screen. Bumped up across the board,
// with an extra boost on coarse-pointer (touch) devices, where there's no
// mouse-hover affordance to help find a hotspot before committing to a tap.
const IS_TOUCH_DEVICE = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
const MARKER_SCALE = IS_TOUCH_DEVICE ? 1.1 : 0.85;
const MARKER_SCALE_PEAK = IS_TOUCH_DEVICE ? 1.4 : 1.1;
const MARKER_HIT_RADIUS = IS_TOUCH_DEVICE ? 46 : 34;

// A static painted background with clickable hotspots and NPCs — pure
// point-and-click, no player avatar to walk around. Clicking an object or
// person interacts with it immediately. See src/data/rooms.js for the room
// roster and src/scenes/BootScene.js for the asset list.
export default class RoomScene extends Phaser.Scene {
  constructor() { super('Room'); }

  init(data) {
    this.roomKey = data.room;
    this.roomConfig = ROOMS[data.room];
    this.failedKeys = data.failedKeys || new Set();
  }

  create() {
    const cfg = this.roomConfig;
    const cam = this.cameras.main;

    setCurrentRoom(this.roomKey);
    markRoomVisited(this.roomKey);

    // scene.restart() on every room change destroys the previous scene's
    // game objects, but this class instance (and its properties) survives —
    // without this reset, enterInterview would find a truthy but destroyed
    // interviewBackdrop reference on the very next room and blow up trying
    // to call setTexture() on it.
    this.interviewBackdrop = null;
    this.interviewShade = null;
    this.spotlightOverlay = null;
    this._interviewReturnFx = null;
    this._interviewReturnFy = null;
    this._walking = false;

    // For Nikki's scenario, where the death looks like an accident at a
    // glance, the office opens with only a single "first glance" hotspot
    // instead of the full clue set — clicking it is what actually reveals
    // the room's real clues, via discoverBody() below. Derek's slumped pose
    // in the regular office art already reads as "could be a drunk stumble,
    // could be worse" on its own, so this reuses that same background
    // rather than swapping to a separate "before" image.
    this.preDiscovery = this.roomKey === BODY_ROOM_KEY && CURRENT_DISCOVERY_DELAYED && !bodyDiscovered;

    // background — use the real AI-generated art if it loaded, else a labeled placeholder
    const bgKey = this.hasRealAsset(cfg.bgKey) ? cfg.bgKey : this.ensurePlaceholder(cfg.bgKey, cfg.label);
    this.bg = this.add.image(this.scale.width / 2, this.scale.height / 2, bgKey).setOrigin(0.5);
    this.fitBackgroundToScene();

    this.npcs = [];
    (cfg.npcs || []).forEach(n => this.addNPC(n));

    this.setupDirNav();

    this.evidenceMarkers = [];
    if (this.preDiscovery) {
      this.renderFirstGlanceHotspot();
    } else {
      this.renderUnlockedHotspots();
    }

    // preventDefault stops the browser's native "activate the focused
    // button" behavior — without it, if a room-nav or question button still
    // has DOM focus from a prior click, this same Space press both closes
    // the dialog AND re-fires that button (e.g. navigating to a new room).
    // Gating on dialogEl's visibility keeps Space a no-op when no dialog is
    // open, instead of it doing nothing useful but still eating the keypress.
    this.input.keyboard.on('keydown-SPACE', (event) => {
      if (event) event.preventDefault();
      if (this.dialogEl && this.dialogEl.style.display === 'flex') {
        this.advanceDialog();
      }
    });

    this.promptEl = document.getElementById('prompt');
    this.dialogEl = document.getElementById('dialog');
    this.dialogTitleEl = document.getElementById('dialog-title');
    this.dialogBodyEl = document.getElementById('dialog-body');
    this.dialogPortraitEl = document.getElementById('dialog-portrait');
    this.dialogQuestionsEl = document.getElementById('dialog-questions');
    this.dialogScrollareaEl = document.getElementById('dialog-scrollarea');
    // Question buttons already stopPropagation() on their own click handler
    // (see buildQuestionButtons' rendering below), which should be enough
    // on its own — this target check is a second, independent guard against
    // the same failure mode some touch browsers are prone to: a tap's
    // synthetic 'click' firing on both the button AND its ancestor even
    // when stopPropagation was called on the button's handler, if that
    // handler resolved after the browser had already begun dispatching the
    // bubble phase for this element. Without it, a tapped question could
    // read as "tap anywhere in the dialog" and close/advance instead of
    // asking it.
    this.dialogEl.onclick = (e) => {
      if (e.target.closest('.dialog-question-btn, #dialogCloseBtn')) return;
      this.advanceDialog();
    };
    const dialogCloseBtn = document.getElementById('dialogCloseBtn');
    if (dialogCloseBtn) dialogCloseBtn.onclick = (e) => { e.stopPropagation(); this.closeDialog(); };

    this.puzzleModalEl = document.getElementById('puzzleModal');
    this.puzzleHintEl = document.getElementById('puzzleHint');
    this.puzzleInputEl = document.getElementById('puzzleInput');
    this.puzzleFeedbackEl = document.getElementById('puzzleFeedback');
    document.getElementById('puzzleSubmitBtn').onclick = () => this.submitPuzzle();
    document.getElementById('puzzleCancelBtn').onclick = () => this.closePuzzle();
    this.puzzleInputEl.onkeydown = (e) => { if (e.key === 'Enter') this.submitPuzzle(); };

    this.setupRoomNav(cfg);
    this.renderTalkedToPanel();

    // Lets players zoom in on a clue instead of squinting at a small marker —
    // bounds keep panning from scrolling past the edge of the background.
    cam.setBounds(0, 0, this.scale.width, this.scale.height);
    this.setupZoomControls();
    this.setupPanControls();

    cam.fadeIn(400, 5, 5, 8);

    this.scale.on('resize', () => this.fitBackgroundToScene());
  }

  // A hotspot with no `requires` is always shown. One with `requires` stays
  // completely hidden — not just unclickable — until its condition is met, so
  // clues can surface progressively (e.g. after talking to the right person)
  // instead of teasing something the player can't yet act on. Called again
  // after every interaction so a newly-met requirement reveals its clue
  // immediately, without needing to leave and re-enter the room.
  isUnlocked(hotspot) {
    if (FOUND_EVIDENCE.has(hotspot.id)) return true;
    if (!hotspot.requires) return true;
    const req = hotspot.requires;
    if (req.npc && !TALKED_TO.has(req.npc)) return false;
    if (req.evidence && !FOUND_EVIDENCE.has(req.evidence)) return false;
    if (req.killer && req.killer !== CURRENT_KILLER) return false;
    if (req.killerMethod && req.killerMethod !== CURRENT_METHOD) return false;
    if (req.optional && !isOptionalClueActive(hotspot.id)) return false;
    return true;
  }

  // A hotspot's note can be overridden for this scenario (see solutions.js's
  // sceneNotes) so the same room/hotspot layout can describe a completely
  // different manner of death without needing separate art per method.
  resolveNote(hotspot) {
    return CURRENT_SCENE_NOTES[hotspot.id] ?? hotspot.note;
  }

  renderUnlockedHotspots() {
    const glowKey = this.ensureGlowDot();
    const foundKey = this.ensureFoundBadge();
    (this.roomConfig.hotspots || []).forEach(h => {
      if (this.evidenceMarkers.some(e => e.data.id === h.id)) return;
      if (!this.isUnlocked(h)) return;

      const p = this.pointToScene(h.fx, h.fy);
      const found = FOUND_EVIDENCE.has(h.id);
      // Found and unfound markers differ in shape (plain glow vs. a checkmark
      // badge), not just tint color — so the distinction still reads for
      // colorblind players, not just by hue.
      const marker = this.add.image(p.x, p.y, found ? foundKey : glowKey);
      if (!found) marker.setTint(0xe8b84b);
      marker.setScale(MARKER_SCALE);
      marker.setDepth(9999);
      if (!found) {
        this.tweens.add({ targets: marker, scale: { from: MARKER_SCALE, to: MARKER_SCALE_PEAK }, alpha: { from: 0.95, to: 0.55 }, duration: 900, yoyo: true, repeat: -1 });
      } else {
        marker.setAlpha(0.5);
      }
      const entry = { data: h, marker, x: p.x, y: p.y };

      marker.setInteractive({
        hitArea: new Phaser.Geom.Circle(16, 16, MARKER_HIT_RADIUS),
        hitAreaCallback: Phaser.Geom.Circle.Contains,
        useHandCursor: true
      });
      marker.on('pointerover', () => { if (!FOUND_EVIDENCE.has(h.id)) this.setPrompt('Examine: ' + h.name); });
      marker.on('pointerout', () => this.setPrompt(null));
      marker.on('pointerdown', () => {
        // The marker sits directly on top of whatever it represents (see the
        // screenshot that prompted this: the glow dot was right over Derek
        // while his "look closer" dialog was already open), so a player
        // re-clicking the same spot to "make it go away" was re-triggering
        // the SAME interaction from scratch instead of closing the dialog —
        // it looked like clicking did nothing at all. Any click while a
        // dialog's already up now just advances/closes it, same as clicking
        // the dialog box itself would.
        if (this.isDialogOpen()) { this.advanceDialog(); return; }
        this.approachPoint(h.fx, h.fy);
        if (h.puzzle && !FOUND_EVIDENCE.has(h.id)) {
          this.openPuzzle(entry);
        } else {
          this.examineHotspot(entry);
        }
      });
      this.evidenceMarkers.push(entry);
    });
  }

  // The one hotspot shown in the office before the body's been discovered
  // (see the preDiscovery branch in create()) — reuses O-01's usual desk
  // position. Clicking it is the "look closer" moment, not an examine.
  renderFirstGlanceHotspot() {
    const glowKey = this.ensureGlowDot();
    const p = this.pointToScene(BODY_HOTSPOT_FX, BODY_HOTSPOT_FY);
    const marker = this.add.image(p.x, p.y, glowKey);
    this.firstGlanceMarker = marker;
    marker.setTint(0xe8b84b);
    marker.setScale(MARKER_SCALE);
    marker.setDepth(9999);
    this.tweens.add({ targets: marker, scale: { from: MARKER_SCALE, to: MARKER_SCALE_PEAK }, alpha: { from: 0.95, to: 0.55 }, duration: 900, yoyo: true, repeat: -1 });
    marker.setInteractive({
      hitArea: new Phaser.Geom.Circle(16, 16, MARKER_HIT_RADIUS),
      hitAreaCallback: Phaser.Geom.Circle.Contains,
      useHandCursor: true
    });
    marker.on('pointerover', () => this.setPrompt('Look closer'));
    marker.on('pointerout', () => this.setPrompt(null));
    marker.on('pointerdown', () => {
      if (this.isDialogOpen()) { this.advanceDialog(); return; }
      this.discoverBody();
    });
  }

  // The first-glance note has no title-card treatment of its own — it reads
  // like a beat of narration, not an examined object — so it's shown without
  // a name heading and then, once dismissed, permanently reveals the body.
  discoverBody() {
    playClick();
    this.showDialog('', CURRENT_FIRST_GLANCE_NOTE, null);
    this._afterDialogClose = () => {
      markBodyDiscovered();
      this.scene.restart({ room: this.roomKey, failedKeys: this.failedKeys });
    };
  }

  setPrompt(text) {
    if (!this.promptEl) return;
    if (text) { this.promptEl.textContent = text; this.promptEl.style.display = 'block'; }
    else { this.promptEl.style.display = 'none'; }
  }

  examineHotspot(entry) {
    playClick();
    markEvidenceFound(entry.data.id);
    this.showDialog(entry.data.name, this.resolveNote(entry.data), null);
    entry.marker.setTexture(this.ensureFoundBadge());
    entry.marker.clearTint();
    entry.marker.setAlpha(0.5);
    this.tweens.killTweensOf(entry.marker);
    this.punchZoom();
    this.renderUnlockedHotspots();
  }

  talkToNPC(npc) {
    playClick();
    this.hideSpotlight();
    this.enterInterview(npc);
    markTalkedTo(npc.npcName);
    this.showDialog(npc.npcDisplayName || npc.npcName, npc.npcLine, this.resolvePortrait(npc), this.buildQuestionButtons(npc));
    this.renderUnlockedHotspots();
    this.renderTalkedToPanel();
  }

  // The right-side "quick retalk" strip: a small portrait button per person
  // already in TALKED_TO, so a follow-up that unlocks for someone in another
  // room doesn't force a walk back through the whole house to ask it. Anyone
  // physically standing in the current room is left out — they're already
  // one click away on the background itself. Rebuilt on room load and again
  // after every conversation, since TALKED_TO only grows.
  renderTalkedToPanel() {
    const panelEl = document.getElementById('talkedToPanel');
    if (!panelEl) return;
    const inRoom = new Set((this.roomConfig.npcs || []).map(n => n.name));
    const list = CHARACTERS.filter(c => TALKED_TO.has(c.name) && !inRoom.has(c.name));

    panelEl.innerHTML = '';
    list.forEach(c => {
      const shownName = c.displayName || c.name;
      const btn = document.createElement('button');
      btn.className = 'retalk-btn';
      btn.title = 'Talk to ' + shownName;
      const portraitUrl = (c.portraitKey && !this.failedKeys.has(c.portraitKey))
        ? this.getRealPortraitDataURL(c.portraitKey)
        : null;
      if (portraitUrl) {
        const img = document.createElement('img');
        img.src = portraitUrl;
        img.alt = shownName;
        btn.appendChild(img);
      } else {
        const span = document.createElement('span');
        span.className = 'retalk-initial';
        span.textContent = shownName.charAt(0);
        btn.appendChild(span);
      }
      btn.onclick = () => this.talkToNPC({ npcName: c.name, npcDisplayName: shownName, npcLine: c.line, npcPortraitKey: c.portraitKey, answers: c.answers });
      panelEl.appendChild(btn);
    });
    panelEl.style.display = (list.length && this.dialogEl.style.display !== 'flex') ? 'flex' : 'none';
  }

  // Every NPC with authored answers (src/data/characters.js) gets the 3 base
  // questions (src/data/questions.js) plus any FOLLOWUPS that target them and
  // whose unlock condition — having asked a specific question of a specific
  // OTHER person — is already satisfied. That's the "learn something from one
  // person, go ask another" mechanic: new questions surface here as soon as
  // their prerequisite is in ASKED_QUESTIONS, no extra wiring needed per room.
  buildQuestionButtons(npc) {
    if (!npc.answers) return null;
    const base = BASE_QUESTIONS.map(q => ({
      text: q.text,
      asked: ASKED_QUESTIONS.has(`${npc.npcName}|${q.id}`),
      onClick: () => this.askQuestion(npc, q)
    }));
    const unlocked = FOLLOWUPS
      .filter(f => f.target === npc.npcName && this.isFollowupUnlocked(f))
      .map(f => ({
        text: f.text,
        asked: ASKED_QUESTIONS.has(`${npc.npcName}|${f.id}`),
        onClick: () => this.askQuestion(npc, f)
      }));
    // Follow-ups first: a newly-unlocked question is the reason a player
    // came back to re-talk to someone, and in the compact side-by-side
    // mobile layout (see index.html's max-height:480px rule) a long list
    // scrolls — burying the new one below the 3 always-present base
    // questions would mean scrolling past everything just to find it.
    return [...unlocked, ...base];
  }

  // A followup unlocks either after asking a specific question of a specific
  // other person, or after finding a specific piece of evidence — whichever
  // its own unlocksAfter field names.
  isFollowupUnlocked(f) {
    if (f.unlocksAfter.evidence) return FOUND_EVIDENCE.has(f.unlocksAfter.evidence);
    if (f.unlocksAfter.npc && f.unlocksAfter.questionId) {
      return ASKED_QUESTIONS.has(`${f.unlocksAfter.npc}|${f.unlocksAfter.questionId}`);
    }
    return false;
  }

  // Every base question has a second possible phrasing for every suspect
  // (characters.js's `${id}Alt` fields — suspicionAlt, alibiAlt,
  // relationshipAlt) — which one plays is chosen per story slot, at random,
  // via state.js's pickDialogueVariant, and has nothing to do with who the
  // killer actually is this game. That's deliberate: tying the choice to
  // guilt would make it a memorizable tell the moment a repeat player saw it
  // happen once. This just keeps replays from sounding identical. The Alt
  // text always restates the same underlying facts as the original (same
  // alibi location, same claimed timing, etc.) so cross-referencing followups
  // stay valid no matter which phrasing came up.
  askQuestion(npc, q) {
    playClick();
    markQuestionAsked(npc.npcName, q.id);
    let answer = npc.answers[q.id];
    const altKey = `${q.id}Alt`;
    if (npc.answers[altKey]) {
      const variant = pickDialogueVariant(`${q.id}:${npc.npcName}`, 2);
      if (variant === 1) answer = npc.answers[altKey];
    }
    this.showDialog(npc.npcDisplayName || npc.npcName, answer, this.resolvePortrait(npc), this.buildQuestionButtons(npc));
  }

  openPuzzle(entry) {
    playClick();
    this.pendingPuzzleEntry = entry;
    this.puzzleHintEl.textContent = entry.data.name + ' — enter the four-digit combination.';
    this.puzzleInputEl.value = '';
    this.puzzleFeedbackEl.textContent = '';
    this.puzzleModalEl.style.display = 'flex';
    this.puzzleInputEl.focus();
  }

  submitPuzzle() {
    const entry = this.pendingPuzzleEntry;
    if (!entry) return;
    if (this.puzzleInputEl.value.trim() === entry.data.puzzleCode) {
      playClick();
      this.closePuzzle();
      this.examineHotspot(entry);
    } else {
      playClick();
      this.puzzleFeedbackEl.textContent = "The lock doesn't budge.";
      this.puzzleInputEl.value = '';
      this.puzzleInputEl.focus();
    }
  }

  closePuzzle() {
    this.puzzleModalEl.style.display = 'none';
    this.pendingPuzzleEntry = null;
  }

  setupRoomNav(cfg) {
    const nameEl = document.getElementById('room-name');
    const prevBtn = document.getElementById('room-prev');
    const nextBtn = document.getElementById('room-next');
    if (nameEl) nameEl.textContent = cfg.label;
    if (prevBtn) {
      prevBtn.textContent = '← ' + (ROOMS[cfg.prevRoom]?.label ?? '');
      prevBtn.onclick = () => this.goToRoom(cfg.prevRoom);
    }
    if (nextBtn) {
      nextBtn.textContent = (ROOMS[cfg.nextRoom]?.label ?? '') + ' →';
      nextBtn.onclick = () => this.goToRoom(cfg.nextRoom);
    }
  }

  goToRoom(key) {
    if (!key || !ROOMS[key]) return;
    playClick();
    this.closeDialog();
    this.cameras.main.fadeOut(250, 5, 5, 8);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.restart({ room: key, failedKeys: this.failedKeys });
    });
  }

  // Whether `key`'s real art actually made it into the texture manager. Not
  // just `!failedKeys.has(key)` — some dev servers (this one included) answer
  // a request for a genuinely missing file with a 200 of unrelated HTML
  // instead of a 404, so the loader's own 'loaderror' event never fires and
  // failedKeys never gets that entry. Checking the texture manager directly
  // catches that case too: a key that never actually decoded into a usable
  // image has no business being treated as "loaded".
  hasRealAsset(key) {
    return this.textures.exists(key) && !this.failedKeys.has(key);
  }

  // A labeled stand-in background, generated on demand for any room whose real
  // art hasn't loaded (missing file, or still mid-generation). Caches by key so
  // repeated visits to the same room don't regenerate it.
  ensurePlaceholder(key, label) {
    const placeholderKey = key + '-placeholder';
    if (this.textures.exists(placeholderKey)) return placeholderKey;

    const w = 960, h = 640;
    const canvasTex = this.textures.createCanvas(placeholderKey, w, h);
    const ctx = canvasTex.getContext();

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2a2420');
    grad.addColorStop(0.55, '#1c1815');
    grad.addColorStop(1, '#141110');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(217,137,188,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, w - 40, h - 40);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#e9e6da';
    ctx.font = 'bold 42px Georgia, serif';
    ctx.fillText(label.toUpperCase(), w / 2, h * 0.46);
    ctx.fillStyle = '#b8b3a4';
    ctx.font = '18px Georgia, serif';
    ctx.fillText('(placeholder — awaiting AI-generated art)', w / 2, h * 0.46 + 34);

    canvasTex.refresh();
    return placeholderKey;
  }

  // A distinct badge for found evidence — a soft green glow with a checkmark
  // drawn on top, so "found" reads as a different shape, not just a different
  // color, for players who can't distinguish gold from green by hue alone.
  ensureFoundBadge() {
    if (!this.textures.exists('foundBadge')) {
      const size = 32;
      const c = this.textures.createCanvas('foundBadge', size, size);
      const ctx = c.getContext();
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(143,180,154,1)');
      grad.addColorStop(0.6, 'rgba(143,180,154,0.55)');
      grad.addColorStop(1, 'rgba(143,180,154,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      ctx.strokeStyle = '#141310';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(size * 0.28, size * 0.52);
      ctx.lineTo(size * 0.44, size * 0.68);
      ctx.lineTo(size * 0.74, size * 0.32);
      ctx.stroke();
      c.refresh();
    }
    return 'foundBadge';
  }

  ensureGlowDot() {
    if (!this.textures.exists('glowDot')) {
      const size = 32;
      const c = this.textures.createCanvas('glowDot', size, size);
      const ctx = c.getContext();
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      c.refresh();
    }
    return 'glowDot';
  }

  // Dims the whole room except a soft circle around (cx, cy) — used to draw
  // the eye to a baked-into-scene NPC on hover, standing in for a per-person
  // silhouette outline that would need its own cutout art. Caches one canvas
  // texture per rounded position so repeat hovers over the same person reuse
  // it instead of redrawing the full-canvas gradient every time.
  ensureSpotlightMask(cx, cy) {
    const key = 'spotlight-' + Math.round(cx) + '-' + Math.round(cy);
    if (this.textures.exists(key)) return key;

    const w = this.scale.width, h = this.scale.height;
    const tex = this.textures.createCanvas(key, w, h);
    const ctx = tex.getContext();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-out';
    const radius = 160;
    const grad = ctx.createRadialGradient(cx, cy, radius * 0.25, cx, cy, radius);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    tex.refresh();
    return key;
  }

  showSpotlight(x, y) {
    const key = this.ensureSpotlightMask(x, y);
    if (!this.spotlightOverlay) {
      this.spotlightOverlay = this.add.image(this.scale.width / 2, this.scale.height / 2, key);
      this.spotlightOverlay.setDepth(500);
      this.spotlightOverlay.setAlpha(0);
    } else {
      this.spotlightOverlay.setTexture(key);
    }
    this.tweens.killTweensOf(this.spotlightOverlay);
    this.tweens.add({ targets: this.spotlightOverlay, alpha: 1, duration: 150 });
  }

  hideSpotlight() {
    if (!this.spotlightOverlay) return;
    this.tweens.killTweensOf(this.spotlightOverlay);
    this.tweens.add({ targets: this.spotlightOverlay, alpha: 0, duration: 150 });
  }

  fitBackgroundToScene() {
    const w = this.scale.width, h = this.scale.height;
    this.bg.setPosition(w / 2, h / 2);
    this.bg.setDisplaySize(w, h);
  }

  // Swaps in that NPC's own portrait as a full-bleed backdrop for the
  // conversation — a stand-in for "step away to a private location to talk"
  // that doesn't need a dedicated interview background per suspect: everyone
  // else in the room (their markers, the shared scene) fades out, leaving
  // just this person's own photo behind the dialog, like they've pulled the
  // player aside. exitInterview (called from closeDialog) undoes all of it.
  enterInterview(npc) {
    const key = npc.npcPortraitKey;
    if (!key || !this.hasRealAsset(key)) return;

    const w = this.scale.width, h = this.scale.height;
    const cam = this.cameras.main;
    // talkToNPC fires right after approachPoint kicks off its zoom tween —
    // that tween hasn't applied anything yet (Phaser tweens start on the
    // next update, not the frame they're created), but it's still running
    // and would spend the next 450ms fighting the direct zoom assignment
    // below, slowly dragging the portrait's zoom back toward 1.9 mid-
    // conversation. Killing it first makes the reset land immediately and
    // stay put.
    this.tweens.killTweensOf(cam);
    // Remembered so exitInterview can zoom back in on this same person in
    // the room (not their portrait) once the dialog closes, rather than
    // resetting all the way out to the wide shot — closing a conversation
    // should leave the player still "standing there", free to pan straight
    // to whoever's next instead of re-approaching from scratch every time.
    this._interviewReturnFx = npc.cfgFx;
    this._interviewReturnFy = npc.approachFy;
    cam.zoom = 1;
    cam.centerOn(w / 2, h / 2);

    if (!this.interviewBackdrop) {
      // Origin biased toward the top: these portraits are bust shots with
      // the face in the upper third, and cover-fitting a taller-than-canvas
      // photo would otherwise crop evenly top/bottom — centering the crop
      // on the chest instead of the face.
      this.interviewBackdrop = this.add.image(w / 2, h / 2, key).setOrigin(0.5, 0.22);
      this.interviewBackdrop.setDepth(400);
      this.interviewBackdrop.setAlpha(0);
      this.interviewShade = this.add.rectangle(w / 2, h / 2, w, h, 0x0a0806, 0.45);
      this.interviewShade.setDepth(401);
      this.interviewShade.setAlpha(0);
    } else {
      this.interviewBackdrop.setTexture(key);
    }
    // Cover-fit: portraits are taller than the 3:2 canvas, so match on
    // whichever axis would otherwise letterbox and let the other overflow —
    // crops the sides rather than showing bars around a floating photo.
    const img = this.textures.get(key).getSourceImage();
    const scale = Math.max(w / img.width, h / img.height);
    this.interviewBackdrop.setDisplaySize(img.width * scale, img.height * scale);
    this.interviewBackdrop.setPosition(w / 2, h * 0.22);

    this.hideSpotlight();
    this.npcs.forEach(n => n.setVisible(false));
    this.evidenceMarkers.forEach(e => e.marker.setVisible(false));
    if (this.firstGlanceMarker) this.firstGlanceMarker.setVisible(false);

    this.tweens.add({ targets: [this.interviewBackdrop, this.interviewShade], alpha: { from: 0, to: 1 }, duration: 250 });
  }

  exitInterview() {
    if (!this.interviewBackdrop) return;
    // Only set while a conversation (not a hotspot examine) is the reason
    // this backdrop exists — closing a hotspot's dialog re-runs this same
    // cleanup (interviewBackdrop persists, hidden, from an earlier chat)
    // but shouldn't touch the camera, since that hotspot's own approachPoint
    // already left it exactly where it should be.
    if (this._interviewReturnFx != null) {
      // Only re-approach in rooms that use approachPoint/pan chevrons in
      // the first place (the crowded main room) — elsewhere, zooming back
      // in after a chat nobody asked to zoom into would just be a jarring
      // camera move with no chevrons to make use of it. Those rooms' camera
      // is already correctly at zoom 1 from enterInterview's reset.
      if (this.roomConfig.approachOnClick) this.panToPoint(this._interviewReturnFx, this._interviewReturnFy);
      this._interviewReturnFx = null;
      this._interviewReturnFy = null;
    }
    this.tweens.add({
      targets: [this.interviewBackdrop, this.interviewShade],
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.npcs.forEach(n => n.setVisible(true));
        this.evidenceMarkers.forEach(e => e.marker.setVisible(true));
        if (this.firstGlanceMarker) this.firstGlanceMarker.setVisible(true);
      }
    });
  }

  // A dedicated in-game zoom, rather than relying on the browser's own
  // pinch-zoom: that's technically available but easy to miss entirely in
  // something that reads as a game rather than a web page, and zooming the
  // whole page (HUD included) means panning around afterward to see
  // anything not already centered. Three ways in: the on-screen +/- buttons
  // (always visible, impossible to miss), two-finger pinch on touch, and the
  // scroll wheel on desktop. While zoomed, the camera also just follows
  // wherever the pointer is — held-and-moved on touch, hovered on desktop —
  // so looking around a zoomed-in clue doesn't need separate pan controls.
  setupZoomControls() {
    const cam = this.cameras.main;
    const ZOOM_MIN = 1, ZOOM_MAX = 2.5, ZOOM_STEP = 0.4;

    const setZoom = (z) => {
      cam.zoom = Phaser.Math.Clamp(z, ZOOM_MIN, ZOOM_MAX);
      if (cam.zoom <= ZOOM_MIN + 0.001) cam.centerOn(this.scale.width / 2, this.scale.height / 2);
      this.updateZoomButtonState();
      this.updatePanControlsVisibility();
    };

    // .onclick (not addEventListener) deliberately — these DOM buttons
    // persist across scene.restart() on every room change, so accumulating
    // listeners here would make zoom fire progressively more times per click
    // the longer a session runs. Assignment always replaces the last one.
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    if (zoomInBtn) zoomInBtn.onclick = () => setZoom(cam.zoom + ZOOM_STEP);
    if (zoomOutBtn) zoomOutBtn.onclick = () => setZoom(cam.zoom - ZOOM_STEP);

    this.input.on('wheel', (pointer, gameObjects, dx, dy) => setZoom(cam.zoom - dy * 0.0015));

    this._pinchStartDist = null;
    this.input.on('pointermove', () => {
      const p1 = this.input.pointer1, p2 = this.input.pointer2;
      if (p1.isDown && p2.isDown) {
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (this._pinchStartDist != null) setZoom(cam.zoom * (dist / this._pinchStartDist));
        this._pinchStartDist = dist;
      } else {
        this._pinchStartDist = null;
        if (cam.zoom > ZOOM_MIN + 0.01 && p1.isDown) {
          const world = cam.getWorldPoint(p1.x, p1.y);
          cam.centerOn(world.x, world.y);
        }
      }
    });

    this.updateZoomButtonState();
  }

  updateZoomButtonState() {
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    if (zoomOutBtn) zoomOutBtn.disabled = this.cameras.main.zoom <= 1.001;
  }

  // Converts a point relative to the whole screen (fx,fy in 0..1) into scene
  // pixel coordinates. Hotspots and NPCs can sit anywhere in the artwork.
  pointToScene(fx, fy) {
    return { x: fx * this.scale.width, y: fy * this.scale.height };
  }

  // Standing in for each NPC in the scene: a circular badge cropped from their
  // real portrait photo (with a thin colored ring for at-a-glance identity),
  // rather than a 16x16 cartoon RPG sprite that would clash badly against a
  // photorealistic background. Falls back to a plain initial-letter badge if
  // that NPC's portrait file didn't load.
  // An invisible interactive rectangle roughly covering an NPC's torso in
  // the room's painted-in art, built from rooms.js's hitbox fractions
  // (x0,y0,x1,y1 of the whole screen). Lets hover/click work anywhere on
  // their body instead of requiring the small marker dot to be hit exactly.
  addNpcHitbox(cfg) {
    const a = this.pointToScene(cfg.hitbox.x0, cfg.hitbox.y0);
    const b = this.pointToScene(cfg.hitbox.x1, cfg.hitbox.y1);
    const rect = this.add.rectangle((a.x + b.x) / 2, (a.y + b.y) / 2, b.x - a.x, b.y - a.y, 0xffffff, 0);
    rect.setInteractive({ useHandCursor: true });
    return rect;
  }

  addNPC(cfg) {
    const p = this.pointToScene(cfg.fx, cfg.fy);
    const npcKey = cfg.name.replace(/\s+/g, '-').toLowerCase();
    const hasFullBody = !cfg.bakedIntoScene && cfg.fullKey && this.hasRealAsset(cfg.fullKey);
    const texKey = cfg.bakedIntoScene
      ? this.ensureGlowDot()
      : hasFullBody
        ? this.ensureFullBodyCutout(npcKey, cfg.fullKey)
        : this.ensureCircularBadge(npcKey, cfg.portraitKey, cfg.tint, cfg.name.charAt(0));
    const npc = this.add.image(p.x, p.y, texKey);
    if (cfg.bakedIntoScene) {
      // Already painted into the room's background art — just a small
      // tinted click marker, same visual language as an object hotspot,
      // rather than a badge or cutout on top of art that already has them
      // standing there.
      npc.setTint(cfg.tint);
      npc.setScale(MARKER_SCALE);
      npc.setAlpha(0.85);
      this.tweens.add({ targets: npc, scale: { from: MARKER_SCALE, to: MARKER_SCALE_PEAK }, alpha: { from: 0.85, to: 0.5 }, duration: 900, yoyo: true, repeat: -1 });
    } else {
      // Full-body art stands taller than it is wide, so fx/fy (tuned as the
      // NPC's rough center when they were a small circular badge) is anchored
      // lower in the frame here — most of the figure rises above that point,
      // with just enough below it to keep feet grounded near the same spot.
      if (hasFullBody) npc.setOrigin(0.5, 0.62);
      this.tweens.add({ targets: npc, scale: { from: 1, to: 1.05 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    npc.npcName = cfg.name;
    npc.npcLine = cfg.line;
    npc.npcPortraitKey = cfg.portraitKey;
    npc.cfgFx = cfg.fx;
    npc.cfgFy = cfg.fy;
    // The approach camera frames higher than fx/fy alone would — fy is
    // tuned as roughly a person's torso center (that's also where the
    // marker dot sits), so zooming straight to it crops in tight on the
    // chest instead of reading as "walked up to talk to them". Biasing
    // toward the top of their hitbox keeps the face in frame instead, both
    // on first approach and when the camera returns here after a chat.
    npc.approachFy = cfg.hitbox ? cfg.hitbox.y0 + (cfg.hitbox.y1 - cfg.hitbox.y0) * 0.25 : cfg.fy;
    const matched = CHARACTERS.find(c => c.name === cfg.name);
    npc.answers = matched?.answers;
    // Separate from npcName, which stays the fixed internal identifier every
    // TALKED_TO/ASKED_QUESTIONS entry and hotspot `requires` gate keys off of.
    // Every character in this cast displays under that same fixed name, but
    // this indirection is kept in case a future character ever needs a
    // display name that differs from their internal identifier.
    npc.npcDisplayName = matched?.displayName || cfg.name;
    this.npcs.push(npc);

    // A baked-into-scene NPC with a defined hitbox gets a separate,
    // invisible rectangle sized to roughly their torso instead of relying on
    // the small marker dot for hover/click — the dot stays as a passive
    // visual cue, but the whole hittable object hosts the actual
    // interaction, so the mouse only has to be somewhere over their body,
    // not precisely on a 32px dot, to highlight and talk to them.
    const hitTarget = (cfg.bakedIntoScene && cfg.hitbox) ? this.addNpcHitbox(cfg) : npc;
    if (hitTarget === npc) npc.setInteractive({ useHandCursor: true });
    hitTarget.on('pointerover', () => {
      this.setPrompt('Talk to ' + npc.npcDisplayName);
      if (cfg.bakedIntoScene) this.showSpotlight(p.x, p.y);
    });
    hitTarget.on('pointerout', () => {
      this.setPrompt(null);
      if (cfg.bakedIntoScene) this.hideSpotlight();
    });
    hitTarget.on('pointerdown', () => {
      if (this.isDialogOpen()) { this.advanceDialog(); return; }
      this.approachPoint(cfg.fx, npc.approachFy);
      this.talkToNPC(npc);
    });
    return npc;
  }

  // A taller full-body stand-in for an NPC, used instead of the circular
  // badge when their fullKey art is available. The source photos are shot
  // against a plain dark studio backdrop rather than a true transparent
  // cutout, so the edges are feathered to transparent here (two sequential
  // destination-in gradient passes, horizontal then vertical) instead —
  // lets the backdrop fade into the room art rather than showing a hard
  // rectangle.
  ensureFullBodyCutout(cacheKeySuffix, fullKey) {
    const cacheKey = 'full-' + cacheKeySuffix;
    if (this.textures.exists(cacheKey)) return cacheKey;

    const img = this.textures.get(fullKey).getSourceImage();
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const targetH = 380;
    const targetW = Math.round(iw / ih * targetH);

    const tex = this.textures.createCanvas(cacheKey, targetW, targetH);
    const ctx = tex.getContext();
    ctx.drawImage(img, 0, 0, iw, ih, 0, 0, targetW, targetH);

    const marginX = targetW * 0.16, marginY = targetH * 0.1;
    ctx.globalCompositeOperation = 'destination-in';

    const hGrad = ctx.createLinearGradient(0, 0, targetW, 0);
    hGrad.addColorStop(0, 'rgba(255,255,255,0)');
    hGrad.addColorStop(marginX / targetW, 'rgba(255,255,255,1)');
    hGrad.addColorStop(1 - marginX / targetW, 'rgba(255,255,255,1)');
    hGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 0, targetW, targetH);

    const vGrad = ctx.createLinearGradient(0, 0, 0, targetH);
    vGrad.addColorStop(0, 'rgba(255,255,255,0)');
    vGrad.addColorStop(marginY / targetH, 'rgba(255,255,255,1)');
    vGrad.addColorStop(1 - marginY / targetH, 'rgba(255,255,255,1)');
    vGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, targetW, targetH);

    ctx.globalCompositeOperation = 'source-over';
    tex.refresh();
    return cacheKey;
  }

  ensureCircularBadge(cacheKeySuffix, portraitKey, ringColorHex, initial) {
    const cacheKey = 'badge-' + cacheKeySuffix;
    if (this.textures.exists(cacheKey)) return cacheKey;

    const size = 96;
    const tex = this.textures.createCanvas(cacheKey, size, size);
    const ctx = tex.getContext();
    const cx = size / 2, cy = size / 2, r = size / 2 - 4;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const hasPortrait = portraitKey && this.hasRealAsset(portraitKey);
    if (hasPortrait) {
      const img = this.textures.get(portraitKey).getSourceImage();
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const srcSize = Math.min(iw, ih);
      const sx = (iw - srcSize) / 2, sy = Math.max(0, (ih - srcSize) / 3);
      ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, size, size);
    } else {
      ctx.fillStyle = '#2a2622';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#e9e6da';
      ctx.font = 'bold 40px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initial, cx, cy + 3);
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#' + ringColorHex.toString(16).padStart(6, '0');
    ctx.stroke();

    tex.refresh();
    return cacheKey;
  }

  // Draws the already-decoded real portrait onto a canvas for the dialogue
  // box. Phaser revokes its internal blob: URL for a loaded image immediately
  // after decoding it, so re-using getSourceImage().src directly is unreliable
  // — it can point at an already-dead URL by the time something else reads it.
  // Drawing onto a canvas instead reads the in-memory bitmap, sidestepping
  // that entirely.
  resolvePortrait(npc) {
    if (npc.npcPortraitKey && this.hasRealAsset(npc.npcPortraitKey)) {
      return this.getRealPortraitDataURL(npc.npcPortraitKey);
    }
    return null;
  }

  getRealPortraitDataURL(key) {
    this._portraitCache = this._portraitCache || {};
    if (this._portraitCache[key]) return this._portraitCache[key];

    const img = this.textures.get(key).getSourceImage();
    const targetSize = 256;
    const srcSize = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const sx = ((img.naturalWidth || img.width) - srcSize) / 2;
    const sy = ((img.naturalHeight || img.height) - srcSize) / 3; // bias up, portraits are usually top-weighted

    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, Math.max(0, sy), srcSize, srcSize, 0, 0, targetSize, targetSize);

    const url = canvas.toDataURL('image/jpeg', 0.9);
    this._portraitCache[key] = url;
    return url;
  }

  punchZoom() {
    const cam = this.cameras.main;
    const base = cam.zoom;
    this.tweens.add({ targets: cam, zoom: base * 1.08, duration: 190, yoyo: true, ease: 'Sine.easeInOut' });
  }

  // Persistent directional controls, always present rather than tied to a
  // specific glowing spot in the art — left/right turn to the adjacent room
  // (same rooms.js prevRoom/nextRoom the corner text buttons already drive),
  // up walks forward via rooms.js's walkForward where a room defines one.
  // Arrow keys mirror all three so desktop players don't need the mouse.
  // Shares screen space with panControls (see updateDirNavVisibility): this
  // is the "still looking at the wide room" control, panControls is the
  // "already zoomed in on a person" one, and the two never show together.
  setupDirNav() {
    const cfg = this.roomConfig;
    const leftBtn = document.getElementById('lookLeftBtn');
    const rightBtn = document.getElementById('lookRightBtn');
    const upBtn = document.getElementById('walkForwardBtn');

    if (cfg.walkZones && cfg.walkZones.length) {
      // A crowded room like the main bar: forward/left/right move between
      // areas of THIS room instead of leaving it (see rooms.js's walkZones)
      // — leaving is still available via the corner text buttons, unaffected.
      const zones = cfg.walkZones;
      const mid = zones[Math.floor(zones.length / 2)];
      if (leftBtn) { leftBtn.onclick = () => this.panToPoint(zones[0].fx, zones[0].fy); leftBtn.disabled = false; }
      if (rightBtn) { rightBtn.onclick = () => this.panToPoint(zones[zones.length - 1].fx, zones[zones.length - 1].fy); rightBtn.disabled = false; }
      if (upBtn) { upBtn.onclick = () => this.panToPoint(mid.fx, mid.fy); upBtn.disabled = false; }
      this.input.keyboard.on('keydown-UP', (event) => { if (event) event.preventDefault(); if (!this.isDialogOpen()) this.panToPoint(mid.fx, mid.fy); });
      this.input.keyboard.on('keydown-LEFT', () => { if (!this.isDialogOpen()) this.panToPoint(zones[0].fx, zones[0].fy); });
      this.input.keyboard.on('keydown-RIGHT', () => { if (!this.isDialogOpen()) this.panToPoint(zones[zones.length - 1].fx, zones[zones.length - 1].fy); });
      this.updateDirNavVisibility();
      return;
    }

    if (leftBtn) { leftBtn.onclick = () => this.goToRoom(cfg.prevRoom); leftBtn.disabled = !cfg.prevRoom; }
    if (rightBtn) { rightBtn.onclick = () => this.goToRoom(cfg.nextRoom); rightBtn.disabled = !cfg.nextRoom; }
    if (upBtn) { upBtn.onclick = () => this.walkForward(cfg.walkForward); upBtn.disabled = !cfg.walkForward; }

    this.input.keyboard.on('keydown-UP', (event) => {
      if (event) event.preventDefault();
      if (this.isDialogOpen() || !cfg.walkForward) return;
      this.walkForward(cfg.walkForward);
    });
    this.input.keyboard.on('keydown-LEFT', () => { if (!this.isDialogOpen()) this.goToRoom(cfg.prevRoom); });
    this.input.keyboard.on('keydown-RIGHT', () => { if (!this.isDialogOpen()) this.goToRoom(cfg.nextRoom); });

    this.updateDirNavVisibility();
  }

  updateDirNavVisibility() {
    const dirNav = document.getElementById('dirNav');
    if (!dirNav) return;
    dirNav.classList.toggle('visible', this.cameras.main.zoom <= 1.01);
  }

  walkForward(wf) {
    if (!wf || this._walking) return;
    this._walking = true;
    playClick();
    this.setPrompt(null);

    const cam = this.cameras.main;
    const p = this.pointToScene(wf.fx, wf.fy);
    this.tweens.killTweensOf(cam);
    // Slower and tighter than approachPoint's zoom — this is meant to read
    // as footsteps closing the distance, not a quick glance at a clue.
    this.tweens.add({ targets: cam, zoom: 2.3, duration: 900, ease: 'Sine.easeIn' });
    cam.pan(p.x, p.y, 900, 'Sine.easeIn');

    this.time.delayedCall(950, () => {
      const hasCloseup = wf.approachBgKey && this.hasRealAsset(wf.approachBgKey);
      if (!hasCloseup) { this.finishWalkForward(wf); return; }
      cam.fadeOut(200, 5, 5, 8);
      cam.once('camerafadeoutcomplete', () => {
        this.bg.setTexture(wf.approachBgKey);
        this.fitBackgroundToScene();
        cam.zoom = 1;
        cam.centerOn(this.scale.width / 2, this.scale.height / 2);
        cam.fadeIn(300, 5, 5, 8);
        this.time.delayedCall(900, () => this.finishWalkForward(wf));
      });
    });
  }

  finishWalkForward(wf) {
    playClick();
    const cam = this.cameras.main;
    cam.fadeOut(350, 5, 5, 8);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.restart({ room: wf.targetRoom, failedKeys: this.failedKeys });
    });
  }

  // Eases the camera in on a clicked marker (see rooms.js's approachOnClick,
  // used for the crowded main room) so clicking someone in a wide shot full
  // of people actually reads as walking up to them, rather than just
  // popping a dialog over a scene that still looks the same size. Only
  // fires from the fully-zoomed-out state — if the player's already
  // manually zoomed in on a different part of the room, respect that
  // instead of yanking the camera to a new spot mid-interaction.
  approachPoint(fx, fy) {
    if (!this.roomConfig.approachOnClick) return;
    const cam = this.cameras.main;
    if (cam.zoom > 1.01) return;
    this.panToPoint(fx, fy);
  }

  // The actual camera move, shared by approachPoint (first click, from fully
  // zoomed out) and the pan chevrons (stepping between people while already
  // zoomed in) — kept separate from approachPoint so the chevrons can move
  // the camera regardless of current zoom, while a stray click elsewhere in
  // the room still respects "only approach from zoomed-out".
  panToPoint(fx, fy) {
    const cam = this.cameras.main;
    const p = this.pointToScene(fx, fy);
    this.tweens.add({ targets: cam, zoom: 1.9, duration: 450, ease: 'Sine.easeOut' });
    cam.pan(p.x, p.y, 450, 'Sine.easeOut');
    this.updateZoomButtonState();
    // cam.zoom only reaches 1.9 once the tween above finishes — checking
    // visibility synchronously here would still see the pre-tween value and
    // hide the chevrons right after showing them, so it's rechecked once
    // the animation has actually landed.
    this.time.delayedCall(460, () => { this.updateZoomButtonState(); this.updatePanControlsVisibility(); });
    if (this.panTargets && this.panTargets.length) {
      let best = 0, bestDist = Infinity;
      this.panTargets.forEach((t, i) => {
        const d = Math.hypot(t.fx - fx, t.fy - fy);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      this.panIndex = best;
    }
    this.updatePanControlsVisibility();
  }

  // Builds the ordered list of people the pan chevrons step between (left to
  // right across the room) and wires the buttons up — only for rooms that
  // opt in via approachOnClick, since a single-NPC room has nothing to pan
  // between.
  setupPanControls() {
    const cfg = this.roomConfig;
    this.panTargets = cfg.approachOnClick
      ? (cfg.npcs || [])
        .filter(n => n.bakedIntoScene)
        .map(n => ({ fx: n.fx, fy: n.hitbox ? n.hitbox.y0 + (n.hitbox.y1 - n.hitbox.y0) * 0.25 : n.fy }))
        .sort((a, b) => a.fx - b.fx)
      : [];
    this.panIndex = -1;

    const prevBtn = document.getElementById('panPrevBtn');
    const nextBtn = document.getElementById('panNextBtn');
    if (prevBtn) prevBtn.onclick = () => this.stepPan(-1);
    if (nextBtn) nextBtn.onclick = () => this.stepPan(1);
    this.updatePanControlsVisibility();
  }

  stepPan(delta) {
    if (!this.panTargets || !this.panTargets.length) return;
    playClick();
    const from = this.panIndex >= 0 ? this.panIndex : 0;
    const next = (from + delta + this.panTargets.length) % this.panTargets.length;
    const target = this.panTargets[next];
    this.hideSpotlight();
    this.panToPoint(target.fx, target.fy);
  }

  updatePanControlsVisibility() {
    const panControls = document.getElementById('panControls');
    if (panControls) {
      const show = this.roomConfig.approachOnClick && this.panTargets && this.panTargets.length > 1 && this.cameras.main.zoom > 1.01;
      panControls.classList.toggle('visible', !!show);
    }
    // Tied together rather than called separately at each of this method's
    // call sites: dirNav (the wide-room-view controls) and panControls (the
    // zoomed-in-on-a-person controls) are always each other's exact inverse,
    // so one visibility pass covers both.
    this.updateDirNavVisibility();
  }

  isDialogOpen() {
    return !!this.dialogEl && this.dialogEl.style.display === 'flex';
  }

  showDialog(title, body, portraitUrl, questions) {
    this._afterDialogClose = null;
    this.dialogTitleEl.textContent = title;
    this.dialogBodyEl.innerHTML = '<span class="cursor"></span>';
    this.dialogEl.style.display = 'flex';
    // A new conversation should always open scrolled to the top, not
    // wherever a previous (possibly longer) answer left the scroll
    // position — otherwise a short answer could open already scrolled past
    // its own content, looking blank.
    if (this.dialogScrollareaEl) this.dialogScrollareaEl.scrollTop = 0;
    this.promptEl.style.display = 'none';
    const talkedToPanelEl = document.getElementById('talkedToPanel');
    if (talkedToPanelEl) talkedToPanelEl.style.display = 'none';
    if (portraitUrl) {
      this.dialogPortraitEl.src = portraitUrl;
      this.dialogPortraitEl.style.display = 'block';
    } else {
      this.dialogPortraitEl.style.display = 'none';
    }

    this.dialogQuestionsEl.innerHTML = '';
    const hasQuestions = !!(questions && questions.length);
    // Toggles the compact-viewport side-by-side layout (questions left,
    // answer boxed on the right — see index.html's max-height:480px rule);
    // a plain examine/first-glance dialog with no questions keeps the
    // simple single-column look regardless of viewport size.
    this.dialogEl.classList.toggle('has-questions', hasQuestions);
    if (hasQuestions) {
      questions.forEach(q => {
        const btn = document.createElement('button');
        btn.className = 'dialog-question-btn' + (q.asked ? ' asked' : '');
        btn.textContent = q.text;
        btn.onclick = (e) => { e.stopPropagation(); q.onClick(); };
        this.dialogQuestionsEl.appendChild(btn);
      });
      this.dialogQuestionsEl.style.display = 'flex';
    } else {
      this.dialogQuestionsEl.style.display = 'none';
    }

    this._dialogBody = body;
    clearInterval(this._typeInterval);
    let i = 0;
    this._typeInterval = setInterval(() => {
      i++;
      this.dialogBodyEl.textContent = body.slice(0, i);
      if (i % 2 === 0) playTypeTick();
      if (i >= body.length) {
        clearInterval(this._typeInterval);
        this._typeInterval = null;
      }
    }, 16);
  }

  // First click/Space while the text is still typing out completes it
  // instantly instead of closing — only a second click/Space (once the full
  // line is showing) actually dismisses the dialog. Lets impatient players
  // skip the typewriter effect without accidentally closing before reading.
  advanceDialog() {
    if (this._typeInterval) {
      clearInterval(this._typeInterval);
      this._typeInterval = null;
      this.dialogBodyEl.textContent = this._dialogBody;
    } else {
      this.closeDialog();
    }
  }

  closeDialog() {
    clearInterval(this._typeInterval);
    this._typeInterval = null;
    this.dialogEl.style.display = 'none';
    this.exitInterview();
    this.renderTalkedToPanel();
    if (this._afterDialogClose) {
      const cb = this._afterDialogClose;
      this._afterDialogClose = null;
      cb();
    }
  }
}
