/**
 * Tailwind class audit — finds classes that should be written as design-system tokens.
 *
 * Detection is delegated to Tailwind itself rather than to regexes, so it cannot miss cases:
 *   - `@tailwindcss/oxide`'s `Scanner` extracts every class candidate the compiler would see
 *     (including ones inside `:class` arrays, template literals and `presets.ts` strings).
 *   - `designSystem.canonicalizeCandidates()` is the same API the Tailwind language server and
 *     Prettier plugin use. It rewrites a candidate to its canonical spelling, which is exactly the
 *     "arbitrary value → token" mapping we want: `text-[14px]` → `text-sm`,
 *     `bg-[#f5f5f7]` → `bg-apple-gray` (because that token exists in `@theme`).
 *   - `designSystem.candidatesToCss()` then PROVES a rewrite is safe: old and new must compile to
 *     byte-identical CSS declarations, so a wrong mapping (say `rounded-[8px]` → `rounded-md`,
 *     which is 6px) fails loudly instead of silently changing the design.
 *
 * Usage:
 *   node scripts/audit-classes.mjs               # report only
 *   node scripts/audit-classes.mjs --json        # machine-readable
 *   node scripts/audit-classes.mjs --check       # exit 1 if anything is non-canonical (CI / lint)
 *   node scripts/audit-classes.mjs --fix         # rewrite the css-equivalent ones in place
 *
 * `--fix` only touches rewrites proven css-equivalent. Anything else (merging 13px into 12px, say)
 * changes how the UI looks and is a decision for a human, so it is reported and left alone.
 */
import { __unstable__loadDesignSystem } from 'tailwindcss';
import { Scanner } from '@tailwindcss/oxide';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TW = path.join(ROOT, 'node_modules/tailwindcss');
const ENTRY_CSS = path.join(ROOT, 'src/style.css');

/** Directories audited. Themes are included: they hardcode the same way the admin does. */
const SOURCES = [
  { base: path.join(ROOT, 'src'), pattern: '**/*.{vue,ts}', negated: false },
  { base: path.resolve(ROOT, '../frontend_themes'), pattern: '**/*.{vue,ts}', negated: false },
];

