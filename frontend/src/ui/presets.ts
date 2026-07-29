/**
 * Admin design-system presets — the single source of truth for form controls.
 *
 * The admin UI runs PrimeVue in `unstyled` mode and styles every control with
 * Tailwind. Instead of re-writing the same class strings (or hand-rolling native
 * <select>/<input>), import these presets:
 *
 *   <Select unstyled :pt="SELECT_PT" ... />
 *   <DatePicker unstyled :pt="DATEPICKER_PT" ... />
 *   <InputText unstyled :class="INPUT_CLASS" ... />
 *   <Button unstyled :class="BTN.primary" ... />
 *
 * Per-instance tweaks (width, flex) go on the component's own `class` — PrimeVue
 * merges it into the root element, so `class="flex-1"` composes with SELECT_PT.root.
 */

/** Shared visual base for text inputs / select triggers (flat Apple-style field). */
const FIELD_BASE =
  'h-10 px-3 bg-white text-body text-label border border-separator rounded-control ' +
  'transition-shadow focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent';

/** Plain text input (InputText / Textarea / Password inner input). Full width by default. */
export const INPUT_CLASS = `w-full ${FIELD_BASE}`;

/** Compact variant for dense toolbars (h-9, smaller text). */
export const INPUT_CLASS_SM =
  'w-full h-9 px-3 bg-white text-small text-label border border-separator rounded-control ' +
  'transition-shadow focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent';

/**
 * Unstyled PrimeVue Select passthrough.
 * Width is intentionally NOT set here — give the component its own width via `class`
 * (e.g. `class="w-full"` for a form field, `class="flex-1 min-w-0"` or `class="w-[130px]"`
 * in a flex row). A width baked into the preset would fight per-instance widths and overflow.
 */
export const SELECT_PT = {
  root: `${FIELD_BASE} flex items-center justify-between gap-2 cursor-pointer relative`,
  label: 'truncate',
  dropdown: 'w-4 h-4 opacity-50 shrink-0',
  overlay: 'bg-white border border-separator rounded-control shadow-lg mt-1 py-1 z-9999 overflow-hidden',
  listContainer: 'max-h-[260px] overflow-auto',
  option: ({ context }: any) => ({
    class: [
      'px-3 py-2 text-body cursor-pointer',
      context?.selected ? 'bg-accent text-white' : 'text-label hover:bg-canvas',
    ],
  }),
  emptyMessage: 'px-3 py-2 text-body text-label-3',
};

/** Unstyled PrimeVue DatePicker passthrough (input + calendar panel + time picker). */
export const DATEPICKER_PT = {
  // Width comes from the caller's own class (e.g. `class="flex-1"` / `class="w-full"`);
  // the inner input keeps w-full so it fills whatever width the root is given.
  root: 'relative inline-flex',
  pcInputText: { root: `${FIELD_BASE} w-full cursor-pointer` },
  panel: 'bg-white border border-separator rounded-control shadow-xl p-3 mt-1 z-9999',
  header: 'flex items-center justify-between mb-2',
  pcPrevButton: { root: 'w-8 h-8 rounded-full flex items-center justify-center hover:bg-canvas cursor-pointer text-label-2' },
  pcNextButton: { root: 'w-8 h-8 rounded-full flex items-center justify-center hover:bg-canvas cursor-pointer text-label-2' },
  title: 'flex items-center gap-1 font-medium text-body',
  selectMonth: 'px-2 py-1 rounded-control hover:bg-canvas cursor-pointer',
  selectYear: 'px-2 py-1 rounded-control hover:bg-canvas cursor-pointer',
  dayView: 'w-full border-collapse',
  weekDay: 'text-small text-label-3 font-normal w-9 h-9',
  dayCell: 'p-0 text-center',
  day: ({ context }: any) => ({
    class: [
      'w-9 h-9 rounded-full text-small flex items-center justify-center cursor-pointer mx-auto',
      context?.selected ? 'bg-accent text-white'
        : context?.disabled ? 'opacity-30 cursor-default'
        : 'hover:bg-canvas text-label',
    ],
  }),
  monthView: 'grid grid-cols-3 gap-2 p-1',
  month: ({ context }: any) => ({ class: ['py-2 rounded-control text-small cursor-pointer text-center', context?.selected ? 'bg-accent text-white' : 'hover:bg-canvas'] }),
  yearView: 'grid grid-cols-2 gap-2 p-1',
  year: ({ context }: any) => ({ class: ['py-2 rounded-control text-small cursor-pointer text-center', context?.selected ? 'bg-accent text-white' : 'hover:bg-canvas'] }),
  timePicker: 'flex items-center justify-center gap-2 mt-3 pt-3 border-t border-separator-weak',
  hourPicker: 'flex flex-col items-center w-10 text-body',
  minutePicker: 'flex flex-col items-center w-10 text-body',
  secondPicker: 'flex flex-col items-center w-10 text-body',
  separatorContainer: 'flex flex-col items-center',
  pcIncrementButton: { root: 'w-7 h-7 rounded-control flex items-center justify-center hover:bg-canvas cursor-pointer' },
  pcDecrementButton: { root: 'w-7 h-7 rounded-control flex items-center justify-center hover:bg-canvas cursor-pointer' },
  buttonbar: 'flex items-center justify-between mt-3 pt-2 border-t border-separator-weak',
  pcTodayButton: { root: 'text-small text-accent hover:underline cursor-pointer' },
  pcClearButton: { root: 'text-small text-label-3 hover:underline cursor-pointer' },
};

