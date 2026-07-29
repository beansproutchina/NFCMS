/**
 * Commit gate for the admin front-end.
 *
 * Nine rules, each one earned by something this codebase actually got wrong (see
 * docs/commit-gate-plan.md for the counts). The point is not strictness — it is that "did I scan
 * everywhere?" becomes the machine's job. During the design-system refactor that question was
 * answered wrongly three times in a row, always the same way: an incomplete scan reported as a
 * complete result. So three constraints are baked in:
 *
 *   1. Class rules compare NORMALISED SETS, never literal strings — otherwise word-order variants
 *      slip through (one form label had five spellings) and cleanup never converges.
 *   2. Files are found by RECURSIVE WALK, never a hand-written directory list — a list missed
 *      `views/auth/` entirely.
 *   3. Files are read WHOLE, never split on `</template>` — that split hid the whole `<script>` of
 *      every file where the template comes first, turning 82 findings into a reported 62.
 *
 * Plus a self-check: it prints how many files it scanned and compares that with `git ls-files`.
 * A green report over three files is worse than no report at all.
 *
 *   node scripts/lint-admin.mjs            # report + exit 1 on new violations
 *   node scripts/lint-admin.mjs --list     # every violation, including baselined ones
 *   node scripts/lint-admin.mjs --update   # accept current state into the baseline
 */
import { __unstable__loadDesignSystem } from 'tailwindcss';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const TW = path.join(ROOT, 'node_modules/tailwindcss');
const BASELINE = path.join(ROOT, 'scripts/lint-baseline.json');

/** `views/front/templates` is a symlink to the active theme — walking it edits frontend_themes/. */
const SKIP_DIRS = new Set(['templates']);

// ── files ────────────────────────────────────────────────────────────────────────────────────────
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p); continue; }
    if (/\.(vue|ts)$/.test(e.name)) files.push(p);
  }
})(SRC);

