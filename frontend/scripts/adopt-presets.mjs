/**
 * One-shot migration: replace duplicated class strings with the presets in `src/ui/presets.ts`.
 *
 * Kept as the record of which literal spelling mapped onto which preset — including the cases where
 * several spellings of the same intent were unified (one form label had five). Unlike the token
 * migrations this is structural: `class="…"` becomes `:class="PRESET"`, and imports are added.
 *
 * Where a class attribute is a preset PLUS extras, the extras stay in a static `class` alongside the
 * dynamic one — Vue merges the two, and utility order inside the attribute has no effect on
 * specificity (CSS source order decides), so nothing shifts.
 *
 *   node scripts/adopt-presets.mjs --dry
 *   node scripts/adopt-presets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['src/views/admin', 'src/views/setup', 'src/views/auth', 'src/components'];

/**
 * Exact class-attribute contents → preset expression.
 * Several entries deliberately collapse different spellings of one intent; those are marked.
 */
const MAP = [
  // ── form labels: five spellings, 33 occurrences ──────────────────────────────────────────
  ['block text-body font-medium text-label mb-1', 'LABEL'],
  ['block text-body font-medium text-label mb-2', 'LABEL'],                 // unified: mb-2 → mb-1
  ['block text-body font-medium text-label', 'LABEL_BARE'],
  ['text-body text-label font-medium', 'LABEL_BARE'],                       // unified
  ['text-body font-medium text-label', 'LABEL_BARE'],                       // unified
  // ── page shell ───────────────────────────────────────────────────────────────────────────
  ['max-w-7xl mx-auto py-10 w-full px-6', 'PAGE.container'],
  ['text-title-page font-semibold leading-title tracking-tight mb-2', 'PAGE.title'],
  ['flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 gap-4', 'PAGE.header'],
  ['flex justify-between items-end mb-8', 'PAGE.header'],                   // unified: → responsive
  ['mb-8 flex justify-between items-end', 'PAGE.header'],                   // unified: → responsive
  // ── field group / section ────────────────────────────────────────────────────────────────
  ['flex flex-col gap-2', 'FIELD_GROUP'],
  ['text-title-section font-semibold', 'SECTION_TITLE'],
  // ── empty states: three spellings ────────────────────────────────────────────────────────
  ['text-center py-10 text-label-3', 'EMPTY'],
  ['text-body text-label-3 py-8 text-center', 'EMPTY'],                     // unified
  ['text-body text-label-3 py-4 text-center', 'EMPTY'],                     // unified
  // ── search field ─────────────────────────────────────────────────────────────────────────
  ['absolute left-3 top-1/2 -translate-y-1/2 opacity-40', 'SEARCH.icon'],
  // ── small buttons ────────────────────────────────────────────────────────────────────────
  ['text-small px-3 h-8 rounded-control border border-separator hover:bg-canvas disabled:opacity-40 cursor-pointer', 'BTN_SMALL.pager'],
  ['w-10 h-10 rounded-full bg-white flex items-center justify-center text-accent hover:scale-110 transition-transform cursor-pointer', 'BTN_SMALL.icon'],
  // ── card ─────────────────────────────────────────────────────────────────────────────────
  ['bg-white rounded-card shadow-card overflow-hidden border border-separator-weak', 'CARD'],
  // ── row actions ──────────────────────────────────────────────────────────────────────────
  ['text-link hover:underline text-body flex items-center cursor-pointer', 'LINK.action'],
  ['text-danger hover:underline text-body flex items-center cursor-pointer', 'LINK.danger'],
];
// Longest first so a preset that is a prefix of another can't win the match.
MAP.sort((a, b) => b[0].length - a[0].length);

/** `:class="[INPUT_CLASS, 'pl-9']"` → use the SEARCH preset for the padding too. */
const INLINE = [[`[INPUT_CLASS, 'pl-9']`, `[INPUT_CLASS, SEARCH.input]`]];

const dry = process.argv.includes('--dry');
const tally = new Map();
let changedFiles = 0;

for (const dir of DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const entry of fs.readdirSync(abs)) {
    if (!entry.endsWith('.vue')) continue;
    const file = path.join(abs, entry);
    const original = fs.readFileSync(file, 'utf8');
    let next = original;
    const used = new Set();

    for (const [from, to] of INLINE) {
      if (next.includes(from)) {
        next = next.split(from).join(to);
        used.add(to.match(/\b([A-Z_]+)/)?.[1] ?? '');
        used.add('SEARCH');
        tally.set(from, (tally.get(from) ?? 0) + 1);
      }
    }

    // `class="…"` where the contents are a preset, optionally followed by extras.
    next = next.replace(/class="([^"]+)"/g, (match, contents) => {
      const words = contents.trim().split(/\s+/);
      for (const [from, preset] of MAP) {
        const fromWords = from.split(/\s+/);
        if (words.length < fromWords.length) continue;
        if (fromWords.join(' ') !== words.slice(0, fromWords.length).join(' ')) continue;
        const rest = words.slice(fromWords.length).join(' ');
        used.add(preset.split('.')[0]);
        tally.set(`${from} → ${preset}`, (tally.get(`${from} → ${preset}`) ?? 0) + 1);
        return rest ? `class="${rest}" :class="${preset}"` : `:class="${preset}"`;
      }
      return match;
    });

    if (next === original) continue;

    // Merge the import. Path depth differs between components/ and views/<x>/.
    const rel = dir.startsWith('src/views') ? '../../ui/presets' : '../ui/presets';
    const names = [...used].filter(Boolean).sort();
    const existing = new RegExp(`import \\{([^}]+)\\} from '${rel.replace(/\./g, '\\.')}';`);
    const found = next.match(existing);
    if (found) {
      const merged = [...new Set([...found[1].split(',').map((s) => s.trim()).filter(Boolean), ...names])].sort();
      next = next.replace(existing, `import { ${merged.join(', ')} } from '${rel}';`);
    } else {
      next = next.replace(/(<script setup[^>]*>\n)/, `$1import { ${names.join(', ')} } from '${rel}';\n`);
    }

    changedFiles += 1;
    if (!dry) fs.writeFileSync(file, next);
  }
}

for (const [k, n] of [...tally].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}×  ${k}`);
console.log(`\n${dry ? 'would change' : 'changed'} ${changedFiles} file(s), ${[...tally.values()].reduce((a, b) => a + b, 0)} occurrence(s).`);