/**
 * Buttons. Three of them, and deliberately no fourth.
 *
 * There is exactly ONE neutral button: filled grey with a border. It used to be called `ghost`,
 * which was a lie — a ghost button has no fill and no border — and the lie had a cost: AdminModal
 * hand-rolled a genuinely transparent, borderless cancel, so the same "cancel" read as grey-with-a
 * -border in one dialog and invisible in the next. Two neutral styles at near-identical emphasis is
 * the ambiguity, not the solution; macOS alerts settle it the same way, with a filled grey Cancel
 * beside a filled blue OK.
 *
 * So: `primary` for the action, `secondary` for everything neutral, `danger` when the neutral one
 * needs to read as destructive. Size lives in BTN_BASE — do not re-specify padding at the call site,
 * that is how two dialogs ended up with different button heights.
 */
const BTN_BASE = 'inline-flex items-center justify-center gap-2 h-9 px-4 rounded-control text-body font-medium cursor-pointer transition-colors focus:outline-none disabled:opacity-50';
export const BTN = {
  /** The action being confirmed. One per view. */
  primary: `${BTN_BASE} bg-accent hover:bg-accent-hover text-white border border-transparent`,
  /** Every neutral action: cancel, preview, save-draft, test-connection. */
  secondary: `${BTN_BASE} bg-surface hover:bg-surface-hover text-label border border-separator-weak`,
  /** `secondary` re-tinted for a destructive action; same weight, different colour. */
  danger: `${BTN_BASE} bg-surface hover:bg-surface-hover text-warn border border-separator-weak`,
};

/** Low-emphasis buttons that BTN's three tiers don't cover. */
export const BTN_SMALL = {
  /** Pagination step in a picker footer (FilePicker, UserPicker — 4 copies before this). */
  pager: 'text-small px-3 h-8 rounded-control border border-separator hover:bg-canvas disabled:opacity-40 cursor-pointer',
  /** Round icon button floating over a thumbnail (Files.vue — 2 copies). */
  icon: 'w-10 h-10 rounded-full bg-white flex items-center justify-center text-accent hover:scale-110 transition-transform cursor-pointer',
  /** Segmented on/off cell for a permission bit (AclEditor, Roles). Pair with the on/off classes. */
  toggle: 'px-2.5 h-8 rounded-control text-small border cursor-pointer transition-colors',
  toggleOn: 'bg-accent text-white border-accent',
  toggleOff: 'bg-white text-label-2 border-separator hover:bg-canvas',
};

/** The ✕ in a dialog header. Shared so AdminModal and the pickers can't drift apart again. */
export const DIALOG_CLOSE =
  'text-label-3 hover:text-label focus:outline-none transition-colors cursor-pointer shrink-0';

/**
 * Page shell. Every list page repeated these three strings — the container 9 times, the title 10,
 * and the header row in three different spellings.
 */
export const PAGE = {
  container: 'max-w-7xl mx-auto py-10 w-full px-6',
  title: 'text-title-page font-semibold leading-title tracking-tight mb-2',
  subtitle: 'text-body text-label-3',
  /** The responsive spelling won: the two non-responsive variants stacked badly on narrow screens. */
  header: 'flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 gap-4',
};

/**
 * Form field labels. This was the single largest duplication in the admin: one label, FIVE
 * spellings, 33 occurrences — `block … mb-1`, `… mb-2`, no-margin, and a `px-1` variant.
 */
export const LABEL = 'block text-body font-medium text-label mb-1';
/** Same type, no spacing — for when the surrounding layout owns the gap. */
export const LABEL_BARE = 'block text-body font-medium text-label';
/** Label + control stacked. 18 copies, half of them with `max-w-lg` bolted on. */
export const FIELD_GROUP = 'flex flex-col gap-2';
/** The red asterisk after a required label. */
export const REQUIRED_MARK = 'text-danger';

