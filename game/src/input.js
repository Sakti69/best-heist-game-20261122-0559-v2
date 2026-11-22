// Meridian Vault II: keyboard + mouse. WASD/arrows move, Shift sprints, C crouches,
// a click tosses a coin at the clicked floor point, Space/Enter confirms, P pauses, M mutes.
// 2 fires the EMP, 3 drops smoke, E cracks a safe or locks a tumbler;
// in the shop, 1-4 buy and Space moves on.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_EMP = 8;
export const ACTION_SMOKE = 16;
export const ACTION_INTERACT = 32;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let coinTarget = null;
  let digit = null;

  function keyCode(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(keyCode(event));
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
    if (event.code === 'Digit2') actions |= ACTION_EMP;
    if (event.code === 'Digit3') actions |= ACTION_SMOKE;
    if (event.code === 'KeyE') actions |= ACTION_INTERACT;
    if (/^Digit[1-4]$/.test(event.code)) digit = Number(event.code.slice(5));
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(keyCode(event));
  });
  window.addEventListener('blur', () => {
    keys.clear();
  });

  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    coinTarget = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
    // A click on the title / end screens also confirms.
    actions |= ACTION_CONFIRM;
  });

  function direction() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    return { x, y };
  }

  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  function takeDigit() {
    const taken = digit;
    digit = null;
    return taken;
  }

  function takeCoin() {
    const target = coinTarget;
    coinTarget = null;
    return target;
  }

  function state() {
    const d = direction();
    return {
      x: d.x,
      y: d.y,
      sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      crouch: keys.has('KeyC') || keys.has('ControlLeft') || keys.has('ControlRight'),
      coin: takeCoin(),
    };
  }

  return { takeActions, takeDigit, state };
}
