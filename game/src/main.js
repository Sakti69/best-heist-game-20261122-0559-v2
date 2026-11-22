// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between five screens: title, play, shop, paused and game over.
//
// ?seed=N fixes the night's sweep phases. ?shot=start|play|alert|win (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_ALARM, EVENT_CAUGHT, EVENT_FLOOR, EVENT_LOOT, EVENT_OVER, EVENT_WIN,
  EVENT_EMP, EVENT_SMOKE, EVENT_SAFE, EVENT_KEYCARD, EVENT_LASER,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_EMP, ACTION_SMOKE,
  ACTION_INTERACT, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_SHOP,
  SCREEN_TITLE,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const world = createWorld(random);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world, random);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each event.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.startGame();
    // Drain the click that started the game, so it does not also toss a coin.
    input.state();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${LIVES} lives. Lift all the loot, then reach the exit.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.stopSiren();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_SHOP) {
      const digit = input.takeDigit();
      if (digit) {
        const before = world.state.score;
        world.buyShop(digit - 1);
        if (world.state.score < before) audio.buy();
        announce(world.state.message);
      }
      if (actions & ACTION_CONFIRM) {
        world.continueShop();
        screen = SCREEN_PLAY;
        announce(`Playing. ${world.state.level.name}.`);
      }
      return;
    }
    if (actions & ACTION_EMP) {
      if (world.useEmp() & EVENT_EMP) audio.emp();
    }
    if (actions & ACTION_SMOKE) {
      if (world.useSmoke() & EVENT_SMOKE) audio.smoke();
    }
    if (actions & ACTION_INTERACT) {
      if (world.pressInteract() & EVENT_SAFE) audio.safe();
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.stopSiren();
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function playSounds(events) {
    if (events & EVENT_LOOT) audio.loot();
    if (events & EVENT_ALARM) audio.alarm();
    if (events & EVENT_CAUGHT) audio.caught();
    if (events & EVENT_FLOOR) audio.floorClear();
    if (events & EVENT_LASER) audio.laser();
    if (events & EVENT_KEYCARD) audio.keycard();
    if (events & EVENT_SAFE) audio.safe();
    if (events & EVENT_WIN) {
      audio.stopSiren();
      audio.win();
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 });
      return;
    }
    if (screen === SCREEN_SHOP) {
      world.step(STEP, { x: 0, y: 0 });
      return;
    }
    const wasAlarm = world.state.alarm;
    const events = world.step(STEP, input.state());
    playSounds(events);
    if (world.state.alarm && !wasAlarm) audio.startSiren();
    if (!world.state.alarm && wasAlarm) audio.stopSiren();
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_CAUGHT) {
      announce(world.state.lives === 1 ? 'Caught. 1 life left.' : `Caught. ${world.state.lives} lives left.`);
    }
    if (world.state.mode === 'win') {
      screen = SCREEN_PLAY; // the win panel draws over the play screen
      if (world.state.score > best) {
        best = world.state.score;
        saveBest(best);
      }
    } else if (world.state.mode === 'shop') {
      screen = SCREEN_SHOP;
      announce('Black market. Spend score, then press Space to move on.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_SHOP) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_SHOP)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.stopSiren();
      announce('Paused.');
    }
  });

  announce('Meridian Vault II. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
