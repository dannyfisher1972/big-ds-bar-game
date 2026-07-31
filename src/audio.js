// Procedurally synthesized sound via the Web Audio API — no external audio
// files exist in this project, so clicks, the dialogue typewriter tick, and
// the win/lose stings are all generated on the fly. Keeps the game
// self-contained and avoids sourcing licensed audio.
//
// An earlier pass of this file also had a rain/thunder ambience loop; that
// doesn't fit a bar, and synthesizing convincing bar noise/music wasn't
// worth the complexity for this pass, so that half of the file (and the
// call to start it) was dropped.

let ctx = null;
let masterGain = null;
let muted = false;

function ensureContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 0.5;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Call once, on the first real user gesture on the page (a click), so the
// AudioContext can actually start — browsers block audio until then. Every
// play* function below silently no-ops if ctx isn't set up yet.
export function initAudio() {
  ensureContext();
}

export function setMuted(value) {
  muted = value;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
}

export function isMuted() {
  return muted;
}

export function playClick() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(720, t);
  osc.frequency.exponentialRampToValueAtTime(320, t + 0.05);
  gain.gain.setValueAtTime(0.18, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  osc.connect(gain).connect(masterGain);
  osc.start(t);
  osc.stop(t + 0.07);
}

export function playTypeTick() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1300 + Math.random() * 250, t);
  gain.gain.setValueAtTime(0.035, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
  osc.connect(gain).connect(masterGain);
  osc.start(t);
  osc.stop(t + 0.025);
}

export function playWinSting() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6 — a simple major arpeggio
  notes.forEach((freq, i) => {
    const start = t + i * 0.11;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
    osc.connect(gain).connect(masterGain);
    osc.start(start);
    osc.stop(start + 0.55);
  });
}

export function playLoseSting() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const notes = [311.13, 293.66, 261.63]; // Eb4 D4 C4 — a slow, deflating descent
  notes.forEach((freq, i) => {
    const start = t + i * 0.22;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.16, start + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
    osc.connect(gain).connect(masterGain);
    osc.start(start);
    osc.stop(start + 0.75);
  });
}
