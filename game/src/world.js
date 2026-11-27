// The game's rules and state, with no drawing and no browser in it: the turkey, the
// farmer's pursuit, the scrolling farm, the obstacles, the hiding haystacks and the
// collectibles, the four stages and the two endings. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react (sound, screens) without the
// world knowing about screens or sound. Nothing here allocates after createWorld returns.

import {
  FIELD, HAYSTACK, KNIFE, LIVES, OBSTACLE, PLAYER, POOL_SIZE, PX_PER_M,
  RUN_LENGTH_M, SPEEDS, SPAWN, STAGES, TURKEY_X, FARMER_SPEED,
} from './config.js';

export const KIND_FENCE = 0;
export const KIND_HAY = 1;
export const KIND_OVEN = 2;
export const KIND_KNIFE = 3;
export const KIND_CORN = 4;
export const KIND_PUMPKIN = 5;
export const KIND_FEATHER = 6;

export const EVENT_HIT = 1;
export const EVENT_PICKUP = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_ESCAPED = 8;
export const EVENT_STAGE = 16;
export const EVENT_HIDE = 32;
export const EVENT_POPOUT = 64;
export const EVENT_KNIFE = 128;

/** A forgiving overlap test: both boxes shrink a little, so near misses feel fair. */
function overlaps(a, b, shrinkA, shrinkB) {
  return a.x + shrinkA < b.x + b.width - shrinkB && a.x + a.width - shrinkA > b.x + shrinkB
    && a.y + shrinkA < b.y + b.height - shrinkB && a.y + a.height - shrinkA > b.y + shrinkB;
}

