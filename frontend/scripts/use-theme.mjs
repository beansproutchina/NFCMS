#!/usr/bin/env node
/**
 * Point the dev "active theme" slot at a theme in ../frontend_themes/<name>.
 *
 *   npm run theme:use            # defaults to pear
 *   npm run theme:use neo
 *
 * It replaces  frontend/src/views/front/templates  with a symlink into the chosen theme, so you
 * edit the real theme source (single source of truth) with full autocomplete/type-check, and the
 * app (vite dev + build) loads it via the existing ./templates/* glob. The slot is gitignored;
 * production instead COPYs the theme into it (see Dockerfile.single). Requires
 * resolve.preserveSymlinks (vite) + preserveSymlinks (tsconfig) — already configured.
 */
import { existsSync, rmSync, symlinkSync, lstatSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));      // frontend/scripts
const frontendRoot = resolve(here, '..');                  // frontend
const themesDir = resolve(frontendRoot, '..', 'frontend_themes');
const slot = resolve(frontendRoot, 'src/views/front/templates');

const name = process.argv[2] || 'pear';
const themePath = resolve(themesDir, name);

if (!existsSync(themePath)) {
  const available = existsSync(themesDir) ? readdirSync(themesDir).filter((d) => !d.startsWith('.')) : [];
  console.error(`✗ theme "${name}" not found at ${themePath}`);
  if (available.length) console.error(`  available: ${available.join(', ')}`);
  process.exit(1);
}

// Clear whatever is currently in the slot (symlink or a real/copied directory).
if (existsSync(slot) || isSymlink(slot)) rmSync(slot, { recursive: true, force: true });

// POSIX: relative link so the repo stays portable across clone locations.
// slot lives at src/views/front/templates -> ../../../../frontend_themes/<name>
// Windows junctions don't accept relative targets, so use the absolute path there.
const relTarget = `../../../../frontend_themes/${name}`;
if (process.platform === 'win32') {
  symlinkSync(themePath, slot, 'junction');
} else {
  symlinkSync(relTarget, slot, 'dir');
}

console.log(`✓ active theme: ${name}`);
console.log(`  ${slot}`);
console.log(`  -> ${process.platform === 'win32' ? themePath : relTarget}`);

function isSymlink(p) {
  try { return lstatSync(p).isSymbolicLink(); } catch { return false; }
}
