// The five floors of Meridian Bank, each a hand-drawn plan.
// A rect is {x, y, w, h} in field coordinates (960x600, origin top-left).
// walls block movement and sight; cover blocks movement and sight; shadow slows detection.
// Guards walk their waypoints in a loop (a single waypoint means a sentry who stands and sweeps).
// Cameras sit on a wall and sweep their cone back and forth around baseAngle.
// lasers blink on/off on a cycle: {x1,y1,x2,y2,on,off,phase} in seconds.
// doors are locked until the matching keycard is lifted; bonusLoot is optional —
// it pays the same as loot but never blocks the exit.
// safes are cracked with E: stop the needle in the green zone three times.
import { FIELD } from './config.js';

const WALL = 16;

function border() {
  return [
    { x: 0, y: 0, w: FIELD.width, h: WALL },
    { x: 0, y: FIELD.height - WALL, w: FIELD.width, h: WALL },
    { x: 0, y: 0, w: WALL, h: FIELD.height },
    { x: FIELD.width - WALL, y: 0, w: WALL, h: FIELD.height },
  ];
}

export const LEVELS = [
  {
    name: 'Floor 1 — The Lobby',
    par: 75,
    spawn: { x: 480, y: 545 },
    exit: { x: 430, y: 16, w: 100, h: 26 },
    walls: border(),
    // Reception desk, pillars, planters: three ways across — left, centre, right.
    cover: [
      { x: 400, y: 268, w: 160, h: 56, kind: 'desk' },
      { x: 196, y: 148, w: 44, h: 44, kind: 'pillar' },
      { x: 720, y: 148, w: 44, h: 44, kind: 'pillar' },
      { x: 196, y: 408, w: 52, h: 32, kind: 'planter' },
      { x: 712, y: 408, w: 52, h: 32, kind: 'planter' },
    ],
    shadow: [
      { x: 296, y: 300, w: 130, h: 84 },
      { x: 560, y: 380, w: 130, h: 84 },
    ],
    guards: [
      { waypoints: [{ x: 130, y: 110 }, { x: 830, y: 110 }], speed: 62 },
      { waypoints: [{ x: 830, y: 490 }, { x: 130, y: 490 }], speed: 62 },
    ],
    cameras: [
      { x: 480, y: 16, baseAngle: Math.PI / 2, sweep: 0.9 },
      { x: 16, y: 300, baseAngle: 0, sweep: 0.8 },
    ],
    lasers: [],
    doors: [],
    keycards: [],
    safes: [],
    loot: [
      { x: 884, y: 76, kind: 'gold', name: 'Gold Bar' },
      { x: 76, y: 524, kind: 'gold', name: 'Gold Bar' },
    ],
    bonusLoot: [],
  },
  {
    name: 'Floor 2 — The Vault Hall',
    par: 90,
    spawn: { x: 76, y: 540 },
    exit: { x: 430, y: 16, w: 100, h: 26 },
    walls: [
      ...border(),
      // Two wing walls with a gap in the middle: left wing, centre hall, right wing.
      { x: 320, y: 0, w: 24, h: 210 },
      { x: 320, y: 390, w: 24, h: 210 },
      { x: 616, y: 0, w: 24, h: 210 },
      { x: 616, y: 390, w: 24, h: 210 },
    ],
    cover: [
      { x: 420, y: 262, w: 120, h: 76, kind: 'desk' },
      { x: 380, y: 110, w: 84, h: 42, kind: 'desk' },
      { x: 496, y: 448, w: 84, h: 42, kind: 'desk' },
      { x: 176, y: 148, w: 38, h: 38, kind: 'pillar' },
      { x: 782, y: 148, w: 38, h: 38, kind: 'pillar' },
      { x: 176, y: 448, w: 38, h: 38, kind: 'pillar' },
      { x: 782, y: 448, w: 38, h: 38, kind: 'pillar' },
    ],
    shadow: [
      { x: 344, y: 96, w: 110, h: 76 },
      { x: 500, y: 420, w: 110, h: 76 },
      { x: 80, y: 280, w: 110, h: 76 },
    ],
    guards: [
      { waypoints: [{ x: 240, y: 100 }, { x: 240, y: 500 }], speed: 62 },
      { waypoints: [{ x: 720, y: 100 }, { x: 720, y: 500 }], speed: 62 },
      { waypoints: [{ x: 480, y: 180 }], speed: 0, sweep: 1.1 },
    ],
    cameras: [
      { x: 480, y: 16, baseAngle: Math.PI / 2, sweep: 0.9 },
      { x: 944, y: 300, baseAngle: Math.PI, sweep: 0.8 },
      { x: 16, y: 300, baseAngle: 0, sweep: 0.8 },
    ],
    lasers: [],
    doors: [],
    keycards: [],
    safes: [
      { x: 480, y: 360, name: 'Wall Safe' },
    ],
    loot: [
      { x: 88, y: 76, kind: 'ledger', name: 'The Meridian Ledger' },
      { x: 872, y: 76, kind: 'gold', name: 'Gold Bar' },
      { x: 480, y: 540, kind: 'diamond', name: 'The Halcyon Diamond' },
    ],
    bonusLoot: [],
  },
  {
    name: 'Floor 3 — The Gallery',
    par: 90,
    spawn: { x: 480, y: 545 },
    exit: { x: 430, y: 16, w: 100, h: 26 },
    walls: border(),
    // Glass display cases in two rows: four lanes between them, and the lasers
    // cut across the middle of the room.
    cover: [
      { x: 150, y: 170, w: 110, h: 50, kind: 'case' },
      { x: 425, y: 170, w: 110, h: 50, kind: 'case' },
      { x: 700, y: 170, w: 110, h: 50, kind: 'case' },
      { x: 150, y: 390, w: 110, h: 50, kind: 'case' },
      { x: 425, y: 390, w: 110, h: 50, kind: 'case' },
      { x: 700, y: 390, w: 110, h: 50, kind: 'case' },
      { x: 60, y: 280, w: 40, h: 40, kind: 'pillar' },
      { x: 860, y: 280, w: 40, h: 40, kind: 'pillar' },
    ],
    shadow: [
      { x: 280, y: 250, w: 120, h: 80 },
      { x: 580, y: 250, w: 120, h: 80 },
      { x: 430, y: 450, w: 120, h: 70 },
    ],
    guards: [
      { waypoints: [{ x: 120, y: 110 }, { x: 840, y: 110 }], speed: 66 },
      { waypoints: [{ x: 840, y: 490 }, { x: 120, y: 490 }], speed: 66 },
      { waypoints: [{ x: 480, y: 250 }], speed: 0, sweep: 1.2 },
    ],
    cameras: [
      { x: 480, y: 16, baseAngle: Math.PI / 2, sweep: 0.9 },
      { x: 16, y: 300, baseAngle: 0, sweep: 0.8 },
    ],
    lasers: [
      // Across the middle, between the two rows of cases: time the blink.
      { x1: 130, y1: 305, x2: 830, y2: 305, on: 2.6, off: 1.6, phase: 0 },
      // Vertical cut on the right side.
      { x1: 640, y1: 90, x2: 640, y2: 510, on: 2.2, off: 1.8, phase: 1.1 },
    ],
    doors: [],
    keycards: [],
    safes: [],
    loot: [
      { x: 96, y: 76, kind: 'art', name: 'The Jade Mask' },
      { x: 864, y: 76, kind: 'art', name: 'The Sapphire Tiara' },
      { x: 480, y: 540, kind: 'gold', name: 'Gold Bar' },
    ],
    bonusLoot: [],
  },
  {
    name: 'Floor 4 — The Bullion Room',
    par: 105,
    spawn: { x: 480, y: 300 },
    exit: { x: 430, y: 16, w: 100, h: 26 },
    walls: [
      ...border(),
      // Vault wings with a mid gap, and two pinch walls shaping the centre corridor.
      { x: 240, y: 0, w: 24, h: 180 },
      { x: 240, y: 420, w: 24, h: 180 },
      { x: 696, y: 0, w: 24, h: 180 },
      { x: 696, y: 420, w: 24, h: 180 },
      { x: 264, y: 288, w: 150, h: 24 },
      { x: 546, y: 288, w: 150, h: 24 },
      // The bonus vault: a walled-off corner room, bottom-left. Its only door is
      // the red keycard door in the room's top wall.
      { x: 200, y: 420, w: 24, h: 180 },
      { x: 16, y: 420, w: 104, h: 24 },
      { x: 160, y: 420, w: 64, h: 24 },
    ],
    cover: [
      { x: 400, y: 108, w: 160, h: 56, kind: 'vault' },
      { x: 400, y: 436, w: 160, h: 56, kind: 'vault' },
      { x: 120, y: 268, w: 60, h: 64, kind: 'desk' },
      { x: 780, y: 268, w: 60, h: 64, kind: 'desk' },
    ],
    shadow: [
      { x: 300, y: 330, w: 120, h: 70 },
      { x: 540, y: 200, w: 120, h: 70 },
      { x: 80, y: 330, w: 100, h: 70 },
    ],
    guards: [
      { waypoints: [{ x: 300, y: 80 }, { x: 660, y: 80 }], speed: 68 },
      { waypoints: [{ x: 660, y: 520 }, { x: 300, y: 520 }], speed: 68 },
      { waypoints: [{ x: 200, y: 140 }, { x: 200, y: 380 }], speed: 62 },
      { waypoints: [{ x: 760, y: 460 }, { x: 760, y: 140 }], speed: 62 },
    ],
    cameras: [
      { x: 480, y: 16, baseAngle: Math.PI / 2, sweep: 0.9 },
      { x: 16, y: 300, baseAngle: 0, sweep: 0.8 },
      { x: 944, y: 300, baseAngle: Math.PI, sweep: 0.8 },
    ],
    lasers: [
      // Across the centre corridor, under the pinch walls.
      { x1: 264, y1: 330, x2: 696, y2: 330, on: 2.4, off: 1.6, phase: 0.6 },
    ],
    doors: [
      { x: 120, y: 420, w: 40, h: 24, key: 'red' },
    ],
    keycards: [
      { x: 880, y: 300, key: 'red', name: 'Red Keycard' },
    ],
    safes: [
      { x: 480, y: 200, name: 'Bullion Safe' },
    ],
    loot: [
      { x: 80, y: 80, kind: 'gold', name: 'Gold Bar' },
      { x: 880, y: 80, kind: 'gold', name: 'Gold Bar' },
      { x: 300, y: 520, kind: 'diamond', name: 'The Halcyon Diamond' },
      { x: 660, y: 520, kind: 'ledger', name: 'The Meridian Ledger' },
    ],
    bonusLoot: [
      { x: 70, y: 520, kind: 'diamond', name: 'Vault Diamond' },
      { x: 150, y: 500, kind: 'gold', name: 'Gold Bar' },
    ],
  },
  {
    name: 'Floor 5 — The Rooftop Getaway',
    par: 90,
    spawn: { x: 480, y: 545 },
    exit: { x: 410, y: 16, w: 140, h: 26 },
    walls: border(),
    // Open roof: air-conditioning units and vents as cover, the helipad up top.
    cover: [
      { x: 180, y: 160, w: 90, h: 60, kind: 'ac' },
      { x: 690, y: 160, w: 90, h: 60, kind: 'ac' },
      { x: 180, y: 400, w: 90, h: 60, kind: 'ac' },
      { x: 690, y: 400, w: 90, h: 60, kind: 'ac' },
      { x: 435, y: 280, w: 90, h: 50, kind: 'vent' },
    ],
    shadow: [
      { x: 300, y: 120, w: 120, h: 80 },
      { x: 540, y: 420, w: 120, h: 80 },
    ],
    guards: [
      { waypoints: [{ x: 140, y: 120 }, { x: 820, y: 120 }], speed: 72 },
      { waypoints: [{ x: 820, y: 480 }, { x: 140, y: 480 }], speed: 72 },
    ],
    cameras: [
      { x: 480, y: 16, baseAngle: Math.PI / 2, sweep: 1.0 },
      { x: 16, y: 300, baseAngle: 0, sweep: 0.9 },
      { x: 944, y: 300, baseAngle: Math.PI, sweep: 0.9 },
    ],
    lasers: [
      // The last line of defence before the helipad.
      { x1: 300, y1: 120, x2: 660, y2: 120, on: 2.0, off: 2.0, phase: 0 },
    ],
    doors: [],
    keycards: [],
    safes: [],
    loot: [
      { x: 76, y: 76, kind: 'gold', name: 'Gold Bar' },
      { x: 884, y: 76, kind: 'diamond', name: 'The Meridian Crown' },
    ],
    bonusLoot: [],
  },
];

// Every piece of loot in the whole job, required and bonus alike.
export const TOTAL_LOOT = LEVELS.reduce(
  (n, l) => n + l.loot.length + (l.bonusLoot?.length ?? 0),
  0,
);
export const REQUIRED_LOOT = LEVELS.reduce((n, l) => n + l.loot.length, 0);
