// Meridian Vault II: everything the eye sees — the floor, the cones, the lasers,
// the loot, the thief, the minimap, and the HUD bar above the canvas
// (floor, loot, gadgets, lives, score, time, alarm meter).
import { FIELD, GUARD, CAMERA, PLAYER, LIVES, GADGETS, SHOP, SAFE } from './config.js';
import { rayDistance, laserActive, canSee, gradeRun } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_SHOP = 'shop';

const CONE_RAYS = 26;

function conePolygon(ctx, x, y, angle, range, halfAngle, blockers) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i <= CONE_RAYS; i += 1) {
    const a = angle - halfAngle + (2 * halfAngle * i) / CONE_RAYS;
    const d = rayDistance(x, y, a, range, blockers);
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function lootShape(ctx, l, pulse) {
  ctx.beginPath();
  ctx.arc(l.x, l.y, 20 + pulse * 4, 0, Math.PI * 2);
  ctx.fillStyle = l.bonus ? 'rgba(182,120,240,0.20)' : 'rgba(255,211,77,0.16)';
  ctx.fill();
  if (l.kind === 'gold') {
    ctx.fillStyle = '#ffd34d';
    roundRect(ctx, l.x - 13, l.y - 7, 26, 14, 3);
    ctx.fill();
    ctx.fillStyle = '#b98a1d';
    ctx.fillRect(l.x - 13, l.y + 2, 26, 3);
  } else if (l.kind === 'ledger') {
    ctx.fillStyle = '#b678f0';
    roundRect(ctx, l.x - 10, l.y - 12, 20, 24, 2);
    ctx.fill();
    ctx.fillStyle = '#e8d5ff';
    ctx.fillRect(l.x - 6, l.y - 8, 12, 3);
    ctx.fillRect(l.x - 6, l.y - 2, 12, 3);
    ctx.fillRect(l.x - 6, l.y + 4, 8, 3);
  } else if (l.kind === 'art') {
    ctx.fillStyle = '#8a6a3c';
    roundRect(ctx, l.x - 14, l.y - 11, 28, 22, 2);
    ctx.fill();
    ctx.fillStyle = '#e8b4d0';
    ctx.fillRect(l.x - 10, l.y - 7, 20, 14);
    ctx.fillStyle = '#7a4a6a';
    ctx.beginPath();
    ctx.arc(l.x - 3, l.y, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#7ee7ff';
    ctx.fillRect(-10, -10, 20, 20);
    ctx.fillStyle = '#c8f6ff';
    ctx.fillRect(-10, -10, 20, 6);
    ctx.restore();
  }
  ctx.fillStyle = l.bonus ? '#d9b3ff' : '#ffe9a8';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(l.name.toUpperCase(), l.x, l.y + 30);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function drawFloor(state) {
    const level = state.level;
    // Night floor: deep slate with a faint tile grid.
    ctx.fillStyle = '#1b2334';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    for (let x = 48; x < FIELD.width; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, FIELD.height); ctx.stroke();
    }
    for (let y = 48; y < FIELD.height; y += 48) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(FIELD.width, y); ctx.stroke();
    }
    // Shadow patches: dark floor where detection crawls.
    for (const s of level.shadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      roundRect(ctx, s.x, s.y, s.w, s.h, 14);
      ctx.fill();
    }
    // Exit doorway in the top wall — a helipad on the roof.
    const e = level.exit;
    const isRoof = state.floorIndex === 4;
    ctx.fillStyle = state.exitOpen ? '#1f7a4a' : '#5a2a2a';
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = state.exitOpen ? '#37d67a' : '#c05a5a';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.exitOpen ? (isRoof ? 'HELIPAD — OPEN' : 'EXIT — OPEN') : (isRoof ? 'HELIPAD — LOCKED' : 'EXIT — LOCKED'), e.x + e.w / 2, e.y + e.h / 2 + 1);
    if (isRoof) {
      ctx.strokeStyle = state.exitOpen ? '#37d67a' : '#5a2a2a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x + e.w / 2, 70, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = state.exitOpen ? '#37d67a' : '#5a2a2a';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText('H', e.x + e.w / 2, 71);
    }
    // Loot, each with a pulsing halo so it reads at a glance.
    for (const l of state.loot) {
      if (l.taken) continue;
      const pulse = 0.5 + 0.3 * Math.sin(state.clock * 3 + l.x);
      lootShape(ctx, l, pulse);
    }
    // Bonus loot: purple halo, behind the keycard door or off the main path.
    for (const l of state.bonus) {
      if (l.taken) continue;
      const pulse = 0.5 + 0.3 * Math.sin(state.clock * 3 + l.x + 2);
      lootShape(ctx, { ...l, bonus: true }, pulse);
    }
    // Keycards.
    for (const k of state.keycards) {
      if (k.taken) continue;
      const pulse = 0.5 + 0.3 * Math.sin(state.clock * 3 + k.x);
      ctx.beginPath();
      ctx.arc(k.x, k.y, 16 + pulse * 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,80,80,0.18)';
      ctx.fill();
      ctx.fillStyle = '#ff5a5a';
      roundRect(ctx, k.x - 11, k.y - 7, 22, 14, 3);
      ctx.fill();
      ctx.fillStyle = '#ffd7d7';
      ctx.fillRect(k.x - 7, k.y - 3, 8, 2);
      ctx.fillRect(k.x - 7, k.y + 2, 12, 2);
      ctx.fillStyle = '#ffb3b3';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillText(k.name.toUpperCase(), k.x, k.y + 26);
    }
    // Safes: steel boxes with a dial.
    for (const s of state.safes) {
      ctx.fillStyle = s.opened ? '#3d4a63' : '#6a7688';
      roundRect(ctx, s.x - 18, s.y - 18, 36, 36, 5);
      ctx.fill();
      ctx.strokeStyle = s.opened ? '#37d67a' : '#ffd34d';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#222a3a';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#9ec8ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.opened ? '#37d67a' : '#ffe9a8';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillText(s.opened ? 'OPEN' : 'SAFE — E', s.x, s.y + 30);
    }
  }

  function drawCover(state) {
    for (const c of state.level.cover) {
      if (c.kind === 'desk') {
        ctx.fillStyle = '#6b4f2a';
        roundRect(ctx, c.x, c.y, c.w, c.h, 6);
        ctx.fill();
        ctx.fillStyle = '#8a6a3c';
        ctx.fillRect(c.x + 6, c.y + 6, c.w - 12, 8);
        ctx.fillStyle = '#4a3520';
        ctx.fillRect(c.x + 8, c.y + c.h - 12, c.w - 16, 4);
      } else if (c.kind === 'pillar') {
        ctx.fillStyle = '#4a5468';
        ctx.beginPath();
        ctx.arc(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#67738a';
        ctx.beginPath();
        ctx.arc(c.x + c.w / 2, c.y + c.h / 2, c.w / 2 - 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (c.kind === 'planter') {
        ctx.fillStyle = '#2e4d33';
        roundRect(ctx, c.x, c.y, c.w, c.h, 6);
        ctx.fill();
        ctx.fillStyle = '#4c8a54';
        ctx.beginPath();
        ctx.arc(c.x + c.w / 2, c.y + c.h / 2 - 4, 10, 0, Math.PI * 2);
        ctx.fill();
      } else if (c.kind === 'case') {
        // Glass display case: pale frame, bright contents.
        ctx.fillStyle = '#7a8aa5';
        roundRect(ctx, c.x, c.y, c.w, c.h, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(190,220,255,0.55)';
        ctx.fillRect(c.x + 4, c.y + 4, c.w - 8, c.h - 8);
        ctx.fillStyle = '#ffd34d';
        ctx.beginPath();
        ctx.arc(c.x + c.w / 2, c.y + c.h / 2, 7, 0, Math.PI * 2);
        ctx.fill();
      } else if (c.kind === 'ac') {
        // Rooftop air-conditioning unit.
        ctx.fillStyle = '#5a6474';
        roundRect(ctx, c.x, c.y, c.w, c.h, 6);
        ctx.fill();
        ctx.fillStyle = '#39404d';
        ctx.beginPath();
        ctx.arc(c.x + c.w / 2, c.y + c.h / 2, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#8a94a8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.x + c.w / 2, c.y + c.h / 2, 9, 0, Math.PI * 2);
        ctx.stroke();
      } else if (c.kind === 'vent') {
        ctx.fillStyle = '#4a5468';
        roundRect(ctx, c.x, c.y, c.w, c.h, 4);
        ctx.fill();
        ctx.strokeStyle = '#67738a';
        ctx.lineWidth = 2;
        for (let i = 1; i < 4; i += 1) {
          ctx.beginPath();
          ctx.moveTo(c.x + 8, c.y + (c.h / 4) * i);
          ctx.lineTo(c.x + c.w - 8, c.y + (c.h / 4) * i);
          ctx.stroke();
        }
      } else {
        // Vault: brushed steel with a gold stripe.
        ctx.fillStyle = '#5a6474';
        roundRect(ctx, c.x, c.y, c.w, c.h, 6);
        ctx.fill();
        ctx.fillStyle = '#ffd34d';
        ctx.fillRect(c.x, c.y + c.h / 2 - 3, c.w, 6);
        ctx.fillStyle = '#39404d';
        ctx.beginPath();
        ctx.arc(c.x + c.w / 2, c.y + c.h / 2, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Keycard doors: red slabs while locked, an open gap once the card is lifted.
    for (const d of state.doors) {
      if (d.open) continue;
      ctx.fillStyle = '#7a1f1f';
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.fillStyle = '#ff5a5a';
      ctx.fillRect(d.x + 2, d.y + 2, d.w - 4, 4);
      ctx.fillStyle = '#ffd7d7';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('KEYCARD', d.x + d.w / 2, d.y + d.h + 12);
    }
  }

  function drawWalls(state) {
    for (const w of state.level.walls) {
      ctx.fillStyle = '#3d4a63';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = '#5a6a86';
      if (w.h <= 16) ctx.fillRect(w.x, w.y + w.h - 4, w.w, 4);
      else if (w.w <= 24) ctx.fillRect(w.x + w.w - 4, w.y, 4, w.h);
    }
  }

  function drawLasers(state) {
    for (const l of state.lasers) {
      const active = laserActive(l, state.clock, state.empTimer);
      const alpha = active ? 0.9 : 0.18;
      ctx.strokeStyle = `rgba(255,60,80,${alpha})`;
      ctx.lineWidth = active ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
      if (active) {
        ctx.strokeStyle = 'rgba(255,120,130,0.35)';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
      }
      // Emitters at both ends.
      for (const [ex, ey] of [[l.x1, l.y1], [l.x2, l.y2]]) {
        ctx.fillStyle = active ? '#ff3c50' : '#5a2a30';
        ctx.beginPath();
        ctx.arc(ex, ey, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawCones(state) {
    // Cameras first (cool blue, dark while the EMP lasts), then guards
    // (amber; red while the alarm is up).
    for (const c of state.cameras) {
      if (state.empTimer > 0) continue;
      ctx.fillStyle = 'rgba(120,180,255,0.20)';
      conePolygon(ctx, c.x, c.y, c.angle, CAMERA.range, CAMERA.halfAngle, state.blockers);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,200,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (const g of state.guards) {
      let fill = 'rgba(245,166,35,0.26)';
      let stroke = 'rgba(245,166,35,0.55)';
      if (state.alarm || g.state === 'chase') {
        fill = 'rgba(255,60,60,0.34)';
        stroke = 'rgba(255,80,80,0.7)';
      } else if (g.state === 'investigate' || g.state === 'look') {
        fill = 'rgba(255,140,40,0.32)';
        stroke = 'rgba(255,140,40,0.65)';
      }
      ctx.fillStyle = fill;
      conePolygon(ctx, g.x, g.y, g.angle, GUARD.range, GUARD.halfAngle, state.blockers);
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawActors(state) {
    // Cameras: wall boxes with a lens (dark while the EMP lasts).
    for (const c of state.cameras) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      ctx.fillStyle = '#222a3a';
      ctx.fillRect(-4, -8, 16, 16);
      ctx.fillStyle = state.empTimer > 0 ? '#39404d' : '#9ec8ff';
      ctx.beginPath();
      ctx.arc(12, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Guards: amber bodies, a nose for facing, "!" when suspicious, "!!" on the hunt,
    // "?" while the meter is high and a guard has eyes on the thief.
    for (const g of state.guards) {
      ctx.fillStyle = state.alarm || g.state === 'chase' ? '#e5484d' : '#f5a623';
      ctx.beginPath();
      ctx.arc(g.x, g.y, GUARD.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b2334';
      ctx.beginPath();
      ctx.arc(g.x + Math.cos(g.angle) * 6, g.y + Math.sin(g.angle) * 6, 4, 0, Math.PI * 2);
      ctx.fill();
      if (g.state === 'investigate' || g.state === 'look') {
        ctx.fillStyle = '#ffd34d';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', g.x, g.y - 18);
      } else if (g.state === 'chase' || state.alarm) {
        ctx.fillStyle = '#ff5a5a';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!!', g.x, g.y - 18);
      } else if (state.detection >= 40) {
        const v = canSee(g.x, g.y, g.angle, GUARD.range, GUARD.halfAngle, state.player.x, state.player.y, state.blockers);
        if (v.seen) {
          ctx.fillStyle = '#ffe9a8';
          ctx.font = 'bold 16px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('?', g.x, g.y - 18);
        }
      }
    }
    // Smoke clouds.
    for (const s of state.smokes) {
      const fade = Math.min(1, s.t / 1.5);
      ctx.fillStyle = `rgba(160,170,190,${0.5 * fade})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, GADGETS.smokeRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(200,210,225,${0.35 * fade})`;
      ctx.beginPath();
      ctx.arc(s.x - 30, s.y - 18, 42, 0, Math.PI * 2);
      ctx.arc(s.x + 34, s.y + 14, 46, 0, Math.PI * 2);
      ctx.fill();
    }
    // The flying coin.
    if (state.coin) {
      const c = state.coin;
      const k = Math.min(1, c.t / 0.35);
      const x = c.x0 + (c.x1 - c.x0) * k;
      const y = c.y0 + (c.y1 - c.y0) * k - Math.sin(k * Math.PI) * 26;
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,211,77,0.5)';
      ctx.beginPath();
      ctx.arc(c.x1, c.y1, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    // The thief, Rook: teal, with a facing wedge; crouched he hugs the floor.
    const p = state.player;
    if (state.mode !== 'title' || p.invuln > 0) {
      const blink = p.invuln > 0 && Math.floor(state.clock * 10) % 2 === 0;
      if (!blink) {
        ctx.fillStyle = '#35e0c8';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.crouch ? 9 : PLAYER.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0b2e2a';
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(p.angle) * 12, p.y + Math.sin(p.angle) * 12);
        ctx.lineTo(p.x + Math.cos(p.angle + 2.5) * 7, p.y + Math.sin(p.angle + 2.5) * 7);
        ctx.lineTo(p.x + Math.cos(p.angle - 2.5) * 7, p.y + Math.sin(p.angle - 2.5) * 7);
        ctx.closePath();
        ctx.fill();
        if (p.crouch) {
          ctx.strokeStyle = 'rgba(53,224,200,0.7)';
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
    // Spawn marker: the way in.
    ctx.fillStyle = 'rgba(53,224,200,0.35)';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('IN', state.level.spawn.x, state.level.spawn.y + 26);
  }

  function drawMinimap(state) {
    const mw = 172;
    const mh = 108;
    const mx = FIELD.width - mw - 10;
    const my = FIELD.height - mh - 10;
    const sx = mw / FIELD.width;
    const sy = mh / FIELD.height;
    ctx.fillStyle = 'rgba(8,12,22,0.78)';
    roundRect(ctx, mx - 4, my - 4, mw + 8, mh + 8, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,211,77,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    for (const w of state.level.walls) {
      ctx.fillStyle = '#5a6a86';
      ctx.fillRect(mx + w.x * sx, my + w.y * sy, Math.max(1, w.w * sx), Math.max(1, w.h * sy));
    }
    for (const c of state.level.cover) {
      ctx.fillStyle = '#39404d';
      ctx.fillRect(mx + c.x * sx, my + c.y * sy, Math.max(1, c.w * sx), Math.max(1, c.h * sy));
    }
    const e = state.level.exit;
    ctx.fillStyle = state.exitOpen ? '#37d67a' : '#c05a5a';
    ctx.fillRect(mx + e.x * sx, my + e.y * sy, e.w * sx, Math.max(2, e.h * sy));
    for (const l of [...state.loot, ...state.bonus]) {
      if (l.taken) continue;
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.arc(mx + l.x * sx, my + l.y * sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const g of state.guards) {
      ctx.fillStyle = state.alarm ? '#ff5a5a' : '#f5a623';
      ctx.beginPath();
      ctx.arc(mx + g.x * sx, my + g.y * sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const c of state.cameras) {
      ctx.fillStyle = '#9ec8ff';
      ctx.beginPath();
      ctx.arc(mx + c.x * sx, my + c.y * sy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = state.player;
    ctx.fillStyle = '#35e0c8';
    ctx.beginPath();
    ctx.arc(mx + p.x * sx, my + p.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0b2e2a';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(8,12,22,0.82)';
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,211,77,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function tutorialHint(state) {
    if (state.floorIndex === 0) {
      if (state.floorTime < 6) return 'WASD to move — stay out of the amber cones';
      if (state.floorTime < 12) return 'Hold C to crouch: slower, but detection crawls';
      if (state.floorTime < 18) return 'Click anywhere to toss a coin and pull a guard away';
      if (state.floorTime < 24) return 'Dark floor is shadow — hide in it while a cone sweeps past';
      return '';
    }
    if (state.floorIndex === 2 && state.floorTime < 8) {
      return 'Red lasers blink on and off — cross only while they are dark, or EMP them (key 2)';
    }
    if (state.floorIndex === 3 && state.floorTime < 8) {
      return 'The red keycard opens the vault door. Press E beside a safe to crack it';
    }
    if (state.floorIndex === 4 && state.floorTime < 8) {
      return 'Last floor — lift the Crown and reach the helipad';
    }
    return '';
  }

  function drawCrackDial(state) {
    const c = state.cracking;
    if (!c) return;
    const cx = FIELD.width / 2;
    const cy = 120;
    const w = 420;
    const h = 34;
    panel(cx - w / 2 - 14, cy - 52, w + 28, 118);
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${c.safe.name} — stop the needle in the green!`, cx, cy - 30);
    ctx.fillStyle = '#1b2334';
    roundRect(ctx, cx - w / 2, cy - 12, w, h, 8);
    ctx.fill();
    ctx.fillStyle = '#37d67a';
    ctx.fillRect(cx - w / 2 + c.zone * w, cy - 12, SAFE.zoneWidth * w, h);
    ctx.fillStyle = '#ff5a5a';
    ctx.fillRect(cx - w / 2 + c.needle * w - 2, cy - 18, 4, h + 12);
    ctx.fillStyle = '#e8eefc';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(`Hits ${c.hits}/${SAFE.hitsToOpen} — press E to lock the tumbler`, cx, cy + 38);
  }

  function drawOverlay(state, screen, best) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(8,12,22,0.42)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      ctx.fillStyle = '#ffd34d';
      ctx.font = 'bold 54px system-ui, sans-serif';
      ctx.fillText('MERIDIAN VAULT II', FIELD.width / 2, 140);
      ctx.fillStyle = '#35e0c8';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('THE GRAND TAKE', FIELD.width / 2, 172);
      ctx.fillStyle = '#e8eefc';
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillText('You are Rook. Five floors. Sixteen pieces of loot. One way out.', FIELD.width / 2, 210);
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillStyle = '#9fb0cc';
      ctx.fillText('WASD / arrows — move      Shift — sprint (loud)      C — crouch (quiet, slow)', FIELD.width / 2, 256);
      ctx.fillText('Click — toss a coin      2 — EMP      3 — smoke      E — crack a safe', FIELD.width / 2, 282);
      ctx.fillText('Lasers blink — cross them dark. A keycard opens the vault door.', FIELD.width / 2, 308);
      ctx.fillStyle = '#ffd34d';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('Lift all the loot, then reach the green EXIT. Do not get caught.', FIELD.width / 2, 348);
      ctx.fillStyle = '#35e0c8';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText('Press SPACE or click to start', FIELD.width / 2, 396);
      if (best > 0) {
        ctx.fillStyle = '#9fb0cc';
        ctx.font = '15px system-ui, sans-serif';
        ctx.fillText(`Best score: ${best}`, FIELD.width / 2, 436);
      }
    } else if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(8,12,22,0.6)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      panel(FIELD.width / 2 - 190, 220, 380, 130);
      ctx.fillStyle = '#e8eefc';
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillText('PAUSED', FIELD.width / 2, 262);
      ctx.fillStyle = '#9fb0cc';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText('P or Space to keep moving', FIELD.width / 2, 306);
    } else if (state.mode === 'floorclear') {
      panel(FIELD.width / 2 - 230, 240, 460, 110);
      ctx.fillStyle = '#37d67a';
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillText('FLOOR CLEAR', FIELD.width / 2, 272);
      ctx.fillStyle = '#e8eefc';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(state.message, FIELD.width / 2, 312);
    } else if (screen === SCREEN_SHOP || state.mode === 'shop') {
      ctx.fillStyle = 'rgba(8,12,22,0.66)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      panel(FIELD.width / 2 - 280, 130, 560, 330);
      ctx.fillStyle = '#ffd34d';
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillText('BLACK MARKET', FIELD.width / 2, 168);
      ctx.fillStyle = '#e8eefc';
      ctx.font = '17px system-ui, sans-serif';
      ctx.fillText(`Score ${state.score} — spend it before the next floor`, FIELD.width / 2, 200);
      const rows = [
        ['1', 'EMP charge — kills cameras and lasers for 8s', SHOP.emp, `own ${state.gadgets.emp}`],
        ['2', 'Smoke bomb — a cloud no watcher sees through', SHOP.smoke, `own ${state.gadgets.smoke}`],
        ['3', 'Extra life', SHOP.life, `${state.lives}/${SHOP.maxLives} lives`],
        ['4', `+${SHOP.coinsPack} coins to toss`, SHOP.coins, `${state.coins} coins`],
      ];
      ctx.textAlign = 'left';
      rows.forEach(([key, name, price, own], i) => {
        const y = 238 + i * 38;
        const afford = state.score >= price;
        ctx.fillStyle = afford ? '#e8eefc' : '#5a6a86';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.fillText(`[${key}]`, FIELD.width / 2 - 250, y);
        ctx.font = '16px system-ui, sans-serif';
        ctx.fillText(name, FIELD.width / 2 - 210, y);
        ctx.fillStyle = afford ? '#ffd34d' : '#5a6a86';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${price}`, FIELD.width / 2 + 170, y);
        ctx.fillStyle = '#9fb0cc';
        ctx.font = '14px system-ui, sans-serif';
        ctx.fillText(own, FIELD.width / 2 + 250, y);
        ctx.textAlign = 'left';
      });
      ctx.textAlign = 'center';
      ctx.fillStyle = '#35e0c8';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('Press SPACE to move on to the next floor', FIELD.width / 2, 404);
      if (state.messageTimer > 0) {
        ctx.fillStyle = '#ffe9a8';
        ctx.font = '15px system-ui, sans-serif';
        ctx.fillText(state.message, FIELD.width / 2, 432);
      }
    } else if (state.mode === 'win') {
      ctx.fillStyle = 'rgba(8,12,22,0.62)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      panel(FIELD.width / 2 - 260, 120, 520, 320);
      const grade = gradeRun(state.stats);
      ctx.fillStyle = grade === 'S' ? '#ffd34d' : grade === 'A' ? '#37d67a' : grade === 'B' ? '#9ec8ff' : '#ff8a8a';
      ctx.font = 'bold 64px system-ui, sans-serif';
      ctx.fillText(`GRADE ${grade}`, FIELD.width / 2, 180);
      ctx.fillStyle = '#ffd34d';
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillText('THE VAULT IS YOURS', FIELD.width / 2, 232);
      ctx.fillStyle = '#e8eefc';
      ctx.font = '19px system-ui, sans-serif';
      ctx.fillText(`Score ${state.score}   •   Time ${formatTime(state.time)}`, FIELD.width / 2, 272);
      ctx.fillText(`Loot ${state.stats.loot}/${state.totalLoot}   •   Safes cracked ${state.stats.safes}`, FIELD.width / 2, 302);
      ctx.fillText(`Alarms ${state.stats.alarms}   •   Caught ${state.stats.caught}x`, FIELD.width / 2, 332);
      ctx.fillStyle = state.stats.alarms === 0 ? '#37d67a' : '#9fb0cc';
      ctx.font = '17px system-ui, sans-serif';
      ctx.fillText(
        state.stats.alarms === 0 ? 'A perfect ghost run. No alarm, ever.' : 'Rook walks out into the night.',
        FIELD.width / 2, 368,
      );
      ctx.fillStyle = '#35e0c8';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('Press SPACE to run it again', FIELD.width / 2, 408);
    } else if (state.mode === 'over') {
      ctx.fillStyle = 'rgba(20,6,8,0.66)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      panel(FIELD.width / 2 - 240, 190, 480, 200);
      ctx.fillStyle = '#ff5a5a';
      ctx.font = 'bold 36px system-ui, sans-serif';
      ctx.fillText('CAUGHT', FIELD.width / 2, 240);
      ctx.fillStyle = '#e8eefc';
      ctx.font = '19px system-ui, sans-serif';
      ctx.fillText(`Score ${state.score}   •   Loot ${state.stats.loot}/${state.totalLoot}`, FIELD.width / 2, 288);
      ctx.fillStyle = '#9fb0cc';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(`Reached ${state.level.name}`, FIELD.width / 2, 316);
      ctx.fillStyle = '#35e0c8';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('Press SPACE to try again', FIELD.width / 2, 352);
    }
    // The safe-crack dial, over the play screen.
    if (state.cracking && screen === SCREEN_PLAY) drawCrackDial(state);
    // Tutorial hints, just above the spoken line.
    const hint = screen === SCREEN_PLAY && state.mode === 'play' ? tutorialHint(state) : '';
    if (hint) {
      ctx.fillStyle = 'rgba(8,12,22,0.75)';
      const w = ctx.measureText(hint).width + 28;
      roundRect(ctx, FIELD.width / 2 - w / 2, FIELD.height - 78, w, 26, 8);
      ctx.fill();
      ctx.fillStyle = '#9ec8ff';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(hint, FIELD.width / 2, FIELD.height - 64);
    }
    // The spoken line: what just happened, bottom centre.
    if (state.messageTimer > 0 && screen === SCREEN_PLAY) {
      ctx.fillStyle = 'rgba(8,12,22,0.75)';
      const w = ctx.measureText(state.message).width + 28;
      roundRect(ctx, FIELD.width / 2 - w / 2, FIELD.height - 44, w, 28, 8);
      ctx.fill();
      ctx.fillStyle = state.alarm ? '#ff8a8a' : '#ffe9a8';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(state.message, FIELD.width / 2, FIELD.height - 29);
    }
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function draw(state, screen, best) {
    ctx.clearRect(0, 0, FIELD.width, FIELD.height);
    drawFloor(state);
    drawCover(state);
    drawWalls(state);
    drawLasers(state);
    drawCones(state);
    drawActors(state);
    if (screen === SCREEN_PLAY && state.mode === 'play') drawMinimap(state);
    drawOverlay(state, screen, best);
    updateHud(state, best);
  }

  function updateHud(state, best) {
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('hud-floor', state.level.name);
    set('hud-loot', `Loot ${state.lootTaken}/${state.loot.length}`);
    set('hud-coins', `Coins ${state.coins}`);
    set('hud-emp', `EMP ${state.gadgets.emp}${state.empTimer > 0 ? ` (${Math.ceil(state.empTimer)}s)` : ''}`);
    set('hud-smoke', `Smoke ${state.gadgets.smoke}`);
    set('hud-lives', '♥'.repeat(Math.max(0, state.lives)) + '♡'.repeat(Math.max(0, LIVES - state.lives)));
    set('hud-score', `Score ${state.score}`);
    set('hud-time', formatTime(state.time));
    set('hud-best', `Best ${best}`);
    const fill = document.getElementById('hud-alarm-fill');
    const label = document.getElementById('hud-alarm-label');
    if (fill) {
      fill.style.width = `${Math.round(state.detection)}%`;
      fill.style.background = state.alarm
        ? '#e5484d'
        : state.detection >= 75 ? '#e5484d' : state.detection >= 40 ? '#f5a623' : '#37d67a';
    }
    if (label) label.textContent = state.alarm ? 'ALARM!' : `ALARM ${Math.round(state.detection)}%`;
  }

  return { draw, updateHud };
}
