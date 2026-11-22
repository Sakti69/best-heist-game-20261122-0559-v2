// Meridian Vault II: the simulation. Pure logic, no DOM, no canvas —
// so the same code can be stepped headlessly in Node to verify the floors.
// The thief crosses five floors, guards patrol with raycast vision cones, wall cameras sweep,
// lasers blink across the corridors, a keycard door guards a bonus vault, safes crack open
// for a price, gadgets (EMP, smoke, coins) buy time, and a shop between floors sells more.
import {
  FIELD, STEP, LIVES, COINS_PER_FLOOR, PLAYER, GUARD, CAMERA, LASER, GADGETS, SHOP,
  DETECTION, NOISE, SCORE, SAFE,
} from './config.js';
import { LEVELS, TOTAL_LOOT } from './levels.js';

export const EVENT_LOOT = 1;
export const EVENT_COIN = 2;
export const EVENT_ALARM = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_FLOOR = 16;
export const EVENT_WIN = 32;
export const EVENT_OVER = 64;
export const EVENT_EMP = 128;
export const EVENT_SMOKE = 256;
export const EVENT_SAFE = 512;
export const EVENT_KEYCARD = 1024;
export const EVENT_LASER = 2048;

const TAU = Math.PI * 2;

function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function circleHitsRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

// Slab test: does the segment (x0,y0)-(x1,y1) cross the rect?
function segmentHitsRect(x0, y0, x1, y1, rect) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let tMin = 0;
  let tMax = 1;
  if (dx === 0) {
    if (x0 < rect.x || x0 > rect.x + rect.w) return false;
  } else {
    let t1 = (rect.x - x0) / dx;
    let t2 = (rect.x + rect.w - x0) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  if (dy === 0) {
    if (y0 < rect.y || y0 > rect.y + rect.h) return false;
  } else {
    let t1 = (rect.y - y0) / dy;
    let t2 = (rect.y + rect.h - y0) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return true;
}

// A camera mounted flush on its wall must see past the wall it sits on: the sight
// test starts a hair outside the wall, so the wall's own edge never counts as a hit.
function sightBlocked(x0, y0, x1, y1, blockers) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const sx = x0 + (dx / len) * 0.5;
  const sy = y0 + (dy / len) * 0.5;
  for (let i = 0; i < blockers.length; i += 1) {
    if (segmentHitsRect(sx, sy, x1, y1, blockers[i])) return true;
  }
  return false;
}

// Can a watcher at (vx,vy) facing `angle` see the point (px,py)?
export function canSee(vx, vy, angle, range, halfAngle, px, py, blockers) {
  const dx = px - vx;
  const dy = py - vy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return { seen: false, dist };
  if (Math.abs(angleDiff(Math.atan2(dy, dx), angle)) > halfAngle) return { seen: false, dist };
  if (sightBlocked(vx, vy, px, py, blockers)) return { seen: false, dist };
  return { seen: true, dist };
}

// The ray starts a hair out from the watcher, so a wall the watcher sits on
// never clips his own sight.
export function rayDistance(x, y, angle, maxDist, blockers) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const ox = x + dx * 0.5;
  const oy = y + dy * 0.5;
  let best = maxDist;
  for (let i = 0; i < blockers.length; i += 1) {
    const r = blockers[i];
    // Slab test against the ray, keeping the entry distance.
    let tMin = 0;
    let tMax = best;
    let ok = true;
    if (dx === 0) {
      if (ox < r.x || ox > r.x + r.w) ok = false;
    } else {
      let t1 = (r.x - ox) / dx;
      let t2 = (r.x + r.w - ox) / dx;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) ok = false;
    }
    if (ok) {
      if (dy === 0) {
        if (oy < r.y || oy > r.y + r.h) ok = false;
      } else {
        let t1 = (r.y - oy) / dy;
        let t2 = (r.y + r.h - oy) / dy;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) ok = false;
      }
    }
    if (ok && tMin + 0.5 < best) best = tMin + 0.5;
  }
  return best;
}

// Distance from a point to a line segment.
export function pointSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Is this laser live right now? A laser blinks on/off on its own cycle;
// an EMP pulse kills every laser while it lasts.
export function laserActive(laser, clock, empTimer) {
  if (empTimer > 0) return false;
  const cycle = laser.on + laser.off;
  const t = (clock + laser.phase) % cycle;
  return t < laser.on;
}

