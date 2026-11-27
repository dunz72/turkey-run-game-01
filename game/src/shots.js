// The screenshot scenes behind ?shot=start|play|caught|escaped. Each one plays the real
// rules forward from a fresh world for a fixed time, steered by a simple autopilot (sprint
// always, jump whatever is ahead inside its safe window for the real scroll speed, looking
// one obstacle ahead on tight pairs), so the frame is what a real game looks like and the
// same seed always gives the same frame. The caught scene's pilot never jumps, so it is
// caught out as a hurried player is; the escaped scene's pilot runs the whole farm to the
// forest gate.

import { FIELD, KNIFE, SPEEDS, STAGES, STEP } from './config.js';
import { EVENT_CAUGHT, EVENT_ESCAPED, KIND_FENCE, KIND_HAY, KIND_KNIFE, KIND_OVEN } from './world.js';
import { SCREEN_CAUGHT, SCREEN_ESCAPED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 34;
const LIMIT_SECONDS = 600;
/**
 * Jump physics, per obstacle kind. A jump (vy 820, g 1900) keeps the turkey's
 * feet above h px for t in [t1, t2] seconds, so at scroll speed v the turkey
 * clears an obstacle of width w jumped at x in [345 + v*t1, (319 - w) + v*t2]:
 * the feet are already high when the obstacle enters the collision window
 * (x < 345) and still high when it leaves (x <= 319 - w). t1/t2 are the roots
 * of 820t - 950t^2 = h for the clearance height h the kind needs (oven 100,
 * fence 30, hay 40, stuck knife 24). The window moves with the real speed, so
 * the same code clears an oven at a barn sprint and at a forest sprint.
 */
const JUMP = {
  [KIND_OVEN]: { width: 96, t1: 0.147, t2: 0.716 },
  [KIND_FENCE]: { width: 46, t1: 0.038, t2: 0.825 },
  [KIND_HAY]: { width: 72, t1: 0.052, t2: 0.811 },
  [KIND_KNIFE]: { width: 26, t1: 0.030, t2: 0.833 },
};
/** Airtime of one jump, in seconds (2 * 820 / 1900). */
const AIR_TIME = 0.863;

/** The safe jump window for one obstacle of `kind` at scroll speed `v`: the
 *  obstacle's x at the moment of the jump must land inside [lo, hi]. */
function jumpWindow(kind, v) {
  const spec = JUMP[kind];
  return { lo: 345 + v * spec.t1, hi: (319 - spec.width) + v * spec.t2 };
}

/** How long a knife takes to fall from its hang to the ground and stick: it
 *  hangs at y 110 and sticks at groundY - stuckHeight, falling at fallSpeed. */
const KNIFE_FALL_TIME = (FIELD.groundY - KNIFE.stuckHeight - 110) / KNIFE.fallSpeed;

/** The longest time, from now, until every knife that can reach the turkey
 *  before the next jump is over has stuck and stopped falling. A knife kills
 *  a jumping turkey, not a grounded one: while it falls it sweeps down
 *  through the jump arc, and the turkey is airborne for 0.863 s — far longer
 *  than the knife's fall — so a jump started while a knife is about to drop
 *  rises straight into it. Once a knife sticks it is just a low obstacle,
 *  safe to jump. `horizon` is how far ahead the pilot cares about: a knife
 *  that sticks after it cannot threaten this jump, so it is ignored and the
 *  pilot jumps it separately once it is falling or stuck. The old reach
 *  (trigger range plus 0.40 s of scroll) was too short — a knife that will
 *  trigger and fall during the 0.863 s jump can be ~600 px ahead at the
 *  decision moment, so the hold never fired and the trace came out
 *  byte-identical. Returns 0 when no knife threatens the next jump. */
function knifeWait(state, v, horizon) {
  const front = state.turkey.x + state.turkey.width;
  let wait = 0;
  for (const item of state.obstacles) {
    if (!item.active || item.kind !== KIND_KNIFE || item.state === 'stuck') continue;
    // A knife already past the turkey cannot come back for it.
    if (item.x + item.width < state.turkey.x) continue;
    let untilStuck;
    if (item.state === 'falling') {
      untilStuck = Math.max(0, (FIELD.groundY - KNIFE.stuckHeight - item.y) / KNIFE.fallSpeed);
    } else if (item.state === 'telegraph') {
      untilStuck = item.timer + KNIFE_FALL_TIME;
    } else {
      // Hanging: it triggers once its nose is within trigger range, then
      // telegraphs and falls. Only one that can trigger and drop before the
      // horizon can threaten this jump; a farther one is jumped separately.
      const ahead = item.x - front;
      if (ahead > KNIFE.triggerRange + v * horizon) continue;
      untilStuck = Math.max(0, (ahead - KNIFE.triggerRange) / v) + KNIFE.telegraph + KNIFE_FALL_TIME;
    }
    if (untilStuck < horizon && untilStuck > wait) wait = untilStuck;
  }
  return wait;
}

/** The obstacles the pilot must jump, nearest first. A carving knife counts
 *  once it has STUCK, or is about to: a falling knife is run under, never
 *  jumped, while it is still high — the turkey rises into its path — but a
 *  knife within 150 px of sticking (0.1 s at its 1500 px/s fall) is jumped
 *  like a stuck one, because it will be stuck by the time the turkey reaches
 *  it. While a knife hangs or glints it is high above the turkey's head and
 *  the turkey runs straight under it. */
function jumpableObstacles(state) {
  const turkey = state.turkey;
  const stuckY = FIELD.groundY - KNIFE.stuckHeight;
  const list = [];
  for (const item of state.obstacles) {
    if (!item.active) continue;
    if (item.kind === KIND_KNIFE && item.state !== 'stuck' && !(item.state === 'falling' && item.y >= stuckY - 150)) continue;
    const dist = item.x - (turkey.x + turkey.width);
    if (dist >= -20) list.push({ item, dist });
  }
  list.sort((a, b) => a.dist - b.dist);
  return list;
}

/**
 * The skilled pilot: sprint always, and jump whatever is ahead inside its safe
 * window for the real scroll speed. Sprinting opens the farmer's gap instead of
 * bleeding it. The old pilot jumped an oven at a fixed 100 px: at a forest
 * sprint that lands the turkey right on top of the next oven (spawns are at
 * least 320 px apart, one jump carries 446 px), so it died at 1319 m.
 *
 * Look-ahead: when the next obstacle is close behind the first, the pilot jumps
 * the first one early — at the far end of its window — so it lands with the
 * second one still far enough away to jump cleanly. After a jump the turkey is
 * airborne 0.863 s; the second obstacle must still be at or beyond its own
 * window's late edge when the turkey lands and jumps again a step later, with
 * a step of margin. A carving knife is jumped like a fence once it is falling
 * or stuck; while it hangs or glints the turkey runs under it. But a knife
 * that is about to drop onto the jump kills the turkey mid-air, so the pilot
 * holds a jump for a low obstacle until nearby knives have stuck, when the
 * obstacle's window still allows it — and otherwise jumps at the EARLY edge:
 * the late edge only lets the knife fall onto the airborne turkey, while an
 * early jump gets the turkey up and down before the knife's fall reaches the
 * arc. Hiding is never needed while the gap stays full.
 */
function autopilot(state) {
  const turkey = state.turkey;
  const stage = STAGES[state.stageIndex];
  // The speed this step will actually scroll at: a sprint, unless a stumble
  // (from a hit) is still forcing the slow speed.
  const v = (state.stumbleTimer > 0 ? SPEEDS.slow : SPEEDS.fast) * stage.speed;
  const list = jumpableObstacles(state);
  let jump = false;
  if (list.length > 0 && turkey.onGround) {
    const first = list[0];
    const window = jumpWindow(first.item.kind, v);
    // Jump in the middle of the safe window by default.
    let target = (window.lo + window.hi) / 2;
    if (list.length > 1) {
      const second = list[1];
      const gap2 = second.item.x - first.item.x;
      const spec2 = JUMP[second.item.kind];
      // The earliest the first jump may be so the second obstacle is still
      // jumpable after the landing: it must be at or beyond its window's late
      // edge (345 + v*t1) when the turkey lands and jumps again a step later,
      // with one extra step of margin.
      const pairMin = 345 + v * spec2.t1 + 2 * v * STEP + AIR_TIME * v - gap2;
      if (pairMin > target) target = Math.min(window.hi, pairMin);
    }
    // A falling knife kills a jumping turkey, so if one is about to drop onto
    // this jump, hold it until the knife has stuck — provided the obstacle is
    // still jumpable then. If the knife sticks too late to wait for, jump at
    // the EARLY edge instead: delaying to the late edge only gives the knife
    // time to fall onto the airborne turkey, while jumping early gets the
    // turkey up and down before the knife's fall reaches the jump arc. A
    // knife itself is jumped as usual (it is the obstacle).
    if (first.item.kind !== KIND_KNIFE) {
      // How far ahead the pilot cares: a knife that sticks after the turkey
      // could land from the latest possible jump cannot threaten this jump.
      const horizon = (first.item.x - window.lo) / v + AIR_TIME + 0.2;
      const wait = knifeWait(state, v, horizon);
      if (wait > 0) {
        // The obstacle's x when the knives have stuck. Jump then if that is
        // still inside the window (and later than the planned jump); if the
        // knives stick too late to wait for, jump at the early edge instead.
        const atStuck = first.item.x - v * wait;
        if (atStuck >= window.lo + v * STEP && atStuck < target) target = atStuck;
        else if (atStuck < window.lo + v * STEP) target = window.hi;
      }
    }
    // The jump fires on the first step the obstacle reaches the target, so aim
    // a step inside the window's late edge to never jump past it.
    if (target < window.lo + v * STEP) target = window.lo + v * STEP;
    if (first.item.x <= target) jump = true;
  }
  return { speed: 'fast', jump, hide: false };
}

/** The careless pilot: it never jumps, so the farm catches it. */
function carelessPilot() {
  return { speed: 'normal', jump: false, hide: false };
}

/**
 * Set `world` to the named scene (start, play, caught or escaped; any other name is start)
 * and return the screen to draw over it, the best score to show and the score it reached.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'caught' && name !== 'escaped') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { speed: 'normal', jump: false, hide: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0, score: 0 };
  }
  if (name === 'caught') {
    for (let index = 0; index < LIMIT_SECONDS / STEP; index += 1) {
      if (world.step(STEP, carelessPilot(), false) & EVENT_CAUGHT) break;
    }
    return { screen: SCREEN_CAUGHT, best: world.score(), score: world.score() };
  }
  if (name === 'escaped') {
    let caught = false;
    for (let index = 0; index < LIMIT_SECONDS / STEP; index += 1) {
      const events = world.step(STEP, autopilot(world.state), false);
      if (events & EVENT_ESCAPED) break;
      // A run that dies must not ghost on to the gate: stop at the catch.
      if (events & EVENT_CAUGHT) { caught = true; break; }
    }
    return { screen: caught ? SCREEN_CAUGHT : SCREEN_ESCAPED, best: world.score(), score: world.score() };
  }
  let caught = false;
  for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
    if (world.step(STEP, autopilot(world.state), false) & EVENT_CAUGHT) { caught = true; break; }
  }
  return { screen: caught ? SCREEN_CAUGHT : SCREEN_PLAY, best: world.score(), score: world.score() };
}
