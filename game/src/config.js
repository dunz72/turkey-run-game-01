// Gobble Dash: every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends on
// the screen size. The turkey runs right at a fixed screen x while the world scrolls past.

export const FIELD = { width: 1280, height: 720, groundY: 620 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Metres of farm to cross before the forest gate; 20 scrolled pixels are one metre. */
export const RUN_LENGTH_M = 1600;
export const PX_PER_M = 20;

/** The turkey's fixed screen x; the farmer closes in from the left as the gap shrinks. */
export const TURKEY_X = 300;

export const PLAYER = {
  width: 64,
  height: 52,
  /** A jump that clears the 118 px oven: the feet stay above it for about half a second,
   *  which is 140 px of travel at a steady run and 200 px at a sprint. */
  jumpVelocity: 820,
  gravity: 1900,
  coyote: 0.1,
  buffer: 0.12,
  invulnerable: 1.5,
  /** Seconds of forced slow running after a stumble. */
  stumbleSlow: 0.9,
};

/** Scroll speeds in pixels a second: slow, steady and sprint. */
export const SPEEDS = { slow: 170, normal: 285, fast: 410 };
/** The farmer's pursuit speed: slower than a sprint, faster than a steady run, so the gap
 *  only grows when the turkey sprints, grabs corn or hides. */
export const FARMER_SPEED = 300;

export const LIVES = 3;

/** The four stretches of the run: each one is faster, spawns closer together and repaints
 *  the farm. The kitchen is where the ovens live; the forest is the final sprint. */
export const STAGES = [
  { name: 'Farmyard', from: 0, to: 400, speed: 1.0, spawn: 1.0, palette: 'farm' },
  { name: 'Barn', from: 400, to: 800, speed: 1.08, spawn: 0.92, palette: 'barn' },
  { name: 'Kitchen', from: 800, to: 1200, speed: 1.16, spawn: 0.84, palette: 'kitchen' },
  { name: 'Forest Edge', from: 1200, to: 1600, speed: 1.26, spawn: 0.76, palette: 'forest' },
];

/** Ground obstacles: jump them. The oven is the tall one; it only appears from the barn on. */
export const OBSTACLE = {
  fence: { width: 46, height: 48 },
  hay: { width: 72, height: 58 },
  oven: { width: 96, height: 118 },
};

/** The carving knife hangs above the path, glints as a warning, then drops. Once it sticks
 *  in the ground it is a low obstacle to jump. */
export const KNIFE = {
  width: 26,
  height: 86,
  fallSpeed: 1500,
  /** Seconds of glint before it falls. */
  telegraph: 0.32,
  /** How close the turkey must be before the knife notices it. */
  triggerRange: 250,
  stuckHeight: 42,
};

/** A haystack is a hiding spot, not an obstacle: dive in and the farmer loses the trail. */
export const HAYSTACK = { width: 120, height: 84, hideSeconds: 2.5 };

export const CORN_POINTS = 10;
export const PUMPKIN_POINTS = 25;
export const FEATHER_POINTS = 50;

/** How many things can exist at once; the pools are allocated once, at boot. */
export const POOL_SIZE = 48;

/** Spawn rhythm, in seconds between spawns at stage 1; stages multiply the interval. */
export const SPAWN = { interval: 1.05, intervalJitter: 0.55, minGapPx: 280 };

export const PALETTES = {
  farm: {
    skyTop: '#f7b267', skyBottom: '#f4845f', sun: '#fff3b0', cloud: '#ffe8c2',
    far: '#c97b4a', near: '#8a5a33', ground: '#7a4a21', grass: '#4d7c3a',
    groundLine: '#5d3a1a', panel: '#3d2b1f', text: '#fff3e0', muted: '#e8c39a',
    accent: '#f2c94c', danger: '#e5534b',
  },
  barn: {
    skyTop: '#8d6b9e', skyBottom: '#e07856', sun: '#ffd9a0', cloud: '#d9a0b8',
    far: '#6b4a5e', near: '#4a2f3d', ground: '#54382a', grass: '#5a6b35',
    groundLine: '#3d281c', panel: '#33241f', text: '#ffe9d6', muted: '#d9a583',
    accent: '#f2c94c', danger: '#e5534b',
  },
  kitchen: {
    skyTop: '#5e3a2e', skyBottom: '#a85b3f', sun: '#ffcf7d', cloud: '#c98a6b',
    far: '#7a4a35', near: '#5e3527', ground: '#6b4a33', grass: '#7c6b3a',
    groundLine: '#4a2f22', panel: '#3a241c', text: '#ffe9d6', muted: '#e0a983',
    accent: '#f2c94c', danger: '#ff6b4a',
  },
  forest: {
    skyTop: '#2e4a3a', skyBottom: '#e08a4a', sun: '#ffe9a8', cloud: '#cfe0b8',
    far: '#2e5d43', near: '#1e4632', ground: '#4a3a22', grass: '#3f7c3a',
    groundLine: '#33291a', panel: '#22331f', text: '#eef7e0', muted: '#b8d9a0',
    accent: '#f2c94c', danger: '#e5534b',
  },
};

export const TURKEY = {
  body: '#8a5230', bodyDark: '#6b3d22', tail: ['#a0522d', '#d2691e', '#e8a33c'],
  head: '#e8dcc8', beak: '#f2a541', wattle: '#e5534b', leg: '#e8a33c', wing: '#74452a',
};

export const FARMER = {
  skin: '#e8b88a', shirt: '#c94f3d', overalls: '#3d6b8e', hat: '#d9b45b',
  hatBand: '#6b4a2f', boots: '#4a2f1d', pitchfork: '#8a8f96', handle: '#7a4a26',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'gobble-dash.best';
