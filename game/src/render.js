// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Everything is flat canvas art in an autumn palette: the turkey, the farmer, the
// farm and the kitchen, drawn fresh every frame. Text that holds a number is rebuilt only
// when the number changes, so a frame allocates nothing.

import {
  FIELD, FONT, LIVES, PALETTES, PX_PER_M, RUN_LENGTH_M, STAGES, TURKEY, FARMER,
  TURKEY_X, KNIFE,
} from './config.js';
import { KIND_CORN, KIND_FEATHER, KIND_FENCE, KIND_HAY, KIND_KNIFE, KIND_OVEN, KIND_PUMPKIN } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_ESCAPED = 'escaped';

/**
 * The panel's width; its height grows with its lines: room for the title, the lines and the prompt.
 * 860 px, so the title screen's longest lines (about 660 px at 22 px type) sit inside the
 * frame with margin on both sides instead of spilling past its edges.
 */
const PANEL = { width: 860, top: 132, line: 34, bottom: 72 };
const HEART = 22;
const HEART_GAP = 8;

/** A deterministic 0..1 hash of an integer, for scenery that never changes as it scrolls. */
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const distanceLabel = cachedLabel('');
  const finalLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function circle(x, y, radius, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function ellipse(x, y, rx, ry, color) {
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
  }

  /** One repeating scenery row: items every `spacing` pixels, each jittered by its index. */
  function sceneryRow(scroll, factor, spacing, drawItem) {
    const offset = scroll * factor;
    const first = Math.floor(offset / spacing) - 1;
    const count = Math.ceil(FIELD.width / spacing) + 2;
    for (let k = 0; k < count; k += 1) {
      const index = first + k;
      const x = index * spacing - offset + hash(index) * spacing * 0.5;
      drawItem(x, index);
    }
  }

  function drawBackground(state) {
    const stage = STAGES[state.stageIndex];
    const palette = PALETTES[stage.palette];
    const scroll = state.scrollPx;
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.groundY);
    gradient.addColorStop(0, palette.skyTop);
    gradient.addColorStop(1, palette.skyBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.groundY);
    circle(FIELD.width - 180, 110, 46, palette.sun);
    circle(FIELD.width - 196, 96, 46, palette.sun);
    sceneryRow(scroll, 0.15, 260, (x, index) => {
      const y = 150 + hash(index + 50) * 60;
      context.fillStyle = palette.cloud;
      ellipse(x, y, 52, 20, palette.cloud);
      ellipse(x + 34, y + 6, 36, 16, palette.cloud);
    });
    if (stage.palette === 'kitchen') {
      // The run comes indoors: a tiled wall, a window on the farm, a long table.
      context.fillStyle = palette.far;
      context.fillRect(0, FIELD.groundY - 210, FIELD.width, 210);
      context.fillStyle = palette.skyBottom;
      context.fillRect(90, 120, 220, 170);
      context.fillStyle = palette.groundLine;
      for (let row = 0; row < 4; row += 1) context.fillRect(90, 120 + row * 43, 220, 3);
      context.fillStyle = palette.near;
      context.fillRect(0, FIELD.groundY - 120, FIELD.width, 26);
      context.fillRect(60, FIELD.groundY - 94, 26, 94);
      context.fillRect(FIELD.width - 86, FIELD.groundY - 94, 26, 94);
    } else {
      sceneryRow(scroll, 0.35, 210, (x, index) => {
        const height = 90 + hash(index + 9) * 70;
        context.fillStyle = palette.far;
        context.beginPath();
        context.moveTo(x, FIELD.groundY);
        context.lineTo(x + 34, FIELD.groundY - height);
        context.lineTo(x + 68, FIELD.groundY);
        context.closePath();
        context.fill();
      });
      sceneryRow(scroll, 0.55, 170, (x) => {
        context.fillStyle = palette.near;
        context.fillRect(x, FIELD.groundY - 44, 6, 44);
        context.fillRect(x + 6, FIELD.groundY - 38, 164, 5);
        context.fillRect(x + 6, FIELD.groundY - 22, 164, 5);
      });
    }
    context.fillStyle = palette.ground;
    context.fillRect(0, FIELD.groundY, FIELD.width, FIELD.height - FIELD.groundY);
    context.fillStyle = palette.groundLine;
    context.fillRect(0, FIELD.groundY, FIELD.width, 5);
    sceneryRow(scroll, 1, 130, (x, index) => {
      context.strokeStyle = palette.grass;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(x, FIELD.groundY + 22 + hash(index) * 60);
      context.lineTo(x - 6, FIELD.groundY + 10 + hash(index) * 60);
      context.moveTo(x + 6, FIELD.groundY + 22 + hash(index) * 60);
      context.lineTo(x + 12, FIELD.groundY + 10 + hash(index) * 60);
      context.stroke();
    });
  }

  /** The forest gate at the end of the run: two posts, a branch arch and a wreath. */
  function drawGate(state) {
    const gateX = TURKEY_X + (RUN_LENGTH_M - state.distanceM) * PX_PER_M;
    if (gateX > FIELD.width + 120) return;
    const top = FIELD.groundY - 210;
    context.fillStyle = '#5d3a1a';
    context.fillRect(gateX - 14, top, 20, 210);
    context.fillRect(gateX + 120, top, 20, 210);
    context.fillStyle = '#7a4a21';
    context.fillRect(gateX - 24, top - 16, 168, 22);
    circle(gateX + 58, top + 34, 22, '#3f7c3a');
    circle(gateX + 58, top + 34, 12, '#e5534b');
    text('FOREST', gateX + 58, top + 84, 20, '#fff3e0', 'center');
  }

  function drawHaystack(stack, wobble) {
    const cx = stack.x + stack.width / 2;
    const base = FIELD.groundY;
    context.fillStyle = '#c98f2e';
    context.beginPath();
    context.moveTo(stack.x, base);
    context.quadraticCurveTo(cx + (wobble ? 6 : 0), base - stack.height - 18, stack.x + stack.width, base);
    context.closePath();
    context.fill();
    context.strokeStyle = '#a8761f';
    context.lineWidth = 3;
    for (let line = 0; line < 4; line += 1) {
      context.beginPath();
      context.moveTo(stack.x + 14 + line * 26, base - 8);
      context.quadraticCurveTo(cx, base - 40 - line * 10, stack.x + 20 + line * 26, base - stack.height + 6);
      context.stroke();
    }
  }

  function drawFence(item) {
    context.fillStyle = '#7a4a21';
    context.fillRect(item.x, item.y, 8, item.height);
    context.fillRect(item.x + item.width - 8, item.y, 8, item.height);
    context.fillRect(item.x, item.y + 10, item.width, 7);
    context.fillRect(item.x, item.y + 28, item.width, 7);
  }

  function drawOven(item, time) {
    const flicker = Math.sin(time * 9 + item.x) * 4;
    context.fillStyle = '#3a3f47';
    context.fillRect(item.x, item.y, item.width, item.height);
    context.fillStyle = '#565d68';
    context.fillRect(item.x + 8, item.y + 8, item.width - 16, 18);
    context.fillStyle = '#2a2e35';
    context.fillRect(item.x + item.width - 26, item.y - 34, 16, 34);
    // The fire inside the oven mouth, always hungry.
    context.fillStyle = '#e5534b';
    context.beginPath();
    context.ellipse(item.x + item.width / 2, item.y + item.height - 22, 26 + flicker, 20, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f2a541';
    context.beginPath();
    context.ellipse(item.x + item.width / 2, item.y + item.height - 18, 16 + flicker, 12, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f7d774';
    context.beginPath();
    context.ellipse(item.x + item.width / 2, item.y + item.height - 14, 8, 6, 0, 0, Math.PI * 2);
    context.fill();
    text('HOT!', item.x + item.width / 2, item.y - 8, 18, '#e5534b', 'center');
  }

  function drawKnife(item, time) {
    const glint = item.state === 'telegraph' ? (Math.floor(time * 14) % 2 === 0 ? 1 : 0.4) : 1;
    if (item.state === 'hanging' || item.state === 'telegraph') {
      context.strokeStyle = '#8a8f96';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(item.x + item.width / 2, 0);
      context.lineTo(item.x + item.width / 2, item.y);
      context.stroke();
    }
    context.save();
    context.globalAlpha = glint;
    context.fillStyle = '#7a4a26';
    context.fillRect(item.x + item.width * 0.35, item.y, item.width * 0.3, item.height * 0.3);
    context.fillStyle = '#d7dce3';
    context.beginPath();
    context.moveTo(item.x, item.y + item.height * 0.3);
    context.lineTo(item.x + item.width, item.y + item.height * 0.3);
    context.lineTo(item.x + item.width / 2, item.y + item.height);
    context.closePath();
    context.fill();
    context.restore();
    if (item.state === 'telegraph') {
      context.fillStyle = 'rgba(229, 83, 75, 0.35)';
      context.beginPath();
      context.ellipse(item.x + item.width / 2, FIELD.groundY - 6, 40, 8, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPickup(item) {
    const bob = Math.sin(item.bob) * 4;
    const y = item.y + bob;
    if (item.kind === KIND_CORN) {
      context.fillStyle = '#f2c94c';
      ellipse(item.x + 13, y + 13, 9, 13, '#f2c94c');
      context.strokeStyle = '#d9a41f';
      context.lineWidth = 2;
      for (let line = -1; line <= 1; line += 1) {
        context.beginPath();
        context.moveTo(item.x + 13 + line * 5, y + 3);
        context.lineTo(item.x + 13 + line * 5, y + 23);
        context.stroke();
      }
      context.fillStyle = '#4d7c3a';
      context.fillRect(item.x + 11, y + 24, 4, 6);
    } else if (item.kind === KIND_PUMPKIN) {
      context.fillStyle = '#e07830';
      ellipse(item.x + 20, y + 17, 20, 16, '#e07830');
      context.fillStyle = '#c95f1e';
      ellipse(item.x + 20, y + 17, 12, 16, '#c95f1e');
      context.fillStyle = '#4d7c3a';
      context.fillRect(item.x + 17, y - 4, 6, 10);
    } else if (item.kind === KIND_FEATHER) {
      context.save();
      context.translate(item.x + 15, y + 15);
      context.rotate(-0.5);
      context.fillStyle = '#f2c94c';
      context.beginPath();
      context.ellipse(0, 0, 8, 16, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#e5534b';
      context.beginPath();
      context.ellipse(0, 6, 4, 8, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  /** The turkey: a flat brown body under a fan of three tail colours, running legs, a small
   *  head and a red wattle. It bobs as it runs and stretches its wing in a jump. */
  function drawTurkey(turkey, time) {
    const cx = turkey.x + turkey.width / 2;
    const base = turkey.y + turkey.height;
    const running = turkey.onGround && !turkey.hiding;
    const bob = running ? Math.sin(turkey.runCycle * 6) * 2 : 0;
    const legSwing = running ? Math.sin(turkey.runCycle * 6) * 9 : 0;
    const lift = turkey.onGround ? 0 : 6;
    for (let index = 0; index < 3; index += 1) {
      context.fillStyle = TURKEY.tail[index];
      context.beginPath();
      context.arc(cx - 14, base - 14 + bob, turkey.width * (0.62 - index * 0.12), Math.PI * 0.9, Math.PI * 2.1);
      context.fill();
    }
    context.fillStyle = TURKEY.body;
    context.beginPath();
    context.ellipse(cx, base - 18 + bob - lift, turkey.width * 0.34, turkey.height * 0.42, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = TURKEY.wing;
    context.beginPath();
    context.ellipse(cx - 2, base - 18 + bob - lift, 12, 7, turkey.onGround ? -0.4 : -1.1, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = TURKEY.head;
    circle(cx + 16, base - 46 + bob - lift, 10, TURKEY.head);
    context.fillStyle = TURKEY.beak;
    context.beginPath();
    context.moveTo(cx + 24, base - 48 + bob - lift);
    context.lineTo(cx + 36, base - 44 + bob - lift);
    context.lineTo(cx + 24, base - 41 + bob - lift);
    context.closePath();
    context.fill();
    context.fillStyle = TURKEY.wattle;
    context.fillRect(cx + 22, base - 38 + bob - lift, 5, 9);
    context.fillStyle = '#222';
    circle(cx + 19, base - 49 + bob - lift, 2, '#222');
    context.strokeStyle = TURKEY.leg;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(cx - 6, base - 4);
    context.lineTo(cx - 6 + legSwing, base + 8);
    context.moveTo(cx + 6, base - 4);
    context.lineTo(cx + 6 - legSwing, base + 8);
    context.stroke();
    void time;
  }

  /** The farmer, chasing from the left: overalls, straw hat, pitchfork, and a face that has
   *  had enough of this turkey. He grows a little as the gap closes. */
  function drawFarmer(gap, time) {
    const scale = 0.9 + (1 - gap) * 0.25;
    const x = TURKEY_X - 60 - gap * 260;
    const base = FIELD.groundY;
    const legSwing = Math.sin(time * 11) * 10;
    const bob = Math.abs(Math.sin(time * 11)) * 3;
    context.save();
    context.translate(x, base);
    context.scale(scale, scale);
    context.strokeStyle = FARMER.boots;
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(-8, -8 - bob);
    context.lineTo(-8 + legSwing, 0);
    context.moveTo(8, -8 - bob);
    context.lineTo(8 - legSwing, 0);
    context.stroke();
    context.fillStyle = FARMER.overalls;
    context.fillRect(-16, -58 - bob, 32, 50);
    context.fillStyle = FARMER.shirt;
    context.fillRect(-16, -72 - bob, 32, 18);
    context.fillStyle = FARMER.skin;
    circle(0, -84 - bob, 13, FARMER.skin);
    context.fillStyle = FARMER.hat;
    context.beginPath();
    context.ellipse(0, -94 - bob, 20, 6, 0, 0, Math.PI * 2);
    context.fill();
    context.fillRect(-11, -108 - bob, 22, 14);
    context.fillStyle = FARMER.hatBand;
    context.fillRect(-11, -96 - bob, 22, 4);
    context.fillStyle = '#222';
    context.fillRect(2, -88 - bob, 7, 3);
    context.fillRect(-9, -88 - bob, 7, 3);
    context.strokeStyle = FARMER.handle;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(20, -70 - bob);
    context.lineTo(34, -116 - bob);
    context.stroke();
    context.strokeStyle = FARMER.pitchfork;
    context.lineWidth = 3;
    for (let prong = -1; prong <= 1; prong += 1) {
      context.beginPath();
      context.moveTo(34 + prong * 6, -116 - bob);
      context.lineTo(34 + prong * 6, -130 - bob);
      context.stroke();
    }
    context.restore();
  }

  function drawHud(state, score, screen) {
    const stage = STAGES[state.stageIndex];
    const palette = PALETTES[stage.palette];
    context.textBaseline = 'top';
    text(scoreLabel(score), 24, 18, 30, palette.text, 'left');
    text(distanceLabel(`${Math.floor(state.distanceM)} m  ·  ${stage.name}`), FIELD.width / 2, 22, 24, palette.text, 'center');
    const barWidth = 300;
    const barX = (FIELD.width - barWidth) / 2;
    const barY = 52;
    context.fillStyle = 'rgba(0, 0, 0, 0.35)';
    context.fillRect(barX, barY, barWidth, 10);
    context.fillStyle = palette.accent;
    context.fillRect(barX, barY, barWidth * Math.min(1, state.distanceM / RUN_LENGTH_M), 10);
    // A tiny forest gate at the end of the bar, drawn not typed.
    context.fillStyle = '#7a4a21';
    context.fillRect(barX + barWidth + 10, barY - 6, 4, 20);
    context.fillRect(barX + barWidth + 22, barY - 6, 4, 20);
    context.fillRect(barX + barWidth + 8, barY - 8, 26, 4);
    const firstHeart = FIELD.width - 24 - LIVES * (HEART + HEART_GAP) + HEART_GAP;
    text('Lives', firstHeart - 14, 18, 24, palette.text, 'right');
    for (let life = 0; life < LIVES; life += 1) {
      const x = firstHeart + life * (HEART + HEART_GAP);
      const y = 22;
      context.fillStyle = life < state.lives ? '#e5534b' : 'rgba(0, 0, 0, 0.35)';
      context.beginPath();
      context.moveTo(x + HEART / 2, y + HEART * 0.9);
      context.bezierCurveTo(x, y + HEART * 0.45, x + 2, y, x + HEART * 0.32, y);
      context.bezierCurveTo(x + HEART * 0.42, y - HEART * 0.12, x + HEART * 0.58, y - HEART * 0.12, x + HEART * 0.68, y);
      context.bezierCurveTo(x + HEART - 2, y, x + HEART, y + HEART * 0.45, x + HEART / 2, y + HEART * 0.9);
      context.fill();
    }
    if (screen === SCREEN_PLAY && state.gap < 0.3) {
      const blink = Math.floor(performance.now() / 300) % 2 === 0;
      if (blink) text('FARMER CLOSE!', FIELD.width / 2, 84, 30, palette.danger, 'center');
    }
  }

  function drawPanel(title, lines, prompt, palette) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(20, 14, 10, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = palette.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = palette.accent;
    context.lineWidth = 3;
    context.strokeRect(x + 6, y + 6, PANEL.width - 12, height - 12);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, palette.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 22, palette.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 24, palette.accent, 'center');
  }

  /** Paint one frame: the field, the actors, then the HUD or a panel for the screen. */
  function draw(state, screen, best, score, muted, time) {
    const stage = STAGES[state.stageIndex];
    const palette = PALETTES[stage.palette];
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#1b1410';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawBackground(state);
    drawGate(state);
    for (const stack of state.haystacks) {
      if (!stack.active) continue;
      const wobble = state.turkey.hiding && stack.x < TURKEY_X + 80 && stack.x + stack.width > TURKEY_X;
      drawHaystack(stack, wobble);
    }
    for (const item of state.pickups) {
      if (!item.active) continue;
      drawPickup(item);
    }
    for (const item of state.obstacles) {
      if (!item.active) continue;
      if (item.kind === KIND_FENCE) drawFence(item);
      else if (item.kind === KIND_HAY) drawHaystack({ x: item.x, width: item.width, height: item.height }, false);
      else if (item.kind === KIND_OVEN) drawOven(item, time);
      else if (item.kind === KIND_KNIFE) drawKnife(item, time);
    }
    // The farmer chases on every screen, title included: the chase is the game.
    drawFarmer(state.gap, time);
    const turkey = state.turkey;
    if (!turkey.hiding && (turkey.invulnerable === 0 || Math.floor(turkey.invulnerable * 10) % 2 === 1)) {
      drawTurkey(turkey, time);
    }
    if (screen === SCREEN_TITLE) {
      const lines = [
        'The farmer is coming for Thanksgiving dinner. Run.',
        'Jump the fences, the hay and the oven. Mind the carving knife.',
        'Dive into a haystack to lose him. Grab corn, pumpkins, feathers.',
        '← → or A D to dawdle or sprint · Space / click to jump',
        '↓ to hide · P to pause',
        bestLabel(best),
      ];
      drawPanel('GOBBLE DASH', lines, 'Press Space or click to run', palette);
      return;
    }
    drawHud(state, score, screen);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The farmer waits. The oven stays hot.'], 'Press P or click to keep running', palette);
    } else if (screen === SCREEN_CAUGHT) {
      const lines = [finalLabel(score), bestLabel(best), 'The farmer caught up. Thanksgiving is ruined.'];
      drawPanel('CAUGHT FOR DINNER', lines, 'Press Space or click to run again', palette);
    } else if (screen === SCREEN_ESCAPED) {
      const lines = [finalLabel(score), bestLabel(best), 'Through the forest gate, free as a bird. Well — a turkey.'];
      drawPanel('ESCAPED!', lines, 'Press Space or click to run again', palette);
    }
    if (muted) text('muted (M)', FIELD.width - 24, FIELD.height - 34, 18, palette.muted, 'right');
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
