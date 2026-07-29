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

/**
 * How a field LOOKS, with no size in it — height belongs to the specific control.
 *
 * Split out because folding a textarea onto INPUT_CLASS pinned it to `h-10`: one line tall, unable
 * to grow. A single-line input wants a fixed height; a textarea wants a minimum and room to expand.
 */
const FIELD_SKIN =
  'bg-white text-body text-label border border-separator rounded-control ' +
  'transition-shadow focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent';

/** Shared visual base for single-line inputs / select triggers (flat Apple-style field). */
const FIELD_BASE = `h-10 px-3 ${FIELD_SKIN}`;

/** Plain single-line text input (InputText / Password inner input). Full width by default. */
export const INPUT_CLASS = `w-full ${FIELD_BASE}`;

/**
 * Multi-line field. `field-sizing-content` grows it with its content in browsers that support it,
 * and `resize-y` leaves the user a handle everywhere else. Never give a textarea a fixed `h-*`.
 */
export const TEXTAREA_CLASS = `w-full min-h-24 px-3 py-2 field-sizing-content resize-y ${FIELD_SKIN}`;
/** Same, for code / JSON payloads. */
export const TEXTAREA_CLASS_MONO = `${TEXTAREA_CLASS} font-mono text-small`;

/** Compact variant for dense toolbars (h-9, smaller text). */
export const INPUT_CLASS_SM =
  'w-full h-9 px-3 bg-white text-small text-label border border-separator rounded-control ' +
  'transition-shadow focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent';

/**
 * The onboarding field: Login and the setup wizard, full-screen and one question at a time.
 *
 * Not a copy of INPUT_CLASS with tweaks — a different control. Grey filled, borderless, 17px, and it
 * turns white on focus, which is Apple's own sign-in treatment. Forcing these onto the admin's
 * white-bordered 14px field would shrink those pages into a settings form. Five hand-written copies
 * before this.
 */
export const INPUT_CLASS_LG =
  'w-full bg-canvas text-label border border-transparent rounded-control py-4 px-4 text-title-item ' +
  'focus:outline-none focus:border-accent focus:bg-white focus:ring-1 focus:ring-accent transition-all';

/**
 * Password field on the onboarding pages: the large field plus the show/hide eye.
 * Login and the setup wizard had identical copies of both the class and the icon passthrough.
 */
export const PASSWORD_LG = {
  inputClass: `${INPUT_CLASS_LG} relative`,
  pt: {
    root: 'relative w-full',
    maskIcon: 'absolute right-4 top-1/2 -translate-y-1/2 opacity-50 cursor-pointer w-5 h-5',
    unmaskIcon: 'absolute right-4 top-1/2 -translate-y-1/2 opacity-50 cursor-pointer w-5 h-5',
  },
};

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
const BTN_SHAPE = 'inline-flex items-center justify-center gap-2 rounded-control font-medium cursor-pointer transition-colors focus:outline-none disabled:opacity-50';
/**
 * Colour is a separate axis from size, so a dense inline button can't become a new colour by
 * accident. That is how a blue-text-on-pale-blue button appeared in MenuEditor and MenuItemEditor:
 * the system had no small size, so those two call sites invented a whole fourth style — and its
 * `bg-info-fill hover:bg-info-fill` didn't even hover.
 */
const BTN_TONE = {
  primary: 'bg-accent hover:bg-accent-hover text-white border border-transparent',
  secondary: 'bg-surface hover:bg-surface-hover text-label border border-separator-weak',
  danger: 'bg-surface hover:bg-surface-hover text-danger border border-separator-weak',
};

/** Standard size. */
export const BTN = {
  /** The action being confirmed. One per view. */
  primary: `${BTN_SHAPE} h-9 px-4 text-body ${BTN_TONE.primary}`,
  /** Every neutral action: cancel, preview, save-draft, test-connection. */
  secondary: `${BTN_SHAPE} h-9 px-4 text-body ${BTN_TONE.secondary}`,
  /** `secondary` re-tinted for a destructive action; same weight, different colour. */
  danger: `${BTN_SHAPE} h-9 px-4 text-body ${BTN_TONE.danger}`,
};

/** Dense size, for buttons living inside a row: `+ add`, pagination steps, inline actions. */
export const BTN_SM = {
  primary: `${BTN_SHAPE} h-8 px-3 text-small ${BTN_TONE.primary}`,
  secondary: `${BTN_SHAPE} h-8 px-3 text-small ${BTN_TONE.secondary}`,
  danger: `${BTN_SHAPE} h-8 px-3 text-small ${BTN_TONE.danger}`,
};

/**
 * Round icon button floating over a thumbnail (Files.vue). Two tones, because the delete one had to
 * be hand-written while this preset hardcoded a white face — that is how a preset grows a bypass.
 */
