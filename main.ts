// Gobble Dash, handed in: the game is this directory's game/ folder, plain static files a
// desktop browser loads offline (game/index.html and its ES modules, no library and no
// network request), and this program copies game/ and screenshots/ from beside this file
// to /output and writes /output/dossier.json, the summary the judge reads, with the
// vendored make.fun library. Node 22, standard library only.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing: there is no game to hand in');
}

mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the
// others refuse an entry the scorer would refuse (more than 4 screenshots or one over
// 256 KiB; more than 993 files in game/ or 48 MiB of game files, in all, or a path under
// game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const dossierPath = join(outDir, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Read the dossier back: a hand-in that writes nothing, or writes bytes that are not the
// dossier, must fail here rather than reach the scorer as a silent empty entry.
const dossierBytes = readFileSync(dossierPath);
const dossier = JSON.parse(new TextDecoder().decode(dossierBytes)) as { schema?: unknown; images?: unknown[] };
if (dossier.schema !== 'makefun/dossier/v1') {
  throw new Error('dossier.json is not a makefun/dossier/v1 dossier: the hand-in is incomplete');
}
if (!Array.isArray(dossier.images) || dossier.images.length < 3 || dossier.images.length > 4) {
  throw new Error(`dossier.json holds ${Array.isArray(dossier.images) ? dossier.images.length : 0} screenshots: an entry hands in 3 or 4`);
}