// ── design system, for the two rules that need Tailwind's own answer ─────────────────────────────
const ds = await __unstable__loadDesignSystem(fs.readFileSync(path.join(SRC, 'style.css'), 'utf8'), {
  base: SRC,
  loadStylesheet: async (id) => {
    const f = id === 'tailwindcss' ? 'index.css' : id.replace(/^tailwindcss\//, '');
    return { base: TW, path: path.join(TW, f), content: fs.readFileSync(path.join(TW, f), 'utf8') };
  },
});
const cssOf = (c) => { try { return ds.candidatesToCss([c])[0]; } catch { return null; } };
const canonicalOf = (c) => { try { return ds.canonicalizeCandidates([c])[0]; } catch { return c; } };

// ── rule definitions ────────────────────────────────────────────────────────────────────────────
const PALETTE = /^(?:[a-z-]+:)*(text|bg|border|ring|divide|outline|placeholder|caret|accent|decoration|fill|stroke|from|via|to)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}$/;
const PALETTE_BW = /^(?:[a-z-]+:)*(text|bg|border)-black$/;
const BUILTIN_TEXT = /^(?:[a-z-]+:)*text-(xs|sm|base|lg|xl|[2-9]xl)$/;
const BUILTIN_RADIUS = /^(?:[a-z-]+:)*rounded(-[btlrse]+)?(-(sm|md|lg|xl|[2-9]xl))?$/;
const NATIVE_EL = /<(button|select|input|textarea)[\s>]/g;
const NATIVE_DIALOG = /(?<![\w.])\b(confirm|alert|prompt)\s*\(/g;
const CJK = /[一-鿿]+/g;
/** Layout is per-instance and stays inline; appearance belongs to the design system. */
const APPEARANCE = [
  /^(text|bg|border|ring|divide|outline|placeholder|caret|accent|decoration|fill|stroke)-(?!\[)[a-z]/,
  /^(rounded|shadow)(-|$)/,
  /^(font|leading|tracking)-/,
];
const APPEARANCE_NEUTRAL = new Set(['border', 'border-0', 'border-t', 'border-b', 'border-l', 'border-r', 'text-left', 'text-center', 'text-right', 'text-white', 'bg-white', 'bg-transparent', 'border-transparent', 'rounded-full', 'font-medium', 'font-semibold', 'font-normal', 'font-bold', 'font-mono', 'font-sans']);
const isAppearance = (c) => {
  const bare = c.replace(/^(?:[a-z-]+:)+/, '');
  return !APPEARANCE_NEUTRAL.has(bare) && APPEARANCE.some((re) => re.test(bare));
};

/**
 * Classes that legitimately produce no CSS: Tailwind's variant markers exist only to be referenced
 * by `group-hover:` / `peer-checked:`, so "generates nothing" is their whole job.
 */
const MARKER_CLASSES = new Set(['group', 'peer', 'dark', 'contents']);
/** A class defined in the file's own <style> block is a real class, just not a Tailwind one. */
const locallyDefined = (text) => new Set([...text.matchAll(/\.([a-zA-Z][\w-]*)\s*[,{:.]/g)].map((m) => m[1]));

/** Components Vue resolves on its own — no import needed. */
const VUE_BUILTINS = new Set(['RouterView', 'RouterLink', 'Transition', 'TransitionGroup', 'Teleport', 'KeepAlive', 'Suspense', 'Component', 'Slot']);

const findings = [];
const add = (rule, file, detail, line, hint) =>
  findings.push({ rule, file: path.relative(ROOT, file), detail, line, hint });

/**
 * Blank out comments, keeping every newline so line numbers still point at the real thing.
 *
 * Without this the gate is unusable: a Chinese comment (`// 过期时间戳`) reads as hardcoded UI copy,
 * a `w-[130px]` written in a doc-comment as a literal violation, and the words `useConfirm()` in
 * prose as a native dialog call. The first run produced 533 findings, almost all of them comments.
 */
function stripComments(text) {
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  return text
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    // `//` only when it doesn't follow a `:` — otherwise every https:// URL becomes a comment.
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, lead) => lead + blank(m.slice(lead.length)));
}

/**
 * Class tokens, split by how much we can trust them.
 *
 * `static` comes from `class="…"` and is unambiguous — every token there is meant to be a class.
 * `loose` comes from string literals inside `:class` expressions and preset definitions; those also
 * hold event names, i18n keys and API paths, so they feed only the rules that recognise a utility by
 * shape. R4 (dead class) must never read them: `app-error` is an event name, not a broken class.
 */
function classSources(text) {
  const staticAttrs = [];
  const loose = [];
  text.split('\n').forEach((line, i) => {
    // The lookbehind matters: `\bclass=` also matches the `class=` inside `:class=`, which made
    // every preset name (`LABEL_BARE`) look like a class that generates no CSS.
    for (const m of line.matchAll(/(?<![:@\w-])class="([^"]+)"/g)) staticAttrs.push({ line: i + 1, raw: m[1] });
    for (const m of line.matchAll(/'([^'\n]+)'/g)) {
      const v = m[1];
      // Utility-shaped: every token looks like `a-b`, a variant, or a bare word — and at least one
      // token carries a dash, so plain identifiers and sentences are excluded.
      const tokens = v.trim().split(/\s+/);
      if (tokens.length && tokens.every((t) => /^[a-z!]([a-z0-9:_./[\]()%!-]*)$/.test(t)) && tokens.some((t) => t.includes('-'))) {
        loose.push({ line: i + 1, raw: v });
      }
    }
  });
  return { staticAttrs, loose };
}

const clusters = new Map();