const BTN_ICON_SHAPE = 'w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform cursor-pointer';
export const BTN_ICON = {
  plain: `${BTN_ICON_SHAPE} bg-white text-accent`,
  danger: `${BTN_ICON_SHAPE} bg-danger text-white hover:bg-danger-hover`,
  /** Smaller, quieter round button — closing a drawer or a floating panel. */
  subtle: 'w-8 h-8 rounded-full flex items-center justify-center bg-canvas hover:bg-surface-hover text-label-2 hover:text-label cursor-pointer transition-colors',
};

/**
 * "Remove this row" — the inline ✕ or trash next to a repeatable item.
 *
 * One style, because there were five: red text with a real hover, red text with a hover that did
 * nothing, red text that flipped to a solid red block on hover, and one that only changed opacity
 * and never showed a colour at all. A destructive affordance has to react, and it has to react the
 * same way everywhere, or people stop trusting that they clicked the right thing.
 */
export const BTN_REMOVE =
  'text-danger hover:text-danger-hover transition-colors cursor-pointer focus:outline-none shrink-0';

/** Segmented on/off cell for a permission bit (AclEditor, Roles). */
export const TOGGLE = {
  base: 'px-2.5 h-8 rounded-control text-small border cursor-pointer transition-colors',
  on: 'bg-accent text-white border-accent',
  off: 'bg-white text-label-2 border-separator hover:bg-canvas',
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
/**
 * Clickable text. Apple's split: text links take the LINK colour, filled controls take accent — so
 * `text-accent hover:underline` (10 call sites) was the wrong token for a link, and left the admin
 * with two spellings of the same thing. `inline-flex` rather than `flex` so these also work mid-sentence.
 */
export const LINK = {
  action: 'text-link hover:underline text-body cursor-pointer inline-flex items-center gap-1',
  danger: 'text-danger hover:text-danger-hover hover:underline text-body cursor-pointer inline-flex items-center gap-1',
  small: 'text-link hover:underline text-small cursor-pointer inline-flex items-center gap-1',
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

/** Unstyled PrimeVue Checkbox — replaces the two hand-rolled native ones. */
export const CHECKBOX_PT = {
  root: 'relative inline-flex w-5 h-5 shrink-0 cursor-pointer align-middle',
  // The real input sits on top, invisible, so the whole box stays clickable and keyboard-reachable.
  input: 'absolute inset-0 w-full h-full opacity-0 cursor-pointer m-0',
  /**
   * Driven by `context.checked`, not by Tailwind's `peer-checked:`. `peer` needs the input to be a
   * preceding SIBLING of the box, which is a fact about PrimeVue's internal DOM order — the kind of
   * assumption that silently stops holding on a library upgrade. The context flag is the documented
   * contract instead.
   */
  box: ({ context }: any) => ({
    class: [
      'w-5 h-5 rounded-chip border flex items-center justify-center transition-colors',
      context?.checked ? 'bg-accent border-accent' : 'bg-white border-separator',
    ],
  }),
  icon: 'w-3.5 h-3.5 text-white',
};

/**
 * A selectable row in a list or picker. Stays a native `<button>` on purpose — a row IS a button —
 * so this gives it the look without giving it PrimeVue's semantics.
 */
export const ROW = {
  base: 'w-full flex items-center gap-3 px-3 py-2 rounded-control text-left cursor-pointer transition-colors',
  active: 'bg-fill-strong font-semibold text-label',
  idle: 'text-label hover:bg-fill',
};

/** "Nothing here yet" placeholder. Was written three different ways. */
export const EMPTY = 'text-center py-10 text-body text-label-3';

/**
 * Named text roles. Only combinations that mean something get one — bare `text-body` stays inline,
 * since "use the body size" is not a role. These four each appeared 5–22 times.
 */
export const TEXT = {
  /** Small print under a field, next to a filename, inside a chip. 22 sites. */
  caption: 'text-small text-label-3',
  /** Small print that still needs to be read: counts, timestamps in a list. */
  meta: 'text-small text-label-2',
  /** A hint at body size, under a section heading. */
  hint: 'text-body text-label-3',
  /** Secondary body copy. */
  muted: 'text-body text-label-2',
};

/** Full-screen dim behind a dialog or drawer. Six views had their own copy. */
export const SCRIM = 'fixed inset-0 bg-scrim backdrop-blur-sm';

/**
 * The 32px-tall field used in dense tree editors (CategoryEditor's inline rows).
 * A third field size, earned: five sites, and INPUT_CLASS_SM at h-9 is still too tall for them.
 */
export const INPUT_CLASS_XS =
  'w-full h-8 px-2 bg-white text-small text-label border border-separator rounded-chip ' +
  'focus:outline-none focus:ring-1 focus:ring-accent';

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
