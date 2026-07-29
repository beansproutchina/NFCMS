/**
 * One-shot migration: collapse near-duplicate literals onto the token scale.
 *
 * Kept in the repo as the record of what was consolidated and why. Unlike `audit-classes.mjs --fix`,
 * these rewrites are NOT css-equivalent — they change values, so the UI really does shift slightly.
 * That is the price of a scale you can read: you cannot keep 22 shades of black AND be able to tell
 * which one is heavier. Every row below was reviewed and approved (see
 * docs/design-system-refactor.md §5).
 *
 * Only `frontend/src` is touched; themes have their own token systems (§7).
 *
 *   node scripts/merge-tokens.mjs --dry    # report
 *   node scripts/merge-tokens.mjs          # apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/**
 * Everything under `src` EXCEPT `views/front`, which is a symlink to the active theme — writing
 * through it would silently edit `frontend_themes/<name>` (see docs/design-system-refactor.md §7).
 */
const DIRS = ['src', 'src/views', 'src/views/admin', 'src/views/setup', 'src/views/auth', 'src/components', 'src/ui', 'src/router', 'src/stores']
  .map((d) => path.join(ROOT, d));

/**
 * Translucent black, mapped BY ROLE — the same alpha means different things under different
 * utilities, and mapping on value alone produces both nonsense and outright bugs:
 *
 *   - `bg-[rgba(0,0,0,0.8)]` is the dark translucent mobile app bar. Sent to `label` (#1d1d1f,
 *     opaque) it would lose its transparency and the backdrop-blur behind it.
 *   - `bg-[rgba(0,0,0,0.08)]` marks a SELECTED row, and always sits next to `hover:bg-fill`
 *     (0.04). Collapsing the two makes "selected" indistinguishable from "hovered".
 *   - `bg-[rgba(0,0,0,0.4)]` is a dialog scrim, not third-level text.
 */
const ALPHA = {
  text: {
    '0.9': 'label', '0.8': 'label',
    '0.7': 'label-2', '0.6': 'label-2', '0.55': 'label-2',
    '0.5': 'label-3', '0.48': 'label-3', '0.45': 'label-3', '0.4': 'label-3', '0.35': 'label-3',
    '0.3': 'label-4', '0.25': 'label-4', '0.2': 'label-4',
  },
  border: {
    '0.15': 'separator', '0.12': 'separator', '0.1': 'separator',
    '0.08': 'separator-weak', '0.06': 'separator-weak', '0.05': 'separator-weak',
    '0.04': 'separator-weak', '0.03': 'separator-weak',
  },
  bg: {
    '0.8': 'chrome',
    '0.5': 'scrim', '0.45': 'scrim', '0.4': 'scrim',
    '0.08': 'fill-strong',
    '0.05': 'fill', '0.04': 'fill',
  },
};

/** Which alpha family a utility belongs to. */
const ROLE = {
  text: 'text', fill: 'text', stroke: 'text', placeholder: 'text', caret: 'text', decoration: 'text',
  border: 'border', outline: 'border', ring: 'border', divide: 'border',
  bg: 'bg', from: 'bg', via: 'bg', to: 'bg',
};

/** Opaque hex has no role ambiguity, apart from the info panel's tint vs its edge. */
const HEX = {
  '#f3f4f6': 'canvas',
  '#f9f9fb': 'surface',
  '#fbfbfd': 'surface',
  '#fafafa': 'surface',
  '#ededf2': 'surface-hover',
  '#ebebeb': 'surface-hover',
  '#d2d2d7': 'divider',
  '#0077ED': 'accent-hover',
  '#0077ed': 'accent-hover',
  '#bae6fd': 'info-fill',
  '#f0f7ff': 'info-fill',
  '#fff': 'white',
  '#ffffff': 'white',
  '#000': 'black',
};
const HEX_BY_ROLE = { border: { '#b3d4fc': 'info' }, bg: { '#b3d4fc': 'info-fill' } };

/** Phase 1 mapped these by value before the roles above existed; correct them. */
const FIXUP = { 'bg-label-3': 'bg-scrim' };

/** Size literals → token, keyed by the base utility so `text-[13px]` and `w-[13px]` don't collide. */
const SIZE = {
  text: { '11px': 'small', '13px': 'small', '15px': 'body', '16px': 'body', '18px': 'title-section', '19px': 'title-section', '21px': 'title-section' },
  rounded: { '5px': 'control', '6px': 'control', '10px': 'control', '11px': 'card', '16px': 'card' },
  'rounded-b': { '11px': 'card', '16px': 'card' },
  'rounded-t': { '11px': 'card', '16px': 'card' },
};

/** `rounded-[980px]` is a pill; Tailwind already has a name for that. */
const PILL = /((?:[a-z-]+:)*rounded(?:-[btlrse]+)?)-\[980px\]/g;

const files = [];
for (const dir of DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && /\.(vue|ts)$/.test(entry.name)) files.push(path.join(dir, entry.name));
  }
}

const dry = process.argv.includes('--dry');
const tally = new Map();
let changedFiles = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let next = original.replace(PILL, (_m, prefix) => {
    tally.set('rounded-[980px] → rounded-full', (tally.get('rounded-[980px] → rounded-full') ?? 0) + 1);
    return `${prefix}-full`;
  });

  for (const [from, to] of Object.entries(FIXUP)) {
    next = next.replace(new RegExp(`(^|[\\s"'\`\\[])${from}(?=[\\s"'\`\\]]|$)`, 'g'), (_m, lead) => {
      tally.set(`${from} → ${to}`, (tally.get(`${from} → ${to}`) ?? 0) + 1);
      return `${lead}${to}`;
    });
  }

  next = next.replace(/((?:[a-z-]+:)*[a-z][a-z-]*)-\[([^\]\s]+)\]/g, (match, prefixed, literal) => {
    const base = prefixed.replace(/^(?:[a-z-]+:)*/, '');   // drop variants like `hover:`
    const role = ROLE[base.replace(/-[btlrsexy]+$/, '')] ?? ROLE[base];
    const alpha = /^rgba\(0,0,0,([0-9.]+)\)$/.exec(literal)?.[1];
    const token =
      SIZE[base]?.[literal] ??
      (alpha && role ? ALPHA[role]?.[alpha] : undefined) ??
      (role ? HEX_BY_ROLE[role]?.[literal] : undefined) ??
      HEX[literal];
    if (!token) return match;
    const key = `${base}-[${literal}] → ${base}-${token}`;
    tally.set(key, (tally.get(key) ?? 0) + 1);
    return `${prefixed}-${token}`;
  });

  if (next !== original) {
    changedFiles += 1;
    if (!dry) fs.writeFileSync(file, next);
  }
}

for (const [key, n] of [...tally].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}×  ${key}`);
console.log(`\n${dry ? 'would change' : 'changed'} ${changedFiles} file(s), ${[...tally.values()].reduce((a, b) => a + b, 0)} occurrence(s).`);