for (const file of files) {
  const text = stripComments(fs.readFileSync(file, 'utf8'));   // WHOLE file — see constraint 3
  const rel = path.relative(ROOT, file);
  const isPresets = rel.endsWith('ui/presets.ts');
  const isI18n = rel.endsWith('src/i18n.ts');
  const { staticAttrs, loose } = classSources(text);
  const ownClasses = locallyDefined(text);

  for (const { line, raw, trusted } of [...staticAttrs.map((s) => ({ ...s, trusted: true })), ...loose.map((s) => ({ ...s, trusted: false }))]) {
    const tokens = raw.split(/\s+/).filter(Boolean);
    const bare = new Set(tokens.filter((t) => !t.includes(':')));

    for (const t of tokens) {
      if (/[{}$?]/.test(t)) continue;
      // R2 — built-in palette bypass. Tailwind considers these canonical, so R1 cannot see them.
      if (PALETTE.test(t) || PALETTE_BW.test(t)) { add('R2-palette', file, t, line, '改用项目令牌(label/canvas/accent/danger…)'); continue; }
      // R3 — built-in scale bypass. The project has its own type and radius scales.
      if (BUILTIN_TEXT.test(t)) { add('R3-scale', file, t, line, '改用 text-small / text-body / text-title-*'); continue; }
      if (BUILTIN_RADIUS.test(t)) { add('R3-scale', file, t, line, '改用 rounded-chip / rounded-control / rounded-card'); continue; }
      // R5 — a hover/focus that equals its own base state does nothing at all.
      const v = /^(hover|focus|active|group-hover):(.+)$/.exec(t);
      if (v && bare.has(v[2])) { add('R5-noop-state', file, t, line, `与基态 ${v[2]} 同值,该状态无效果`); continue; }
      const css = cssOf(t);
      // R4 — generates no CSS at all. `font-display` lived in six files like this. Only judged for
      // `class="…"`, never for loose string literals: those legitimately hold non-class strings.
      if (css == null) { if (trusted && !MARKER_CLASSES.has(t) && !ownClasses.has(t)) add('R4-dead-class', file, t, line, '该类生成不出任何 CSS —— 令牌不存在或拼写错误'); continue; }
      // R1 — a literal that has a token. Tailwind's own canonicaliser decides.
      const canon = canonicalOf(t);
      if (canon && canon !== t) add('R1-literal', file, t, line, `→ ${canon}`);
    }

    // R11 (warning only) — repeated appearance combinations, compared as SETS (constraint 1).
    // Static attributes only: a preset's own definition is not a duplicate of itself.
    const appearance = trusted ? [...new Set(tokens.filter(isAppearance))].sort() : [];
    if (appearance.length >= 2) {
      const key = appearance.join(' ');
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key).push(rel);
    }
  }

  // R10 — the single source of truth must not itself bypass the tokens.
  if (isPresets) {
    // Appearance literals only — a one-off layout dimension inside a preset is fine (plan §7),
    // it is colour / type / radius / shadow that must come from a token.
    for (const m of text.matchAll(/(?:text|rounded|shadow|leading|bg|border|ring|fill|stroke)(?:-[a-z]+)?-\[(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|\d+px)\]/g)) {
      add('R10-preset-literal', file, m[1], text.slice(0, m.index).split('\n').length, 'preset 自身必须使用令牌');
    }
  }

  /**
   * R6 — native form elements. A native `<button>` is NOT automatically wrong: a list row, a tab and
   * a nav tile are semantically buttons or links, and forcing them through PrimeVue would give a
   * navigation tile button semantics. What IS wrong is a native element styled by hand. So the rule
   * is "native element not wearing a preset", and `class="hidden"` (a hidden file input, a submit
   * button that only exists so Enter works) passes untouched.
   */
  for (const m of text.matchAll(NATIVE_EL)) {
    const tag = text.slice(m.index, text.indexOf('>', m.index) + 1);
    if (/\bclass="hidden"/.test(tag) || /\bhidden\b/.test(tag) && /class="[^"]*\bhidden\b/.test(tag)) continue;
    if (/:class="[A-Z_]/.test(tag)) continue;               // wears a preset
    add('R6-native-el', file, `<${m[1]}>`, text.slice(0, m.index).split('\n').length, '原生元素必须走 preset,或换 unstyled PrimeVue 组件');
  }

  // R7 — native dialogs. CLAUDE.md forbids these outright.
  for (const m of text.matchAll(NATIVE_DIALOG)) {
    if (text.slice(Math.max(0, m.index - 14), m.index).includes('useConfirm')) continue;
    add('R7-native-dialog', file, m[1], text.slice(0, m.index).split('\n').length, '改用 useConfirm() / toast');
  }

  /**
   * R12 — a PascalCase tag with nothing importing it.
   *
   * Vue renders an unknown component as a literal custom element: zero size, and every binding falls
   * through as a plain attribute, so `:pt="OBJ"` lands in the DOM as `pt="[object Object]"`. Neither
   * `vue-tsc` nor `vite build` says a word — the admin's "置顶" checkbox shipped as a 0×0 nothing
   * exactly this way. Cheap to check, and it catches a whole class of silent breakage.
   */
  if (rel.endsWith('.vue')) {
    const template = text.slice(text.indexOf('<template'), text.indexOf('</template>'));
    for (const m of template.matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/g)) {
      const tag = m[1];
      if (VUE_BUILTINS.has(tag)) continue;
      // Imported, destructured from an import, declared locally (`const X = defineComponent(…)`),
      // or the component referring to itself — Vue resolves a self-reference by filename.
      const script = text.slice(text.indexOf('<script'));
      const selfRef = path.basename(file, '.vue') === tag;
      const declared = selfRef || new RegExp(`\\b(?:import\\s+${tag}\\b|${tag}\\s*[,}]|(?:const|let|var|function)\\s+${tag}\\b)`).test(script);
      if (!declared) add('R12-unimported', file, `<${tag}>`, template.slice(0, m.index).split('\n').length + text.slice(0, text.indexOf('<template')).split('\n').length - 1, '组件未导入 —— 会渲染成 0×0 的未知元素,绑定退化为普通属性');
    }
  }

  // R8 — hardcoded copy.
  if (!isI18n) {
    for (const m of text.matchAll(CJK)) {
      const ctx = text.slice(Math.max(0, m.index - 50), m.index + m[0].length + 12);
      if (ctx.includes('$t(') || ctx.includes("t('")) continue;
      add('R8-hardcoded-text', file, m[0].slice(0, 16), text.slice(0, m.index).split('\n').length, '文案进 i18n.ts 的 en + zh');
    }
  }
}

