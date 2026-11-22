// The screenshot scenes behind ?shot=start|play|alert|win.
// Each one plays the real rules forward from a fresh world, steered by an autopilot
// that plans a route on a grid (danger-weighted, so it walks around cones instead of
// through them), waits crouched when the next step is watched, tosses a coin to pull
// a guard off the path when it stalls, and sprints for the exit when the way is clear.
// The same seed always gives the same frame.
import { FIELD, STEP, GUARD, CAMERA, PLAYER } from './config.js';
import {
  EVENT_CAUGHT, EVENT_OVER, EVENT_WIN, canSee, laserActive, pointSegmentDist,
} from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 10;
const ALERT_LIMIT_SECONDS = 60;
const WIN_LIMIT_SECONDS = 1500;
const SAMPLE = STEP;

const DIRS = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

// The route planner's grid: 24 px cells over the 960x600 floor.
const GRID = 24;
const COLS = Math.ceil(FIELD.width / GRID);
const ROWS = Math.ceil(FIELD.height / GRID);

function rectBlocks(x, y, radius, blockers) {
  for (const r of blockers) {
    const nx = Math.max(r.x, Math.min(x, r.x + r.w));
    const ny = Math.max(r.y, Math.min(y, r.y + r.h));
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

// Is the point (x,y) inside any guard or camera cone right now?
// `margin` widens the cones a little, so the pilot keeps a buffer instead of
// shaving the edge of a sweep that is about to turn onto it.
function dangerAt(state, x, y, margin = 0) {
  let danger = 0;
  for (const g of state.guards) {
    const v = canSee(g.x, g.y, g.angle, GUARD.range * (1 + margin), GUARD.halfAngle + margin * 0.2, x, y, state.blockers);
    if (v.seen) danger = Math.max(danger, 2 - v.dist / GUARD.range);
    const d = Math.hypot(g.x - x, g.y - y);
    if (d < 70) danger = Math.max(danger, 0.8);
  }
  for (const c of state.cameras) {
    const v = canSee(c.x, c.y, c.angle, CAMERA.range * (1 + margin), CAMERA.halfAngle + margin * 0.2, x, y, state.blockers);
    if (v.seen) danger = Math.max(danger, 1.6 - v.dist / CAMERA.range);
  }
  // Live lasers: a step onto the beam is a trip, so keep a wide berth.
  for (const l of state.lasers ?? []) {
    if (!laserActive(l, state.clock, state.empTimer)) continue;
    const d = pointSegmentDist(x, y, l.x1, l.y1, l.x2, l.y2);
    if (d < 26) danger = Math.max(danger, 2 - d / 26);
  }
  return danger;
}

function objective(state) {
  for (const l of state.loot) {
    if (!l.taken) return { x: l.x, y: l.y };
  }
  // The exit's corners sit outside the top camera's sweep: aim for the nearer one.
  const e = state.level.exit;
  const p = state.player;
  const left = { x: e.x + 8, y: e.y + e.h / 2 };
  const right = { x: e.x + e.w - 8, y: e.y + e.h / 2 };
  return Math.hypot(left.x - p.x, left.y - p.y) < Math.hypot(right.x - p.x, right.y - p.y) ? left : right;
}

function makeHeap() {
  const items = [];
  function push(priority, value) {
    items.push([priority, value]);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent][0] <= items[i][0]) break;
      const tmp = items[parent];
      items[parent] = items[i];
      items[i] = tmp;
      i = parent;
    }
  }
  function pop() {
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < items.length && items[l][0] < items[smallest][0]) smallest = l;
        if (r < items.length && items[r][0] < items[smallest][0]) smallest = r;
        if (smallest === i) break;
        const tmp = items[smallest];
        items[smallest] = items[i];
        items[i] = tmp;
        i = smallest;
      }
    }
    return top;
  }
  return { push, pop, get size() { return items.length; } };
}

const NEIGHBOURS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414],
];