/** A white content card. `shadow-card` is the one card shadow this UI has. */
export const CARD = 'bg-white rounded-card shadow-card border border-separator-weak overflow-hidden';
/** Section heading inside a card or dialog. */
export const SECTION_TITLE = 'text-title-section font-semibold';

/** Dashboard quick-link tile (4 copies). A link by nature — put it on a router-link, not a button. */
export const TILE =
  'flex flex-col items-center justify-center gap-2 p-4 rounded-card bg-canvas hover:bg-surface-hover ' +
  'transition-colors text-label border-0 cursor-pointer';

/**
 * Status / role chips. `tone` picks the tint; the shape is fixed so chips never drift.
 * Categorical role colours stay on Tailwind's palette on purpose — see the note on DECORATIVE below.
 */
const CHIP_BASE = 'inline-flex items-center px-2 py-0.5 rounded-control text-small font-medium';
export const CHIP = {
  neutral: `${CHIP_BASE} bg-canvas text-label-2`,
  info: `${CHIP_BASE} bg-info-fill text-link`,
  warn: `${CHIP_BASE} bg-warn-fill text-warn`,
  accent: `${CHIP_BASE} bg-indigo-fill text-indigo`,
};

/** Inline row actions in a table. Two tones, 3 copies each before this. */
export const LINK = {
  action: 'text-link hover:underline text-body flex items-center cursor-pointer',
  danger: 'text-danger hover:underline text-body flex items-center cursor-pointer',
};

/** Search field: the magnifier sits inside the input, so the input needs the left padding. */
export const SEARCH = {
  icon: 'absolute left-3 top-1/2 -translate-y-1/2 opacity-40',
  /** Use as `:class="[INPUT_CLASS, SEARCH.input]"`. */
  input: 'pl-9',
};

/** Sidebar navigation row (admin/Layout). Pair with the active/idle classes. */
export const NAV_ITEM = {
  base: 'flex items-center gap-3 px-3 py-2 rounded-control transition-colors w-full text-left cursor-pointer',
  active: 'bg-fill-strong text-label font-semibold',
  idle: 'text-label hover:bg-fill',
};

/** "Nothing here yet" placeholder. Was written three different ways. */
export const EMPTY = 'text-center py-10 text-body text-label-3';

/**
 * DECORATIVE / CATEGORICAL colours are deliberately NOT tokens.
 *
 * A dashboard stat icon's colour identifies which metric it is; a role chip's tint identifies which
 * role. That is data identity, not design semantics, and naming them `--color-cat-1..5` would be
 * less readable than `text-blue-500`, not more. So Tailwind's palette is allowed for this one job —
 * on icons and chip tints — and nowhere else. Keep such colours in ONE place per view (Dashboard
 * already declares them in its stats array) rather than sprinkled through the template.
 */

/**
 * Unstyled passthrough for the global `<ConfirmDialog>`.
 *
 * PrimeVue runs on the Aura theme here and components opt out of it one by one with `unstyled`.
 * `<ConfirmDialog>` in App.vue never did, so the one dialog CLAUDE.md tells everyone to use — via
 * `useConfirm()`, in place of native `confirm()` — was also the one control ignoring the design
 * system entirely, right down to Aura's green buttons.
 *
 * Section names come from ConfirmDialog (`icon`, `message`, `pcRejectButton`, `pcAcceptButton`) plus
 * the Dialog it wraps (`mask`, `root`, `header`, `title`, `content`, `footer`, `pcCloseButton`).
 * Deliberately mirrors AdminModal.vue so both dialogs read as the same object.
 */
export const CONFIRM_PT = {
  // Above the pickers (z-60) — a confirm can be raised from inside one.
  mask: 'fixed inset-0 z-70 flex items-center justify-center bg-scrim backdrop-blur-sm p-4',
  root: 'bg-white rounded-card shadow-2xl w-full max-w-md flex flex-col',
  header: 'px-6 pt-6 pb-4 flex items-start justify-between gap-4',
  title: 'text-title-section font-semibold',
  pcCloseButton: { root: DIALOG_CLOSE },
  content: 'px-6 pb-6 flex items-start gap-3',
  // The severity icon is decorative; the message already says everything.
  icon: 'hidden',
  message: 'text-body text-label-2 leading-relaxed',
  footer: 'px-6 pb-6 flex justify-end gap-3',
  pcRejectButton: { root: BTN.secondary },
  pcAcceptButton: { root: BTN.primary },
};
