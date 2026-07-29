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
const canonical = ds.canonicalizeCandidates(candidates);

const findings = [];
for (const [i, from] of candidates.entries()) {
  const to = canonical[i];
  if (!to || to === from) continue;
  // Equivalence proof: identical CSS means the rewrite is purely cosmetic.
  const before = ds.candidatesToCss([from])[0];
  const after = ds.candidatesToCss([to])[0];
  if (after == null) continue;   // canonical form isn't a real utility — nothing to suggest
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