export function createWorld(random) {
  const turkey = {
    x: TURKEY_X, y: FIELD.groundY - PLAYER.height, width: PLAYER.width, height: PLAYER.height,
    vy: 0, onGround: true, coyote: 0, jumpBuffer: 0, invulnerable: 0,
    hiding: false, hideTimer: 0, runCycle: 0,
  };
  const obstacles = [];
  const pickups = [];
  const haystacks = [];
  for (let index = 0; index < POOL_SIZE; index += 1) {
    obstacles.push({ active: false, kind: KIND_FENCE, x: 0, y: 0, width: 0, height: 0, state: '', timer: 0, vy: 0 });
    pickups.push({ active: false, kind: KIND_CORN, x: 0, y: 0, width: 0, height: 0, bob: 0 });
    haystacks.push({ active: false, x: 0, width: HAYSTACK.width, height: HAYSTACK.height });
  }
  const state = {
    turkey, obstacles, pickups, haystacks,
    gap: 0.75, lives: LIVES, bonus: 0, distanceM: 0, elapsed: 0,
    stageIndex: 0, spawnTimer: 0.8, stumbleTimer: 0, speed: SPEEDS.normal,
    /** Scrolled pixels in all, title backdrop included: the renderer parallaxes on this. */
    scrollPx: 0,
  };

  /** The score: every metre run, plus what the turkey grabbed. */
  function score() {
    return Math.floor(state.distanceM) + state.bonus;
  }

  function reset() {
    turkey.y = FIELD.groundY - PLAYER.height;
    turkey.vy = 0;
    turkey.onGround = true;
    turkey.coyote = 0;
    turkey.jumpBuffer = 0;
    turkey.invulnerable = 0;
    turkey.hiding = false;
    turkey.hideTimer = 0;
    turkey.runCycle = 0;
    for (const item of obstacles) item.active = false;
    for (const item of pickups) item.active = false;
    for (const item of haystacks) item.active = false;
    state.gap = 0.75;
    state.lives = LIVES;
    state.bonus = 0;
    state.distanceM = 0;
    state.elapsed = 0;
    state.stageIndex = 0;
    state.spawnTimer = 0.8;
    state.stumbleTimer = 0;
    state.speed = SPEEDS.normal;
    state.scrollPx = 0;
  }

  function stage() {
    return STAGES[state.stageIndex];
  }

  function freeSlot(pool) {
    for (let index = 0; index < pool.length; index += 1) if (!pool[index].active) return pool[index];
    return null;
  }

  /** The nearest thing still on screen to the right; spawning waits until it has room. */
  function rightmostX(pool) {
    let rightmost = -Infinity;
    for (const item of pool) if (item.active && item.x > rightmost) rightmost = item.x;
    return rightmost;
  }

  function spawnObstacle(kind) {
    const item = freeSlot(obstacles);
    if (item === null) return;
    const spec = kind === KIND_FENCE ? OBSTACLE.fence : kind === KIND_HAY ? OBSTACLE.hay : OBSTACLE.oven;
    item.active = true;
    item.kind = kind;
    item.width = spec.width;
    item.height = spec.height;
    item.x = FIELD.width + 40;
    item.y = FIELD.groundY - spec.height;
    item.state = '';
    item.timer = 0;
    item.vy = 0;
  }

  function spawnKnife() {
    const item = freeSlot(obstacles);
    if (item === null) return;
    item.active = true;
    item.kind = KIND_KNIFE;
    item.width = KNIFE.width;
    item.height = KNIFE.height;
    item.x = FIELD.width + 40;
    item.y = 110;
    item.state = 'hanging';
    item.timer = 0;
    item.vy = 0;
  }

  function spawnPickup(kind, x, y) {
    const item = freeSlot(pickups);
    if (item === null) return;
    item.active = true;
    item.kind = kind;
    item.x = x;
    item.y = y;
    item.width = kind === KIND_CORN ? 26 : kind === KIND_PUMPKIN ? 40 : 30;
    item.height = kind === KIND_CORN ? 26 : kind === KIND_PUMPKIN ? 34 : 30;
    item.bob = random() * Math.PI * 2;
  }

  /** A row of corn to run through, sometimes arced so a jump grabs the high ones. */
  function spawnCornRow() {
    const arced = random() < 0.4;
    for (let index = 0; index < 3; index += 1) {
      const lift = arced ? Math.sin((index / 2) * Math.PI) * 90 : 0;
      spawnPickup(KIND_CORN, FIELD.width + 40 + index * 52, FIELD.groundY - 26 - lift);
    }
  }

  function spawnHaystack() {
    const stack = freeSlot(haystacks);
    if (stack === null) return;
    if (rightmostX(obstacles) > FIELD.width - 320) return;
    stack.active = true;
    stack.x = FIELD.width + 40;
  }

  /** Pick the next thing the farm throws at the turkey, weighted by the stage. The weights
   *  are normalized, so the oven's growing share in the kitchen eats into the other shares
   *  instead of pushing the total past one. */
  function spawnNext() {
    const ovenWeight = state.stageIndex === 0 ? 0 : state.stageIndex === 1 ? 0.1 : state.stageIndex === 2 ? 0.24 : 0.14;
    const weights = [
      [0.26, () => spawnObstacle(KIND_FENCE)],
      [0.18, () => spawnObstacle(KIND_HAY)],
      [ovenWeight, () => spawnObstacle(KIND_OVEN)],
      [0.16, () => spawnKnife()],
      [0.18, () => spawnCornRow()],
      [0.04, () => spawnPickup(KIND_PUMPKIN, FIELD.width + 40, FIELD.groundY - 34)],
      [0.04, () => spawnPickup(KIND_FEATHER, FIELD.width + 40, FIELD.groundY - 120)],
      [0.14, () => spawnHaystack()],
    ];
    let total = 0;
    for (const [weight] of weights) total += weight;
    let roll = random() * total;
    for (const [weight, spawn] of weights) {
      roll -= weight;
      if (roll <= 0) {
        spawn();
        break;
      }
    }
    state.spawnTimer = (SPAWN.interval + random() * SPAWN.intervalJitter) * stage().spawn;
  }

  /** The haystack the turkey stands in front of, if any. */
  function nearbyHaystack() {
    for (const stack of haystacks) {
      if (!stack.active) continue;
      if (turkey.x + turkey.width > stack.x - 10 && turkey.x < stack.x + stack.width + 10) return stack;
    }
    return null;
  }

  /**
   * One fixed step. `input` is { speed: 'slow'|'normal'|'fast', jump: boolean, hide: boolean }.
   * With `harmless` set (the title screen's backdrop) the farm scrolls and the turkey runs on
   * its own, but nothing scores, nothing hurts it and the farmer never catches it.
   */
  function step(dt, input, harmless) {
    let events = 0;
    state.elapsed += dt;
    const currentStage = stage();
    const speed = harmless
      ? SPEEDS.normal * currentStage.speed
      : state.stumbleTimer > 0
        ? SPEEDS.slow * currentStage.speed
        : SPEEDS[input.speed] * currentStage.speed;
    state.speed = speed;
    if (state.stumbleTimer > 0) state.stumbleTimer = Math.max(0, state.stumbleTimer - dt);

    // The farmer's gap: a sprint opens it, dawdling closes it, hiding loses the trail.
    // It stays between 0 (caught) and 1 (a clean getaway), so a long sprint never banks
    // an invisible lead.
    if (!harmless) {
      if (turkey.hiding) state.gap = Math.min(1, state.gap + 0.1 * dt);
      else state.gap = Math.min(1, state.gap + ((speed - FARMER_SPEED * currentStage.speed) * dt) / 1000);
    }

    if (!harmless) {
      state.distanceM += (speed * dt) / PX_PER_M;
      turkey.runCycle += dt * (speed / 40);
    } else {
      turkey.runCycle += dt * 7;
    }
    state.scrollPx += speed * dt;

    // Hiding: duck into a haystack while the farmer passes, then pop back out.
    if (!harmless && input.hide && !turkey.hiding && turkey.onGround && nearbyHaystack() !== null) {
      turkey.hiding = true;
      turkey.hideTimer = HAYSTACK.hideSeconds;
      events |= EVENT_HIDE;
    }
    if (turkey.hiding) {
      turkey.hideTimer -= dt;
      if (turkey.hideTimer <= 0 || input.jump) {
        turkey.hiding = false;
        turkey.vy = -320;
        turkey.onGround = false;
        events |= EVENT_POPOUT;
      }
    }

    // Jump: buffered, with a little coyote time so late presses still count.
    if (input.jump) turkey.jumpBuffer = PLAYER.buffer;
    if (turkey.jumpBuffer > 0) turkey.jumpBuffer = Math.max(0, turkey.jumpBuffer - dt);
    if (!turkey.hiding && turkey.jumpBuffer > 0 && (turkey.onGround || turkey.coyote > 0)) {
      turkey.vy = -PLAYER.jumpVelocity;
      turkey.onGround = false;
      turkey.coyote = 0;
      turkey.jumpBuffer = 0;
    }
    if (harmless && turkey.onGround) {
      // The title turkey jumps its own fences, so the backdrop stays lively.
      for (const item of obstacles) {
        if (item.active && item.kind !== KIND_KNIFE && item.x > turkey.x && item.x - turkey.x < 170) {
          turkey.vy = -PLAYER.jumpVelocity;
          turkey.onGround = false;
          break;
        }
      }
    }
    turkey.vy += PLAYER.gravity * dt;
    turkey.y += turkey.vy * dt;
    if (turkey.y >= FIELD.groundY - turkey.height) {
      turkey.y = FIELD.groundY - turkey.height;
      turkey.vy = 0;
      if (!turkey.onGround) turkey.onGround = true;
      turkey.coyote = PLAYER.coyote;
    } else if (turkey.onGround) {
      turkey.onGround = false;
    }
    if (turkey.coyote > 0) turkey.coyote = Math.max(0, turkey.coyote - dt);
    if (turkey.invulnerable > 0) turkey.invulnerable = Math.max(0, turkey.invulnerable - dt);

    // Spawning.
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      const nearest = Math.max(rightmostX(obstacles), rightmostX(pickups), rightmostX(haystacks));
      if (nearest < FIELD.width - SPAWN.minGapPx) spawnNext();
      else state.spawnTimer = 0.15;
    }

    // Obstacles scroll in, knives notice the turkey, drop and stick.
    for (const item of obstacles) {
      if (!item.active) continue;
      item.x -= speed * dt;
      if (item.x + item.width < -40) {
        item.active = false;
        continue;
      }
      if (item.kind === KIND_KNIFE) {
        if (item.state === 'hanging') {
          const ahead = item.x - (turkey.x + turkey.width);
          if (!harmless && ahead < KNIFE.triggerRange && ahead > -40) {
            item.state = 'telegraph';
            item.timer = KNIFE.telegraph;
          }
        } else if (item.state === 'telegraph') {
          item.timer -= dt;
          if (item.timer <= 0) {
            item.state = 'falling';
            item.vy = KNIFE.fallSpeed;
            events |= EVENT_KNIFE;
          }
        } else if (item.state === 'falling') {
          item.y += item.vy * dt;
          if (item.y >= FIELD.groundY - KNIFE.stuckHeight) {
            item.y = FIELD.groundY - KNIFE.stuckHeight;
            item.state = 'stuck';
            item.height = KNIFE.stuckHeight;
          }
        }
      }
      if (harmless || turkey.hiding) continue;
      const hitBox = item.kind === KIND_KNIFE && item.state !== 'stuck'
        ? { x: item.x + 4, y: item.y, width: item.width - 8, height: item.height }
        : { x: item.x + 5, y: item.y + 4, width: item.width - 10, height: item.height - 4 };
      if (turkey.invulnerable === 0 && overlaps(turkey, hitBox, 8, 6)) {
        item.active = false;
        state.lives -= 1;
        state.gap = Math.max(0, state.gap - 0.14);
        turkey.invulnerable = PLAYER.invulnerable;
        state.stumbleTimer = PLAYER.stumbleSlow;
        events |= EVENT_HIT;
        if (state.lives <= 0) events |= EVENT_CAUGHT;
      }
    }

    // Pickups scroll in and are grabbed on the run.
    for (const item of pickups) {
      if (!item.active) continue;
      item.x -= speed * dt;
      item.bob += dt * 3;
      if (item.x + item.width < -40) {
        item.active = false;
        continue;
      }
      if (harmless || turkey.hiding) continue;
      if (overlaps(turkey, item, 4, 4)) {
        item.active = false;
        if (item.kind === KIND_CORN) {
          state.bonus += 10;
          state.gap = Math.min(1, state.gap + 0.06);
        } else if (item.kind === KIND_PUMPKIN) {
          state.bonus += 25;
          state.lives = Math.min(LIVES, state.lives + 1);
        } else {
          state.bonus += 50;
        }
        events |= EVENT_PICKUP;
      }
    }

    // Haystacks scroll in and out.
    for (const stack of haystacks) {
      if (!stack.active) continue;
      stack.x -= speed * dt;
      if (stack.x + stack.width < -40) stack.active = false;
    }

    // Stages turn as the distance grows.
    if (!harmless) {
      while (state.stageIndex < STAGES.length - 1 && state.distanceM >= STAGES[state.stageIndex + 1].from) {
        state.stageIndex += 1;
        events |= EVENT_STAGE;
      }
      if (state.distanceM >= RUN_LENGTH_M) events |= EVENT_ESCAPED;
      if (state.gap <= 0) {
        state.gap = 0;
        events |= EVENT_CAUGHT;
      }
    }
    return events;
  }

  reset();
  return { state, reset, step, score, stage };
}
