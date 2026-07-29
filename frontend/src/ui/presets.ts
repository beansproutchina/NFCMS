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

/** Reusable button classes. Append size/width via the component's own class if needed. */
const BTN_BASE = 'inline-flex items-center justify-center gap-2 h-9 px-4 rounded-control text-body font-medium cursor-pointer transition-colors focus:outline-none disabled:opacity-50';
export const BTN = {
  /** Primary call-to-action (blue). */
  primary: `${BTN_BASE} bg-accent hover:bg-accent-hover text-white border border-transparent`,
  /** Neutral secondary action (light gray). */
  ghost: `${BTN_BASE} bg-surface hover:bg-surface-hover text-label border border-separator-weak`,
  /** Destructive / warning-tinted secondary action. */
  danger: `${BTN_BASE} bg-surface hover:bg-surface-hover text-warn border border-separator-weak`,
};

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
  pcCloseButton: { root: 'text-label-3 hover:text-label transition-colors cursor-pointer shrink-0' },
  content: 'px-6 pb-6 flex items-start gap-3',
  // The severity icon is decorative; the message already says everything.
  icon: 'hidden',
  message: 'text-body text-label-2 leading-relaxed',
  footer: 'px-6 pb-6 flex justify-end gap-3',
  pcRejectButton: { root: BTN.ghost },
  pcAcceptButton: { root: BTN.primary },
};
