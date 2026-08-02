import Phaser from 'phaser';
import { currentRoom } from '../state.js';

// Every real background/portrait asset the game might use. A file that
// doesn't exist yet simply fails to load — tracked in failedKeys below —
// and RoomScene falls back to a labeled placeholder instead of crashing.
const ROOM_BACKGROUNDS = {
  'bg-frontext': 'frontext.png',
  'bg-parkinglot': 'parkinglot.png',
  'bg-leftext': 'leftext.png',
  'bg-rightext': 'rightext.png',
  'bg-backext': 'backext.png',
  'bg-mainbar': 'mainbar.png',
  'bg-mensroom': 'mensroom.png',
  'bg-womensroom': 'womensroom.png',
  'bg-office': 'office.png'
};

// A closer "walked up to it" shot shown mid-transition for a room's
// walkForward hotspot (see rooms.js) — one per doorway/path this applies to,
// not a full background in its own right, so kept out of ROOM_BACKGROUNDS.
const APPROACH_SHOTS = {
  'approach-frontdoor': 'frontdoor-closeup.png',
  'approach-parkinglot': 'parkinglot-approach.png'
};

const PORTRAITS = {
  'portrait-jade': 'jade.png',
  'portrait-tiny': 'tiny.png',
  'portrait-sonny': 'sonny.png',
  'portrait-marisol': 'marisol.png',
  'portrait-cruz': 'cruz.png',
  'portrait-duck': 'duck.png',
  'portrait-nikki': 'nikki.png',
  'portrait-roz': 'roz.png',
  'portrait-dale': 'dale.png',
  'portrait-skylar': 'skylar.png',
  'portrait-bigd': 'bigd.png'
};

// Full-body scene art for NPCs — a taller cutout-style shot standing in for
// their spot in the room, replacing the circular portrait badge when present
// (see RoomScene's addNPC). Same missing-file-tolerant loading as PORTRAITS.
const FULLBODY = {
  'full-tiny': 'tiny-full.png'
};

export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.failedKeys = new Set();
    this.load.on('loaderror', (file) => this.failedKeys.add(file.key));

    Object.entries(ROOM_BACKGROUNDS).forEach(([key, file]) => {
      this.load.image(key, import.meta.env.BASE_URL + 'assets/ai-art/' + file);
    });
    Object.entries(PORTRAITS).forEach(([key, file]) => {
      this.load.image(key, import.meta.env.BASE_URL + 'assets/ai-art/' + file);
    });
    Object.entries(FULLBODY).forEach(([key, file]) => {
      this.load.image(key, import.meta.env.BASE_URL + 'assets/ai-art/' + file);
    });
    Object.entries(APPROACH_SHOTS).forEach(([key, file]) => {
      this.load.image(key, import.meta.env.BASE_URL + 'assets/ai-art/' + file);
    });
  }

  create() {
    this.scene.start('Room', {
      room: currentRoom || 'frontext',
      failedKeys: this.failedKeys
    });
  }
}
