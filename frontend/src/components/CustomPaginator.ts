export const customPaginatorPt = {
    root: { class: 'flex justify-between items-center px-6 py-4 border-t border-separator-weak bg-canvas rounded-b-card flex-wrap gap-4' },
    content: { class: 'flex items-center gap-2' },
    first: ({ context }: any) => ({ class: ['w-8 h-8 flex items-center justify-center rounded-control transition-colors focus:outline-none', context.disabled ? 'text-label-4 cursor-not-allowed' : 'text-label-3 hover:bg-surface-hover hover:text-label cursor-pointer'] }),
    prev: ({ context }: any) => ({ class: ['w-8 h-8 flex items-center justify-center rounded-control transition-colors focus:outline-none', context.disabled ? 'text-label-4 cursor-not-allowed' : 'text-label-3 hover:bg-surface-hover hover:text-label cursor-pointer'] }),
    next: ({ context }: any) => ({ class: ['w-8 h-8 flex items-center justify-center rounded-control transition-colors focus:outline-none', context.disabled ? 'text-label-4 cursor-not-allowed' : 'text-label-3 hover:bg-surface-hover hover:text-label cursor-pointer'] }),
    last: ({ context }: any) => ({ class: ['w-8 h-8 flex items-center justify-center rounded-control transition-colors focus:outline-none', context.disabled ? 'text-label-4 cursor-not-allowed' : 'text-label-3 hover:bg-surface-hover hover:text-label cursor-pointer'] }),
    page: ({ context }: any) => ({
        class: [
            'w-8 h-8 flex flex-col items-center justify-center rounded-control font-medium text-body transition-colors focus:outline-none',
            context.active ? 'bg-accent text-white' : 'text-label hover:bg-surface-hover cursor-pointer'
        ]
    }),
    pages: { class: 'flex gap-1 items-center' },
    current: { class: 'text-small text-label-3 font-medium' },
    pcRowPerPageDropdown: {
        root: { class: 'h-8 px-3 border border-separator rounded-control text-small font-medium cursor-pointer flex items-center justify-between min-w-[70px] relative focus:ring-1 focus:ring-accent focus:outline-none bg-white' },
        label: { class: 'truncate mr-2 text-label' },
        dropdown: { class: 'w-3 h-3 opacity-50 absolute right-2 top-1/2 -translate-y-1/2' },
        overlay: { class: 'bg-white border border-separator rounded-control shadow-lg mt-1 py-1 z-9999' },
        option: ({ context }: any) => ({ class: ['px-3 py-2 text-small cursor-pointer transition-colors', context.selected ? 'bg-accent text-white' : 'text-gray-800 hover:bg-gray-100'] })
    }
};
