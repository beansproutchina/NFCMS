/**
 * Inventory of every inline APPEARANCE class left in the admin.
 *
 * Written after matching known duplicate strings proved unable to finish the job: it only ever finds
 * literal repeats, so anything with a different word order or one extra class slips through, and the
 * list of "remaining" problems never converges. This inverts the search — enumerate every class
 * attribute, keep the ones that style appearance, and report them for review. Nothing is assumed to
 * be known in advance.
 *
 * Appearance = colour, type size/weight, radius, shadow, border. Those belong to the design system.
 * Layout (flex, grid, gap, padding, width, position) does NOT — it is per-instance and stays inline.
 *
 *   node scripts/audit-appearance.mjs            # grouped by file, for review
 *   node scripts/audit-appearance.mjs --summary  # counts per utility, to see what to preset next
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['src/views/admin', 'src/views/setup', 'src/views/auth', 'src/components'];

/** A class that decides how something LOOKS rather than where it sits. */
const APPEARANCE = [
  /^(text|bg|border|ring|divide|outline|placeholder|caret|accent|decoration|fill|stroke)-(?!\[)[a-z]/,
  /^(rounded|shadow)(-|$)/,
  /^(font|leading|tracking)-/,
  /^(uppercase|lowercase|capitalize|italic|underline|truncate)$/,
];
/** Utilities that merely echo a token and are fine anywhere. */
const NEUTRAL = new Set([
  'text-white', 'bg-white', 'bg-transparent', 'border-transparent', 'border-0', 'border', 'border-t',
  'border-b', 'border-l', 'border-r', 'rounded-full', 'shadow-none', 'truncate', 'underline',
  'text-left', 'text-center', 'text-right', 'font-medium', 'font-semibold', 'font-normal', 'font-bold',
  'font-mono', 'font-sans', 'text-nowrap',
]);

const isAppearance = (c) => {
  const bare = c.replace(/^(?:[a-z-]+:)+/, '');
  if (NEUTRAL.has(bare)) return false;
  return APPEARANCE.some((re) => re.test(bare));
};

const rows = [];
for (const dir of DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const name of fs.readdirSync(abs).filter((f) => f.endsWith('.vue'))) {
    const file = path.join(abs, name);
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      // Static `class="…"` only: a `:class` already points at something named.
      for (const m of line.matchAll(/(?<!:)\bclass="([^"]+)"/g)) {
        const hits = m[1].split(/\s+/).filter(isAppearance);
        if (hits.length) rows.push({ file: `${dir}/${name}`, line: i + 1, hits, all: m[1] });
      }
      // Appearance inside an expression: `:class="[X, 'text-danger']"`, `? 'bg-canvas' : …`
      for (const m of line.matchAll(/'([^']+)'/g)) {
        if (!/^[a-z][a-z0-9:_./[\]()%-]*(\s+[a-z][^']*)?$/.test(m[1])) continue;
        const hits = m[1].split(/\s+/).filter(isAppearance);
        if (hits.length) rows.push({ file: `${dir}/${name}`, line: i + 1, hits, all: m[1], expr: true });
      }
    });
  }
}

if (process.argv.includes('--clusters')) {
  /**
   * Group by the SET of appearance classes, sorted and with layout stripped.
   *
   * This is the part exact-string matching cannot do: `text-body text-label font-medium` and
   * `block text-body font-medium text-label mb-1` are the same label wearing different word order
   * and one layout class, so a literal search reports them as two unrelated strings and the cleanup
   * never converges. Normalising to a set collapses them into one cluster.
   */
  const groups = new Map();
  for (const r of rows) {
    const key = [...new Set(r.hits.map((h) => h.replace(/^(?:[a-z-]+:)+/, (v) => v)))].sort().join(' ');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const multi = [...groups].filter(([, v]) => v.length >= 2).sort((a, b) => b[1].length - a[1].length);
  for (const [key, sites] of multi) {
    const files = [...new Set(sites.map((s) => path.basename(s.file)))];
    console.log(`  ×${String(sites.length).padStart(2)}  ${key.slice(0, 100)}`);
    console.log(`       ${files.slice(0, 6).join(', ')}${files.length > 6 ? ` +${files.length - 6}` : ''}`);
  }
  console.log(`\n${multi.length} repeated appearance combination(s); ${groups.size - multi.length} one-off(s).`);
} else if (process.argv.includes('--summary')) {
  const counts = new Map();
  for (const r of rows) for (const h of r.hits) counts.set(h, (counts.get(h) ?? 0) + 1);
  for (const [c, n] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}×  ${c}`);
  console.log(`\n${rows.length} site(s), ${counts.size} distinct appearance utilities.`);
} else {
  let last = '';
  for (const r of rows.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
    if (r.file !== last) { console.log(`\n${r.file}`); last = r.file; }
    console.log(`  :${String(r.line).padEnd(4)} ${r.expr ? '[expr] ' : ''}${r.all.slice(0, 110)}`);
    console.log(`        ↳ ${r.hits.join(' ')}`);
  }
  console.log(`\n${rows.length} site(s) with inline appearance classes.`);
}