// A* over the floor grid. A step costs its length plus six times the danger of the
// cell it enters, so the route bends around cones instead of through them.
// (Exported for headless verification of the pilot.)
export function findPath(state, from, to) {
  const key = (cx, cy) => cy * COLS + cx;
  const freeCache = new Map();
  const dangerCache = new Map();
  function cellFree(cx, cy) {
    const k = key(cx, cy);
    if (!freeCache.has(k)) {
      freeCache.set(k, !rectBlocks(cx * GRID + GRID / 2, cy * GRID + GRID / 2, 12, state.blockers));
    }
    return freeCache.get(k);
  }
  function cellDanger(cx, cy) {
    const k = key(cx, cy);
    if (!dangerCache.has(k)) {
      dangerCache.set(k, dangerAt(state, cx * GRID + GRID / 2, cy * GRID + GRID / 2, 0.1));
    }
    return dangerCache.get(k);
  }
  function nearestFree(cx, cy) {
    for (let r = 0; r <= 3; r += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        for (let dy = -r; dy <= r; dy += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
          if (cellFree(nx, ny)) return { cx: nx, cy: ny };
        }
      }
    }
    return null;
  }
  const start = nearestFree(Math.floor(from.x / GRID), Math.floor(from.y / GRID));
  const goal = nearestFree(Math.floor(to.x / GRID), Math.floor(to.y / GRID));
  if (!start || !goal) return null;
  const sKey = key(start.cx, start.cy);
  const gKey = key(goal.cx, goal.cy);
  const gScore = new Map([[sKey, 0]]);
  const came = new Map();
  const heap = makeHeap();
  heap.push(Math.hypot(goal.cx - start.cx, goal.cy - start.cy), sKey);
  while (heap.size > 0) {
    const [, current] = heap.pop();
    if (current === gKey) {
      const cells = [];
      let cur = current;
      while (cur !== sKey) {
        cells.push(cur);
        cur = came.get(cur);
      }
      cells.reverse();
      const path = cells.map((k) => ({
        x: (k % COLS) * GRID + GRID / 2,
        y: Math.floor(k / COLS) * GRID + GRID / 2,
      }));
      path.push({ x: to.x, y: to.y });
      return path;
    }
    const ccx = current % COLS;
    const ccy = Math.floor(current / COLS);
    const g = gScore.get(current);
    for (const [dx, dy, base] of NEIGHBOURS) {
      const nx = ccx + dx;
      const ny = ccy + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (!cellFree(nx, ny)) continue;
      // No cutting corners through a wall.
      if (dx !== 0 && dy !== 0 && (!cellFree(ccx + dx, ccy) || !cellFree(ccx, ccy + dy))) continue;
      const nk = key(nx, ny);
      const ng = g + base + cellDanger(nx, ny) * 6;
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        came.set(nk, current);
        heap.push(ng + Math.hypot(goal.cx - nx, goal.cy - ny), nk);
      }
    }
  }
  return null;
}