export function gradeRun(stats) {
  if (stats.alarms === 0 && stats.caught === 0) return 'S';
  if (stats.alarms <= 1 && stats.caught === 0) return 'A';
  if (stats.caught <= 1) return 'B';
  return 'C';
}

export function createWorld(random) {
  const state = {
    mode: 'title', // title | play | floorclear | shop | win | over
    floorIndex: 0,
    level: null,
    blockers: [],
    player: { x: 0, y: 0, angle: -Math.PI / 2, moving: false, crouch: false, sprint: false, invuln: 0 },
    guards: [],
    cameras: [],
    lasers: [],
    doors: [],
    keycards: [],
    safes: [],
    loot: [],
    bonus: [],
    coins: COINS_PER_FLOOR,
    coin: null, // flying coin {x0,y0,x1,y1,t}
    gadgets: { emp: GADGETS.empStart, smoke: GADGETS.smokeStart },
    empTimer: 0,
    smokes: [], // {x, y, t}
    keys: [], // keycard keys held
    cracking: null, // {safe, needle, dir, zone, hits}
    detection: 0,
    alarm: false,
    alarmTimer: 0,
    alarmedThisFloor: false,
    lives: LIVES,
    score: 0,
    time: 0,
    floorTime: 0,
    floorClearTimer: 0,
    noiseTimer: 0,
    clock: 0, // total simulated time, drives sentry/camera sweeps
    exitOpen: false,
    lootTaken: 0,
    message: '',
    messageTimer: 0,
    stats: { alarms: 0, caught: 0, loot: 0, safes: 0 },
    totalLoot: TOTAL_LOOT,
  };

  function say(text) {
    state.message = text;
    state.messageTimer = 3;
  }

  function rebuildBlockers() {
    const locked = state.doors.filter((d) => !d.open);
    state.blockers = [
      ...state.level.walls,
      ...state.level.cover,
      ...state.safes.map((s) => ({ x: s.x - 18, y: s.y - 18, w: 36, h: 36 })),
      ...locked,
    ];
  }

  function loadFloor(index) {
    const level = LEVELS[index];
    state.floorIndex = index;
    state.level = level;
    state.player.x = level.spawn.x;
    state.player.y = level.spawn.y;
    state.player.angle = -Math.PI / 2;
    state.player.invuln = 0;
    state.guards = level.guards.map((g) => ({
      x: g.waypoints[0].x,
      y: g.waypoints[0].y,
      angle: g.waypoints.length > 1
        ? Math.atan2(g.waypoints[1].y - g.waypoints[0].y, g.waypoints[1].x - g.waypoints[0].x)
        : Math.PI / 2,
      sweepBase: Math.PI / 2,
      sweepAmp: g.sweep ?? 0,
      waypoints: g.waypoints,
      wp: g.waypoints.length > 1 ? 1 : 0,
      speed: g.speed,
      state: 'patrol', // patrol | pause | investigate | look | return | chase
      tx: 0,
      ty: 0,
      look: 0,
    }));
    state.cameras = level.cameras.map((c) => ({
      x: c.x,
      y: c.y,
      baseAngle: c.baseAngle,
      sweep: c.sweep,
      phase: random.range(0, TAU),
      angle: c.baseAngle,
    }));
    state.lasers = (level.lasers ?? []).map((l) => ({ ...l, lastTrip: -99 }));
    state.doors = (level.doors ?? []).map((d) => ({ ...d, open: false }));
    state.keycards = (level.keycards ?? []).map((k) => ({ ...k, taken: false }));
    state.safes = (level.safes ?? []).map((s) => ({ ...s, opened: false }));
    state.loot = level.loot.map((l) => ({ ...l, taken: false }));
    state.bonus = (level.bonusLoot ?? []).map((l) => ({ ...l, taken: false }));
    state.coins = COINS_PER_FLOOR;
    state.coin = null;
    state.empTimer = 0;
    state.smokes = [];
    state.cracking = null;
    state.detection = 0;
    state.alarm = false;
    state.alarmTimer = 0;
    state.alarmedThisFloor = false;
    state.floorTime = 0;
    state.exitOpen = false;
    state.lootTaken = 0;
    rebuildBlockers();
  }

  function reset() {
    state.mode = 'title';
    state.lives = LIVES;
    state.score = 0;
    state.time = 0;
    state.clock = 0;
    state.keys = [];
    state.gadgets = { emp: GADGETS.empStart, smoke: GADGETS.smokeStart };
    state.stats = { alarms: 0, caught: 0, loot: 0, safes: 0 };
    state.message = '';
    state.messageTimer = 0;
    loadFloor(0);
  }

  function startGame() {
    state.lives = LIVES;
    state.score = 0;
    state.time = 0;
    state.keys = [];
    state.gadgets = { emp: GADGETS.empStart, smoke: GADGETS.smokeStart };
    state.stats = { alarms: 0, caught: 0, loot: 0, safes: 0 };
    loadFloor(0);
    state.mode = 'play';
  }

  function pointInShadow(x, y) {
    const shadows = state.level.shadow;
    for (let i = 0; i < shadows.length; i += 1) {
      const s = shadows[i];
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
    }
    return false;
  }

  function pointInSmoke(x, y) {
    for (const s of state.smokes) {
      if (Math.hypot(s.x - x, s.y - y) <= GADGETS.smokeRadius) return true;
    }
    return false;
  }

  function moveCircle(body, dx, dy, radius) {
    // Axis-separated: slide along walls instead of sticking to them.
    let nx = body.x + dx;
    let blocked = false;
    for (let i = 0; i < state.blockers.length; i += 1) {
      if (circleHitsRect(nx, body.y, radius, state.blockers[i])) { blocked = true; break; }
    }
    if (!blocked && nx >= radius && nx <= FIELD.width - radius) body.x = nx;
    let ny = body.y + dy;
    blocked = false;
    for (let i = 0; i < state.blockers.length; i += 1) {
      if (circleHitsRect(body.x, ny, radius, state.blockers[i])) { blocked = true; break; }
    }
    if (!blocked && ny >= radius && ny <= FIELD.height - radius) body.y = ny;
  }

  function alertGuards(x, y, radius) {
    for (const g of state.guards) {
      if (g.state === 'chase') continue;
      if (Math.hypot(g.x - x, g.y - y) <= radius) {
        g.state = 'investigate';
        g.tx = x;
        g.ty = y;
      }
    }
  }

  function stepGuards(dt) {
    for (const g of state.guards) {
      if (g.state === 'chase') {
        // The alarm tells every guard exactly where the thief is.
        const dx = state.player.x - g.x;
        const dy = state.player.y - g.y;
        const dist = Math.hypot(dx, dy) || 1;
        g.angle = Math.atan2(dy, dx);
        moveCircle(g, (dx / dist) * GUARD.chase * dt, (dy / dist) * GUARD.chase * dt, GUARD.radius);
        continue;
      }
      if (g.state === 'investigate' || g.state === 'return') {
        const tx = g.state === 'investigate' ? g.tx : g.waypoints[g.wp].x;
        const ty = g.state === 'investigate' ? g.ty : g.waypoints[g.wp].y;
        const dx = tx - g.x;
        const dy = ty - g.y;
        const dist = Math.hypot(dx, dy);
        const speed = g.state === 'investigate' ? GUARD.investigate : GUARD.patrol;
        if (dist < 6) {
          if (g.state === 'investigate') {
            g.state = 'look';
            g.look = NOISE.investigateTime;
          } else {
            g.state = 'patrol';
          }
        } else {
          g.angle = Math.atan2(dy, dx);
          moveCircle(g, (dx / dist) * speed * dt, (dy / dist) * speed * dt, GUARD.radius);
        }
        continue;
      }
      if (g.state === 'look') {
        g.look -= dt;
        g.angle += 0.9 * dt; // scans the room while he wonders what that was
        if (g.look <= 0) {
          // Back to the nearest waypoint on his route.
          let best = 0;
          let bestDist = Infinity;
          for (let i = 0; i < g.waypoints.length; i += 1) {
            const d = Math.hypot(g.waypoints[i].x - g.x, g.waypoints[i].y - g.y);
            if (d < bestDist) { bestDist = d; best = i; }
          }
          g.wp = best;
          g.state = 'return';
        }
        continue;
      }
      if (g.state === 'pause') {
        // A beat at the end of a patrol leg: the guard stops, looks around, and
        // turns toward his next leg before walking on — a fair warning, not a snap.
        g.look -= dt;
        const next = g.waypoints[g.wp];
        const want = Math.atan2(next.y - g.y, next.x - g.x);
        const diff = angleDiff(want, g.angle);
        const turn = Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
        g.angle += turn;
        if (g.look <= 0) g.state = 'patrol';
        continue;
      }
      // Patrol: walk the route, or stand and sweep for a sentry.
      if (g.waypoints.length <= 1 || g.speed === 0) {
        g.angle = g.sweepBase + g.sweepAmp * Math.sin(state.clock * 0.7);
        continue;
      }
      const target = g.waypoints[g.wp];
      const dx = target.x - g.x;
      const dy = target.y - g.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 6) {
        g.wp = (g.wp + 1) % g.waypoints.length;
        g.state = 'pause';
        g.look = 0.8;
      } else {
        g.angle = Math.atan2(dy, dx);
        moveCircle(g, (dx / dist) * g.speed * dt, (dy / dist) * g.speed * dt, GUARD.radius);
      }
    }
  }

  function stepCameras() {
    for (const c of state.cameras) {
      c.angle = c.baseAngle + c.sweep * Math.sin(state.clock * CAMERA.sweepSpeed + c.phase);
    }
  }

  function stepDetection(dt) {
    const p = state.player;
    const inShadow = pointInShadow(p.x, p.y);
    const inSmoke = pointInSmoke(p.x, p.y);
    let seen = false;
    let rate = 0;
    if (!inSmoke) {
      for (const g of state.guards) {
        const v = canSee(g.x, g.y, g.angle, GUARD.range, GUARD.halfAngle, p.x, p.y, state.blockers);
        if (v.seen) {
          seen = true;
          rate = Math.max(rate, DETECTION.guardFar + (DETECTION.guardNear - DETECTION.guardFar) * (1 - v.dist / GUARD.range));
        }
      }
      if (state.empTimer <= 0) {
        for (const c of state.cameras) {
          const v = canSee(c.x, c.y, c.angle, CAMERA.range, CAMERA.halfAngle, p.x, p.y, state.blockers);
          if (v.seen) {
            seen = true;
            rate = Math.max(rate, DETECTION.cameraFar + (DETECTION.cameraNear - DETECTION.cameraFar) * (1 - v.dist / CAMERA.range));
          }
        }
      }
    }
    if (seen) {
      if (p.crouch) rate *= DETECTION.crouchFactor;
      if (inShadow) rate *= DETECTION.shadowFactor;
      if (p.sprint) rate *= DETECTION.sprintFactor;
      state.detection = Math.min(100, state.detection + rate * dt);
      state.alarmTimer = 0;
    } else {
      state.detection = Math.max(0, state.detection - DETECTION.decay * dt);
      if (state.alarm) state.alarmTimer += dt;
    }
    return seen;
  }

  function tripAlarm() {
    state.alarm = true;
    state.alarmTimer = 0;
    state.alarmedThisFloor = true;
    state.stats.alarms += 1;
    for (const g of state.guards) g.state = 'chase';
    say('ALARM! Break line of sight!');
  }

  function standDownAlarm() {
    state.alarm = false;
    state.detection = DETECTION.alarmReset;
    for (const g of state.guards) {
      if (g.state === 'chase') {
        let best = 0;
        let bestDist = Infinity;
        for (let i = 0; i < g.waypoints.length; i += 1) {
          const d = Math.hypot(g.waypoints[i].x - g.x, g.waypoints[i].y - g.y);
          if (d < bestDist) { bestDist = d; best = i; }
        }
        g.wp = best;
        g.state = 'return';
      }
    }
    say('Alarm stood down. Stay quiet.');
  }

  function catchPlayer() {
    state.stats.caught += 1;
    state.score = Math.max(0, state.score - SCORE.catchPenalty);
    state.lives -= 1;
    state.cracking = null;
    if (state.lives <= 0) {
      state.mode = 'over';
      say('Caught. The job is over.');
      return EVENT_CAUGHT | EVENT_OVER;
    }
    say(`Caught! ${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left.`);
    // Back to the floor entrance; the building settles.
    state.player.x = state.level.spawn.x;
    state.player.y = state.level.spawn.y;
    state.player.invuln = 2;
    state.detection = 0;
    state.alarm = false;
    state.alarmTimer = 0;
    for (const g of state.guards) {
      g.x = g.waypoints[0].x;
      g.y = g.waypoints[0].y;
      g.wp = g.waypoints.length > 1 ? 1 : 0;
      g.state = 'patrol';
    }
    return EVENT_CAUGHT;
  }

  // --- Gadgets -------------------------------------------------------------
  function useEmp() {
    if (state.mode !== 'play' || state.cracking) return 0;
    if (state.gadgets.emp <= 0) { say('No EMP left — buy more between floors.'); return 0; }
    if (state.empTimer > 0) return 0;
    state.gadgets.emp -= 1;
    state.empTimer = GADGETS.empSeconds;
    say('EMP pulse — cameras and lasers dark.');
    return EVENT_EMP;
  }

  function useSmoke() {
    if (state.mode !== 'play' || state.cracking) return 0;
    if (state.gadgets.smoke <= 0) { say('No smoke left — buy more between floors.'); return 0; }
    state.gadgets.smoke -= 1;
    state.smokes.push({ x: state.player.x, y: state.player.y, t: GADGETS.smokeSeconds });
    say('Smoke out. They cannot see through it.');
    return EVENT_SMOKE;
  }

  // --- Safe cracking -------------------------------------------------------
  function nearSafe() {
    const p = state.player;
    for (const s of state.safes) {
      if (!s.opened && Math.hypot(s.x - p.x, s.y - p.y) < 46) return s;
    }
    return null;
  }

  function startCrack() {
    const safe = nearSafe();
    if (!safe || state.cracking) return 0;
    const zone = random.range(0, 1 - SAFE.zoneWidth);
    state.cracking = { safe, needle: 0, dir: 1, zone, hits: 0 };
    say(`${safe.name} — stop the needle in the green zone!`);
    return 0;
  }

  function stepCrack(dt) {
    const c = state.cracking;
    c.needle += c.dir * SAFE.needleSpeed * dt;
    if (c.needle >= 1) { c.needle = 1; c.dir = -1; }
    if (c.needle <= 0) { c.needle = 0; c.dir = 1; }
    return 0;
  }

  // E pressed: beside a safe it starts a crack; mid-crack it locks the tumbler.
  // Called once per frame from main.js, so the needle position it reads is the
  // one the player sees.
  function pressInteract() {
    if (state.mode !== 'play') return 0;
    if (state.cracking) {
      const c = state.cracking;
      if (c.needle >= c.zone && c.needle <= c.zone + SAFE.zoneWidth) {
        c.hits += 1;
        c.zone = random.range(0, 1 - SAFE.zoneWidth);
        if (c.hits >= SAFE.hitsToOpen) {
          c.safe.opened = true;
          state.cracking = null;
          state.score += SAFE.reward;
          state.stats.safes += 1;
          say(`${c.safe.name} cracked! +${SAFE.reward}`);
          return EVENT_SAFE;
        }
        say(`Click. ${SAFE.hitsToOpen - c.hits} more to go.`);
      } else {
        state.detection = Math.min(100, state.detection + DETECTION.safeFail);
        say('Wrong. The tumblers scream — detection up!');
        alertGuards(state.player.x, state.player.y, 260);
        c.zone = random.range(0, 1 - SAFE.zoneWidth);
      }
      return 0;
    }
    return startCrack();
  }

  // --- Shop ----------------------------------------------------------------
  function buyShop(index) {
    if (state.mode !== 'shop') return 0;
    const items = [
      { key: 'emp', price: SHOP.emp, name: 'EMP charge' },
      { key: 'smoke', price: SHOP.smoke, name: 'Smoke bomb' },
      { key: 'life', price: SHOP.life, name: 'Extra life' },
      { key: 'coins', price: SHOP.coins, name: `+${SHOP.coinsPack} coins` },
    ];
    const item = items[index];
    if (!item) return 0;
    if (item.key === 'life' && state.lives >= SHOP.maxLives) { say('Already at max lives.'); return 0; }
    if (state.score < item.price) { say('Not enough score for that.'); return 0; }
    state.score -= item.price;
    if (item.key === 'emp') state.gadgets.emp += 1;
    else if (item.key === 'smoke') state.gadgets.smoke += 1;
    else if (item.key === 'life') state.lives += 1;
    else state.coins += SHOP.coinsPack;
    say(`${item.name} bought.`);
    return 0;
  }

  function continueShop() {
    if (state.mode !== 'shop') return;
    loadFloor(state.floorIndex + 1);
    state.mode = 'play';
    say(`${state.level.name} — lift the loot, reach the exit.`);
  }

  function stepPlay(dt, input) {
    let events = 0;
    const p = state.player;
    state.time += dt;
    state.floorTime += dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.empTimer > 0) state.empTimer -= dt;
    for (let i = state.smokes.length - 1; i >= 0; i -= 1) {
      state.smokes[i].t -= dt;
      if (state.smokes[i].t <= 0) state.smokes.splice(i, 1);
    }

    // Gadget keys and the safe-crack key are one-shot inputs, driven from main.js
    // through useEmp / useSmoke / pressInteract — never read here.

    // Cracking a safe freezes the thief in place; the world keeps moving.
    if (state.cracking) {
      events |= stepCrack(dt);
      stepGuards(dt);
      stepCameras();
      const seen = stepDetection(dt);
      if (state.detection >= 100 && !state.alarm) {
        tripAlarm();
        events |= EVENT_ALARM;
      }
      if (state.alarm && !seen && state.alarmTimer >= DETECTION.alarmCool) standDownAlarm();
      if (state.alarm && p.invuln <= 0) {
        for (const g of state.guards) {
          if (Math.hypot(g.x - p.x, g.y - p.y) < GUARD.catchDistance) return events | catchPlayer();
        }
      }
      return events;
    }

    // Move the thief.
    const len = Math.hypot(input.x, input.y);
    const nx = len > 0 ? input.x / len : 0;
    const ny = len > 0 ? input.y / len : 0;
    p.crouch = !!input.crouch;
    p.sprint = !!input.sprint && !p.crouch && len > 0;
    p.moving = len > 0;
    const speed = p.crouch ? PLAYER.crouch : p.sprint ? PLAYER.sprint : PLAYER.walk;
    if (len > 0) {
      p.angle = Math.atan2(ny, nx);
      moveCircle(p, nx * speed * dt, ny * speed * dt, PLAYER.radius);
    }
    // Sprinting is loud: guards in earshot come to look, in pulses.
    if (p.sprint) {
      state.noiseTimer -= dt;
      if (state.noiseTimer <= 0) {
        state.noiseTimer = NOISE.sprintPulse;
        alertGuards(p.x, p.y, NOISE.sprintRadius);
      }
    } else {
      state.noiseTimer = 0;
    }

    // Toss a coin.
    if (input.coin && state.coins > 0 && !state.coin) {
      const dx = input.coin.x - p.x;
      const dy = input.coin.y - p.y;
      const dist = Math.hypot(dx, dy);
      const maxThrow = 320;
      const k = dist > maxThrow ? maxThrow / dist : 1;
      state.coin = { x0: p.x, y0: p.y, x1: p.x + dx * k, y1: p.y + dy * k, t: 0 };
      state.coins -= 1;
      events |= EVENT_COIN;
      say('Coin tossed.');
    }
    if (state.coin) {
      state.coin.t += dt;
      if (state.coin.t >= NOISE.coinFlight) {
        const landed = { x: state.coin.x1, y: state.coin.y1 };
        state.coin = null;
        alertGuards(landed.x, landed.y, NOISE.coinRadius);
        say('Clink. A guard turns to look.');
      }
    }

    stepGuards(dt);
    stepCameras();
    const seen = stepDetection(dt);

    // Lasers: crossing a live beam spikes the meter.
    for (const l of state.lasers) {
      if (!laserActive(l, state.clock, state.empTimer)) continue;
      if (state.clock - l.lastTrip < LASER.tripCooldown) continue;
      if (pointSegmentDist(p.x, p.y, l.x1, l.y1, l.x2, l.y2) < LASER.tripRadius) {
        l.lastTrip = state.clock;
        state.detection = Math.min(100, state.detection + LASER.tripDetection);
        events |= EVENT_LASER;
        say('Laser tripped!');
      }
    }

    if (state.detection >= 100 && !state.alarm) {
      tripAlarm();
      events |= EVENT_ALARM;
    }
    if (state.alarm && !seen && state.alarmTimer >= DETECTION.alarmCool) {
      standDownAlarm();
    }

    // Caught: a guard closes the distance while the alarm is up.
    if (state.alarm && p.invuln <= 0) {
      for (const g of state.guards) {
        if (Math.hypot(g.x - p.x, g.y - p.y) < GUARD.catchDistance) {
          return events | catchPlayer();
        }
      }
    }

    // Lift a keycard — and the door it opens.
    for (const k of state.keycards) {
      if (!k.taken && Math.hypot(k.x - p.x, k.y - p.y) < 26) {
        k.taken = true;
        state.keys.push(k.key);
        for (const d of state.doors) if (d.key === k.key) d.open = true;
        rebuildBlockers();
        events |= EVENT_KEYCARD;
        say(`${k.name} lifted. The vault door is open.`);
      }
    }

    // Lift loot.
    for (const l of state.loot) {
      if (!l.taken && Math.hypot(l.x - p.x, l.y - p.y) < 26) {
        l.taken = true;
        state.lootTaken += 1;
        state.stats.loot += 1;
        state.score += SCORE.loot;
        events |= EVENT_LOOT;
        say(`${l.name} lifted. +${SCORE.loot}`);
        if (state.lootTaken === state.loot.length) {
          state.exitOpen = true;
          say('All loot lifted. The exit is open — go!');
        }
      }
    }
    // Bonus loot pays the same but never blocks the exit.
    for (const l of state.bonus) {
      if (!l.taken && Math.hypot(l.x - p.x, l.y - p.y) < 26) {
        l.taken = true;
        state.stats.loot += 1;
        state.score += SCORE.bonusLoot;
        events |= EVENT_LOOT;
        say(`${l.name} lifted. +${SCORE.bonusLoot}`);
      }
    }

    // Reach the open exit.
    if (state.exitOpen) {
      const e = state.level.exit;
      if (circleHitsRect(p.x, p.y, PLAYER.radius, e)) {
        const timeBonus = Math.max(0, Math.round((state.level.par - state.floorTime) * 10));
        const ghost = state.alarmedThisFloor ? 0 : SCORE.ghostBonus;
        state.score += SCORE.floorClear + timeBonus + ghost;
        events |= EVENT_FLOOR;
        if (state.floorIndex >= LEVELS.length - 1) {
          state.mode = 'win';
          say('The vault is empty. You walk out clean.');
          return events | EVENT_WIN;
        }
        state.mode = 'floorclear';
        state.floorClearTimer = 2.2;
        say(`Floor clear! +${SCORE.floorClear}${timeBonus ? `, time +${timeBonus}` : ''}${ghost ? `, ghost +${ghost}` : ''}`);
        return events;
      }
    }
    return events;
  }

  function step(dt, input) {
    state.clock += dt;
    if (state.mode === 'floorclear') {
      state.floorClearTimer -= dt;
      if (state.floorClearTimer <= 0) {
        state.mode = 'shop';
        say('Black market — spend score, then move on.');
      }
      return 0;
    }
    if (state.mode === 'shop') {
      // Headless runs (screenshots, verification) confirm through step();
      // the live game confirms through main.js calling continueShop().
      if (input && input.confirm) continueShop();
      return 0;
    }
    if (state.mode === 'title') {
      // Attract mode: the floor lives while the title sits over it.
      stepGuards(dt);
      stepCameras();
      return 0;
    }
    if (state.mode !== 'play') return 0;
    return stepPlay(dt, input ?? { x: 0, y: 0 });
  }

  reset();
  return {
    state, reset, startGame, loadFloor, step, pointInShadow, useEmp, useSmoke,
    startCrack, pressInteract, nearSafe, buyShop, continueShop,
  };
}
