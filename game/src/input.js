// Keyboard and pointer input. Held keys steer (slow, sprint, hide); one-shot presses
// (jump, start or restart, pause, mute) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice. A click is a jump
// while running and a confirm on a menu screen.

export const ACTION_JUMP = 1;
export const ACTION_CONFIRM = 2;
export const ACTION_PAUSE = 4;
export const ACTION_MUTE = 8;

const SLOW = new Set(['ArrowLeft', 'KeyA']);
const FAST = new Set(['ArrowRight', 'KeyD']);
const JUMP = new Set(['ArrowUp', 'KeyW', 'Space']);
const HIDE = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  let slow = false;
  let fast = false;
  let hide = false;
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (SLOW.has(event.code)) slow = true;
    else if (FAST.has(event.code)) fast = true;
    else if (HIDE.has(event.code)) hide = true;
    else if (JUMP.has(event.code)) {
      if (!event.repeat) actions |= ACTION_JUMP | ACTION_CONFIRM;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (SLOW.has(event.code)) slow = false;
    else if (FAST.has(event.code)) fast = false;
    else if (HIDE.has(event.code)) hide = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    slow = false;
    fast = false;
    hide = false;
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_JUMP | ACTION_CONFIRM;
  });

  return {
    /** 'slow', 'fast' or 'normal': the speed the held keys ask for. */
    speed() {
      if (fast && !slow) return 'fast';
      if (slow && !fast) return 'slow';
      return 'normal';
    },
    /** Whether the hide key is held. */
    hiding() {
      return hide;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