// One autopilot decision. `pilot` carries the cool-off latch, the route and the
// waiting clock between calls; `elapsed` is the simulated time. Returns the input
// plus the latch's new value. (Exported for headless verification of the pilot.)
export function autopilot(state, random, pilot, elapsed) {
  const p = state.player;
  const target = objective(state);

  // Cool-off latch: once the meter has climbed past 35, stay in cool-off until it
  // settles below 8 — no dithering back and forth at the threshold.
  if (pilot.cooling && state.detection < 8) pilot.cooling = false;
  if (!pilot.cooling && state.detection > 35 && !state.alarm) pilot.cooling = true;

  // Cool off: get unseen until the meter settles — step to the least-watched
  // neighbour, or wait crouched where it is safe. Close to the objective, hold
  // the safe spot instead of giving up ground: the window opens again soon.
  if (pilot.cooling) {
    const stayDanger = dangerAt(state, p.x, p.y, 0.1);
    const distToGoal = Math.hypot(target.x - p.x, target.y - p.y);
    if (stayDanger === 0 && distToGoal < 150) {
      return { x: 0, y: 0, sprint: false, crouch: true, coin: null, cooling: pilot.cooling };
    }
    let best = { x: 0, y: 0, sprint: false, crouch: stayDanger > 0, coin: null };
    let bestDanger = stayDanger;
    for (const [dx, dy] of DIRS) {
      if (dx === 0 && dy === 0) continue;
      const len = Math.hypot(dx, dy) || 1;
      const nx = p.x + (dx / len) * PLAYER.walk * 0.35;
      const ny = p.y + (dy / len) * PLAYER.walk * 0.35;
      if (nx < PLAYER.radius || nx > FIELD.width - PLAYER.radius) continue;
      if (ny < PLAYER.radius || ny > FIELD.height - PLAYER.radius) continue;
      if (rectBlocks(nx, ny, PLAYER.radius, state.blockers)) continue;
      const danger = dangerAt(state, nx, ny, 0.1);
      if (danger < bestDanger - 0.05) {
        bestDanger = danger;
        best = { x: dx, y: dy, sprint: false, crouch: true, coin: null };
      }
    }
    return { ...best, cooling: pilot.cooling };
  }

  // Flee: while the alarm is up (or detection is nearly full) the only job is to
  // break line of sight — sprint to the neighbour farthest from every guard.
  // Distance is the whole score: a watched spot is still safer than a caught one.
  if (state.alarm || state.detection > 65) {
    let best = { x: 0, y: 0, sprint: false, crouch: false, coin: null };
    let bestScore = -Infinity;
    for (const [dx, dy] of DIRS) {
      const len = Math.hypot(dx, dy) || 1;
      const nx = p.x + (dx / len) * PLAYER.sprint * 0.35;
      const ny = p.y + (dy / len) * PLAYER.sprint * 0.35;
      if (nx < PLAYER.radius || nx > FIELD.width - PLAYER.radius) continue;
      if (ny < PLAYER.radius || ny > FIELD.height - PLAYER.radius) continue;
      if (rectBlocks(nx, ny, PLAYER.radius, state.blockers)) continue;
      let nearest = Infinity;
      for (const g of state.guards) nearest = Math.min(nearest, Math.hypot(g.x - nx, g.y - ny));
      if (nearest > bestScore) {
        bestScore = nearest;
        best = { x: dx, y: dy, sprint: true, crouch: false, coin: null };
      }
    }
    return { ...best, cooling: pilot.cooling };
  }

  // Follow the planned route, replanning as the cones sweep (every 1.5 s of play,
  // or when the objective changes).
  const targetKey = `${target.x},${target.y}`;
  if (!pilot.path || pilot.pathTarget !== targetKey || elapsed >= pilot.replanAt) {
    pilot.path = findPath(state, p, target);
    pilot.pathTarget = targetKey;
    pilot.replanAt = elapsed + 1.5;
    pilot.waitSince = null;
  }
  let waypoint = null;
  if (pilot.path) {
    while (pilot.path.length > 0) {
      const next = pilot.path[0];
      if (Math.hypot(next.x - p.x, next.y - p.y) < 14) pilot.path.shift();
      else break;
    }
    waypoint = pilot.path.length > 0 ? pilot.path[0] : target;
  } else {
    waypoint = target;
  }

  const stayDanger = dangerAt(state, p.x, p.y, 0.1);
  const wayDanger = dangerAt(state, waypoint.x, waypoint.y, 0.1);
  // A live laser between here and the next step: hold still and let it blink off.
  // The beam's off-window is over a second — long enough to cross — but only
  // if the pilot does not walk into it while it is lit.
  for (const l of state.lasers ?? []) {
    if (!laserActive(l, state.clock, state.empTimer)) continue;
    const nearBeam = pointSegmentDist(waypoint.x, waypoint.y, l.x1, l.y1, l.x2, l.y2) < 34
      || pointSegmentDist(p.x, p.y, l.x1, l.y1, l.x2, l.y2) < 20;
    if (nearBeam && wayDanger > 0.5) {
      return { x: 0, y: 0, sprint: false, crouch: true, coin: null, cooling: pilot.cooling };
    }
  }
  // The next step is watched and here is safe: wait crouched for the patrol to pass.
  if (wayDanger > 1.2 && stayDanger < 0.3) {
    if (pilot.waitSince === null) pilot.waitSince = elapsed;
    let coin = null;
    if (elapsed - pilot.waitSince > 4 && state.coins > 0 && !state.coin) {
      // Pull the watcher off with a coin tossed past him.
      let guard = null;
      let guardDist = Infinity;
      for (const g of state.guards) {
        const d = Math.hypot(g.x - waypoint.x, g.y - waypoint.y);
        if (d < guardDist) { guardDist = d; guard = g; }
      }
      if (guard) {
        const dx = guard.x - p.x;
        const dy = guard.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        coin = {
          x: Math.max(24, Math.min(FIELD.width - 24, guard.x + (dx / len) * 150)),
          y: Math.max(24, Math.min(FIELD.height - 24, guard.y + (dy / len) * 150)),
        };
        pilot.waitSince = elapsed;
      }
    }
    return { x: 0, y: 0, sprint: false, crouch: true, coin, cooling: pilot.cooling };
  }
  pilot.waitSince = null;

  const dx = waypoint.x - p.x;
  const dy = waypoint.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  const crouch = wayDanger > 0.3 || stayDanger > 0.3;
  // Sprint the open stretches: when the way ahead is clear and the meter is quiet.
  let sprint = false;
  if (!crouch && state.detection < 10) {
    sprint = true;
    for (let t = 0.1; t <= 0.4; t += 0.1) {
      const sx = p.x + (dx / len) * PLAYER.sprint * t;
      const sy = p.y + (dy / len) * PLAYER.sprint * t;
      if (rectBlocks(sx, sy, PLAYER.radius, state.blockers) || dangerAt(state, sx, sy, 0.15) > 0) {
        sprint = false;
        break;
      }
    }
  }
  return { x: dx / len, y: dy / len, sprint, crouch, coin: null, cooling: pilot.cooling };
}