async function loadDesignSystem() {
  return __unstable__loadDesignSystem(fs.readFileSync(ENTRY_CSS, 'utf8'), {
    base: path.join(ROOT, 'src'),
    loadStylesheet: async (id, base) => {
      const file = id === 'tailwindcss' ? 'index.css' : id.replace(/^tailwindcss\//, '');
      return { base: TW, path: path.join(TW, file), content: fs.readFileSync(path.join(TW, file), 'utf8') };
    },
  });
}

/** Every class candidate in the audited sources, with the files each one appears in. */
function collectCandidates() {
  const where = new Map();
  for (const source of SOURCES) {
    if (!fs.existsSync(source.base)) continue;
    const scanner = new Scanner({ sources: [source] });
    for (const candidate of scanner.scan()) {
      if (!where.has(candidate)) where.set(candidate, new Set());
    }
    // `scanner.files` is only populated after a scan; re-scan per file to attribute candidates.
    for (const file of scanner.files) {
      const per = new Scanner({ sources: [{ base: path.dirname(file), pattern: path.basename(file), negated: false }] });
      for (const candidate of per.scan()) {
        if (where.has(candidate)) where.get(candidate).add(path.relative(ROOT, file));
      }
    }
  }
  return where;
}

const ds = await loadDesignSystem();
const where = collectCandidates();

/**
 * The scanner is deliberately greedy — it yields every token that *could* be a class and lets the
 * compiler drop the rest, so raw JS identifiers (`const`, `import`, `setup`) come through too.
 * Keep only candidates that actually compile to CSS; anything else is not a class at all.
 */
const candidates = [...where.keys()].filter((c) => ds.candidatesToCss([c])[0] != null);

/**
 * One candidate per call. `canonicalizeCandidates` DEDUPLICATES its result — feed it
 * `['bg-[#f5f5f7]', 'bg-canvas']` and two inputs come back as one output — so a batch is not
 * index-aligned with its input and zipping the two lists silently produces nonsense mappings
 * (`border` → `border-0`, `flex` → `flex-1`).
 */
const canonicalOf = (c) => ds.canonicalizeCandidates([c])[0];

/**
 * Compare two utilities by the values they *resolve to*, not by their CSS text.
 *
 * `bg-[#f5f5f7]` emits `background-color: #f5f5f7` while `bg-canvas` emits
 * `background-color: var(--color-canvas)` — different text, identical result. So substitute every
 * `var(--token)` for its theme value first. What survives this comparison is a real difference:
 * `text-[13px]` vs `text-small` stays 13px vs 12px, and gets left for a human.
 */
const resolved = (css) => {
  if (css == null) return null;
  // Drop the outer selector: it is derived from the class name and so always differs
  // (`.text-\[14px\]` vs `.text-body`). Only the declarations decide equivalence.
  const open = css.indexOf('{');
  const body = open === -1 ? css : css.slice(open + 1, css.lastIndexOf('}'));
  return body
    .replace(/var\((--[a-z0-9-]+)\)/gi, (m, name) => ds.resolveThemeValue(name) ?? m)
    .replace(/\s+/g, ' ')
    // `rgba(0,0,0,.4)` and `rgba(0, 0, 0, .4)` are the same colour; the class writes one form and
    // the token definition the other, and that spacing is the only thing left between them.
    .replace(/,\s+/g, ',')
    .trim();
};

const findings = [];
for (const from of candidates) {
  const to = canonicalOf(from);
  if (!to || to === from) continue;
  const beforeCss = ds.candidatesToCss([from])[0];
  const afterCss = ds.candidatesToCss([to])[0];
  if (afterCss == null) continue;   // canonical form isn't a real utility — nothing to suggest
  const before = resolved(beforeCss);
  const after = resolved(afterCss);
  findings.push({
    from,
    to,
    equivalent: before === after,
    before,
    after,
    files: [...(where.get(from) ?? [])].sort(),
  });
}

findings.sort((a, b) => b.files.length - a.files.length || a.from.localeCompare(b.from));

if (process.argv.includes('--fix')) {
  /**
   * Themes are reported but not rewritten unless asked. They carry their own token systems
   * (neo has tokens.css) and are a separate job — see docs/design-system-refactor.md §7.
   */
  const themesToo = process.argv.includes('--include-themes');
  const inScope = (rel) => themesToo || !rel.startsWith('..');
  const safe = findings
    .map((f) => ({ ...f, files: f.files.filter(inScope) }))
    .filter((f) => f.equivalent && f.files.length);
  // Longest first: rewriting `text-[14px]` before `text-[14px]/5` would corrupt the latter.
  safe.sort((a, b) => b.from.length - a.from.length);
  const touched = new Map();
  for (const { from, to, files } of safe) {
    for (const rel of files) {
      const abs = path.join(ROOT, rel);
      const before = touched.get(abs) ?? fs.readFileSync(abs, 'utf8');
      // Class candidates sit between quotes, whitespace, backticks or `[`/`]` of a :class array.
      // Bounding on those keeps `bg-canvas` from matching inside e.g. `bg-canvas-alt`.
      const pattern = new RegExp(`(^|[\\s"'\`\\[])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[\\s"'\`\\]]|$)`, 'g');
      touched.set(abs, before.replace(pattern, (_m, lead) => `${lead}${to}`));
    }
  }
  let changed = 0;
  for (const [abs, content] of touched) {
    if (content !== fs.readFileSync(abs, 'utf8')) { fs.writeFileSync(abs, content); changed += 1; }
  }
  console.log(`--fix: applied ${safe.length} css-equivalent rewrite(s) across ${changed} file(s).`);
  const notEquivalent = findings.filter((f) => !f.equivalent).length;
  if (notEquivalent) console.log(`${notEquivalent} finding(s) skipped — not css-equivalent, a human must decide.`);
  const themeOnly = findings.length - safe.length - notEquivalent;
  if (themeOnly) console.log(`${themeOnly} finding(s) skipped — only occur in themes (pass --include-themes).`);
  process.exit(0);
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(findings, null, 2));
} else {
  const unsafe = findings.filter((f) => !f.equivalent);
  console.log(`${findings.length} non-canonical class${findings.length === 1 ? '' : 'es'} (${candidates.length} scanned)\n`);
  for (const f of findings) {
    console.log(`  ${f.equivalent ? '=' : '!'} ${f.from}  →  ${f.to}`);
    console.log(`      ${f.files.length} file(s): ${f.files.slice(0, 4).join(', ')}${f.files.length > 4 ? ' …' : ''}`);
    if (!f.equivalent) console.log(`      ⚠ CSS differs — do NOT auto-replace\n        before: ${f.before}\n        after:  ${f.after}`);
  }
  if (unsafe.length) console.log(`\n${unsafe.length} rewrite(s) are NOT css-equivalent and need a human decision.`);
}

if (process.argv.includes('--check') && findings.length) process.exit(1);
