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
    this.dialogEl.onclick = () => this.advanceDialog();
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

  fitBackgroundToScene() {
    const w = this.scale.width, h = this.scale.height;
    this.bg.setPosition(w / 2, h / 2);
    this.bg.setDisplaySize(w, h);
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
  addNPC(cfg) {
    const p = this.pointToScene(cfg.fx, cfg.fy);
    const npcKey = cfg.name.replace(/\s+/g, '-').toLowerCase();
    const texKey = this.ensureCircularBadge(npcKey, cfg.portraitKey, cfg.tint, cfg.name.charAt(0));
    const npc = this.add.image(p.x, p.y, texKey);
    npc.npcName = cfg.name;
    npc.npcLine = cfg.line;
    npc.npcPortraitKey = cfg.portraitKey;
    const matched = CHARACTERS.find(c => c.name === cfg.name);
    npc.answers = matched?.answers;
    // Separate from npcName, which stays the fixed internal identifier every
    // TALKED_TO/ASKED_QUESTIONS entry and hotspot `requires` gate keys off of.
    // Every character in this cast displays under that same fixed name, but
    // this indirection is kept in case a future character ever needs a
    // display name that differs from their internal identifier.
    npc.npcDisplayName = matched?.displayName || cfg.name;
    this.npcs.push(npc);
    this.tweens.add({ targets: npc, scale: { from: 1, to: 1.05 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    npc.setInteractive({ useHandCursor: true });
    npc.on('pointerover', () => this.setPrompt('Talk to ' + npc.npcDisplayName));
    npc.on('pointerout', () => this.setPrompt(null));
    npc.on('pointerdown', () => {
      if (this.isDialogOpen()) { this.advanceDialog(); return; }
      this.talkToNPC(npc);
    });
    return npc;
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
    this.renderTalkedToPanel();
    if (this._afterDialogClose) {
      const cb = this._afterDialogClose;
      this._afterDialogClose = null;
      cb();
    }
  }
}
