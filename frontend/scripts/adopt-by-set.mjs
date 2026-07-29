/**
 * Adopt presets by matching the SET of appearance classes, not the literal string.
 *
 * The string-matching pass (adopt-presets.mjs) could not finish the job: `text-body text-label
 * font-medium` and `block text-body font-medium text-label mb-1` are one label in two spellings, so a
 * literal search reports them as unrelated and the cleanup never converges. This compares
 * order-independent sets and ignores layout classes, so a call site is matched however it was typed.
 *
 * Layout classes it finds alongside are preserved in a static `class`; Vue merges the two, and
 * utility order within an attribute does not affect specificity, so nothing moves.
 *
 *   node scripts/adopt-by-set.mjs --dry
 *   node scripts/adopt-by-set.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['src/views/admin', 'src/views/setup', 'src/views/auth', 'src/components'];

/** preset expression → the appearance classes it provides. Order here is irrelevant. */
const PRESETS = {
  'TEXT.caption': 'text-small text-label-3',
  'TEXT.meta': 'text-small text-label-2',
  'TEXT.hint': 'text-body text-label-3',
  'TEXT.muted': 'text-body text-label-2',
  'CARD': 'bg-white rounded-card shadow-card border border-separator-weak',
  'SECTION_TITLE': 'text-title-section font-semibold',
  'LABEL_BARE': 'text-body font-medium text-label',
  'EMPTY': 'text-center text-body text-label-3',
};
/** Longest first so `CARD` wins over the plain `border-separator-weak` it contains. */
const ORDER = Object.entries(PRESETS)
  .map(([expr, cls]) => [expr, new Set(cls.split(/\s+/))])
  .sort((a, b) => b[1].size - a[1].size);

const APPEARANCE = [
  /^(text|bg|border|ring|divide|outline|placeholder|caret|accent|decoration|fill|stroke)-(?!\[)[a-z]/,
  /^(rounded|shadow)(-|$)/,
  /^(font|leading|tracking)-/,
];
const NEUTRAL = new Set(['border', 'border-0', 'border-t', 'border-b', 'border-l', 'border-r', 'text-left', 'text-center', 'text-right']);
const isAppearance = (c) => {
  const bare = c.replace(/^(?:[a-z-]+:)+/, '');
  return !NEUTRAL.has(bare) && APPEARANCE.some((re) => re.test(bare));
};

const dry = process.argv.includes('--dry');
const tally = new Map();
let changed = 0;

for (const dir of DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const name of fs.readdirSync(abs).filter((f) => f.endsWith('.vue'))) {
    const file = path.join(abs, name);
    const original = fs.readFileSync(file, 'utf8');
    const used = new Set();

    const next = original.replace(/(?<!:)\bclass="([^"]+)"/g, (match, contents) => {
      const words = contents.trim().split(/\s+/);
      // `border` on its own is meaningless without a colour; treat it as part of the appearance set
      // when a border colour is present, so CARD's `border border-separator-weak` can match.
      const hasBorderColour = words.some((w) => /^border-(?!0$|t$|b$|l$|r$)[a-z]/.test(w));
      const appearance = new Set(words.filter((w) => isAppearance(w) || (w === 'border' && hasBorderColour)));
      for (const [expr, need] of ORDER) {
        if (need.size < 2) continue;
        if ([...need].some((n) => !appearance.has(n))) continue;
        const rest = words.filter((w) => !need.has(w));
        used.add(expr.split('.')[0]);
        tally.set(`${[...need].join(' ')} → ${expr}`, (tally.get(`${[...need].join(' ')} → ${expr}`) ?? 0) + 1);
        return rest.length ? `class="${rest.join(' ')}" :class="${expr}"` : `:class="${expr}"`;
      }
      return match;
    });

    if (next === original) continue;
    let out = next;
    const rel = dir.startsWith('src/views') ? '../../ui/presets' : '../ui/presets';
    const re = new RegExp(`import \\{([^}]+)\\} from '${rel.replace(/\./g, '\\.')}';`);
    const found = out.match(re);
    if (found) {
      const names = [...new Set([...found[1].split(',').map((s) => s.trim()).filter(Boolean), ...used])].sort();
      out = out.replace(re, `import { ${names.join(', ')} } from '${rel}';`);
    } else {
      out = out.replace(/(<script setup[^>]*>\n)/, `$1import { ${[...used].sort().join(', ')} } from '${rel}';\n`);
    }
    changed += 1;
    if (!dry) fs.writeFileSync(file, out);
  }
}

for (const [k, n] of [...tally].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}×  ${k}`);
console.log(`\n${dry ? 'would change' : 'changed'} ${changed} file(s), ${[...tally.values()].reduce((a, b) => a + b, 0)} site(s).`);