// ── baseline ────────────────────────────────────────────────────────────────────────────────────
const fingerprint = (f) => `${f.rule}|${f.file}|${f.detail}`;
const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : { accepted: [] };
const accepted = new Set(baseline.accepted);
const fresh = findings.filter((f) => !accepted.has(fingerprint(f)));
const stale = [...accepted].filter((a) => !findings.some((f) => fingerprint(f) === a));

if (process.argv.includes('--update')) {
  const next = { _note: 'Accepted violations. Adding a line here is a visible act that goes through review — it is the intended way to grant an exemption. Run lint-admin.mjs --update to re-tighten.', accepted: [...new Set(findings.map(fingerprint))].sort() };
  fs.writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`baseline updated: ${next.accepted.length} accepted violation(s).`);
  process.exit(0);
}

// ── self-check (constraint: never trust a green report without knowing the denominator) ──────────
let expected = null;
try {
  expected = execFileSync('git', ['ls-files', 'src'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter((l) => /\.(vue|ts)$/.test(l) && !l.includes('views/front/templates')).length;
} catch { /* not a git checkout — skip */ }

const show = process.argv.includes('--list') ? findings : fresh;
const byRule = new Map();
for (const f of show) { if (!byRule.has(f.rule)) byRule.set(f.rule, []); byRule.get(f.rule).push(f); }
for (const [rule, list] of [...byRule].sort()) {
  console.log(`\n${rule}  (${list.length})`);
  for (const f of list.slice(0, 20)) console.log(`  ${f.file}:${f.line}  ${f.detail}\n      ↳ ${f.hint}`);
  if (list.length > 20) console.log(`  … 另 ${list.length - 20} 处`);
}

// R11 — warning only: the threshold is a judgement call, and blocking on it is pure friction.
const repeats = [...clusters].filter(([, v]) => v.length >= 4).sort((a, b) => b[1].length - a[1].length);
if (repeats.length) {
  console.log(`\nR11-repeat  (${repeats.length}, 仅提示不拦)`);
  for (const [key, sites] of repeats.slice(0, 8)) console.log(`  ×${sites.length}  ${key}\n      ↳ 考虑提成 preset`);
}

console.log(`\nscanned ${files.length} file(s)${expected != null ? ` (git ls-files: ${expected})` : ''}`);
if (expected != null && files.length !== expected) {
  console.error(`\n✗ 扫描数与 git 记录不符 —— 检测本身可能漏了文件,先修这个再看结论。`);
  process.exit(2);
}
if (stale.length) console.log(`${stale.length} baseline entr(ies) no longer occur — run --update to tighten.`);

if (fresh.length) {
  console.error(`\n✗ ${fresh.length} 处新违规。修掉,或在 scripts/lint-baseline.json 里显式接受(会进 review)。`);
  process.exit(1);
}
console.log('✓ no new violations.');