function runAutopilot(world, seconds, random) {
  const state = world.state;
  const pilot = { cooling: false, path: null, pathTarget: null, replanAt: 0, waitSince: null };
  let elapsed = 0;
  let events = 0;
  for (let step = 0; step < seconds / SAMPLE; step += 1) {
    // The shop between floors: confirm straight through with the starting kit.
    if (state.mode === 'shop') {
      events |= world.step(SAMPLE, { x: 0, y: 0, confirm: true });
      elapsed += SAMPLE;
      pilot.path = null;
      continue;
    }
    const decision = autopilot(state, random, pilot, elapsed);
    pilot.cooling = decision.cooling;
    events |= world.step(SAMPLE, decision);
    elapsed += SAMPLE;
    if (events & (EVENT_OVER | EVENT_WIN)) break;
    if (state.mode === 'floorclear') {
      // The interstitial counts down inside step(); keep stepping until play resumes.
      let guard = 0;
      while (state.mode === 'floorclear' && guard < 600) {
        events |= world.step(SAMPLE, { x: 0, y: 0 });
        elapsed += SAMPLE;
        guard += 1;
      }
      pilot.path = null;
      if (events & EVENT_WIN) break;
    }
  }
  return events;
}

/**
 * Set `world` to the named scene (start, play, alert or win) and return the screen
 * to draw over it and the best score to show.
 */
export function stageShot(name, world, random) {
  if (name === 'play') {
    world.startGame();
    world.loadFloor(2); // The Gallery: lasers, cases, loot and cones in one frame.
    world.state.mode = 'play';
    runAutopilot(world, PLAY_SECONDS, random);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'alert') {
    world.startGame();
    world.loadFloor(1);
    world.state.mode = 'play';
    // Walk at the sentry — he never moves, so his sweeping cone is a sure thing.
    // Walk, never sprint: sprinting is loud, and the noise would pull him off his
    // post and onto the thief. Stop short of him: close enough to be seen, too far
    // to be grabbed. Once the alarm has tripped, never go back: flee with the
    // autopilot instead, so the frame catches the hunt mid-chase — red cones, a
    // full meter, the thief free.
    const sentry = world.state.guards.find((g) => g.waypoints.length <= 1) ?? world.state.guards[0];
    let alarmed = false;
    for (let step = 0; step < ALERT_LIMIT_SECONDS / SAMPLE; step += 1) {
      if (world.state.alarm) { alarmed = true; break; }
      if (world.state.mode !== 'play') break;
      const p = world.state.player;
      const dx = sentry.x - p.x;
      const dy = sentry.y - p.y;
      const dist = Math.hypot(dx, dy);
      const len = dist || 1;
      const input = dist < 60
        ? { x: 0, y: 0, sprint: false, crouch: false }
        : { x: dx / len, y: dy / len, sprint: false, crouch: false };
      const events = world.step(SAMPLE, input);
      if (events & (EVENT_OVER | EVENT_CAUGHT)) break;
    }
    if (alarmed) {
      const pilot = { cooling: false, path: null, pathTarget: null, replanAt: 0, waitSince: null };
      let elapsed = 0;
      for (let i = 0; i < 90 && world.state.alarm && world.state.mode === 'play'; i += 1) {
        const decision = autopilot(world.state, random, pilot, elapsed);
        pilot.cooling = decision.cooling;
        world.step(SAMPLE, decision);
        elapsed += SAMPLE;
      }
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    world.startGame();
    const events = runAutopilot(world, WIN_LIMIT_SECONDS, random);
    const over = world.state.mode === 'over';
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score, events };
  }
  world.reset();
  for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, { x: 0, y: 0 });
  return { screen: SCREEN_TITLE, best: 0 };
}
