export const customPaginatorPt = {
    root: { class: 'flex justify-between items-center px-6 py-4 border-t border-[rgba(0,0,0,0.05)] bg-[#f5f5f7] rounded-b-[12px] flex-wrap gap-4' },
    content: { class: 'flex items-center gap-2' },
    first: ({ context }: any) => ({ class: ['w-8 h-8 flex items-center justify-center rounded-[5px] transition-colors focus:outline-none', context.disabled ? 'text-[rgba(0,0,0,0.2)] cursor-not-allowed' : 'text-[rgba(0,0,0,0.5)] hover:bg-[#ebebeb] hover:text-[rgba(0,0,0,0.8)] cursor-pointer'] }),
    prev: ({ context }: any) => ({ class: ['w-8 h-8 flex items-center justify-center rounded-[5px] transition-colors focus:outline-none', context.disabled ? 'text-[rgba(0,0,0,0.2)] cursor-not-allowed' : 'text-[rgba(0,0,0,0.5)] hover:bg-[#ebebeb] hover:text-[rgba(0,0,0,0.8)] cursor-pointer'] }),
    next: ({ context }: any) => ({ class: ['w-8 h-8 flex items-center justify-center rounded-[5px] transition-colors focus:outline-none', context.disabled ? 'text-[rgba(0,0,0,0.2)] cursor-not-allowed' : 'text-[rgba(0,0,0,0.5)] hover:bg-[#ebebeb] hover:text-[rgba(0,0,0,0.8)] cursor-pointer'] }),
    last: ({ context }: any) => ({ class: ['w-8 h-8 flex items-center justify-center rounded-[5px] transition-colors focus:outline-none', context.disabled ? 'text-[rgba(0,0,0,0.2)] cursor-not-allowed' : 'text-[rgba(0,0,0,0.5)] hover:bg-[#ebebeb] hover:text-[rgba(0,0,0,0.8)] cursor-pointer'] }),
    page: ({ context }: any) => ({
        class: [
            'w-8 h-8 flex flex-col items-center justify-center rounded-[5px] font-medium text-[15px] transition-colors focus:outline-none',
            context.active ? 'bg-apple-blue text-white' : 'text-[rgba(0,0,0,0.8)] hover:bg-[#ebebeb] cursor-pointer'
        ]
    }),
    pages: { class: 'flex gap-1 items-center' },
    current: { class: 'text-[13px] text-[rgba(0,0,0,0.5)] font-medium' },
    pcRowPerPageDropdown: {
        root: { class: 'h-8 px-3 border border-[rgba(0,0,0,0.15)] rounded-[5px] text-[13px] font-medium cursor-pointer flex items-center justify-between min-w-[70px] relative focus:ring-1 focus:ring-apple-blue focus:outline-none bg-white' },
        label: { class: 'truncate mr-2 text-[rgba(0,0,0,0.8)]' },
        dropdown: { class: 'w-3 h-3 opacity-50 absolute right-2 top-1/2 -translate-y-1/2' },
        overlay: { class: 'bg-white border border-[rgba(0,0,0,0.15)] rounded-[8px] shadow-lg mt-1 py-1 z-[9999]' },
        option: ({ context }: any) => ({ class: ['px-3 py-2 text-[13px] cursor-pointer transition-colors', context.selected ? 'bg-apple-blue text-white' : 'text-gray-800 hover:bg-gray-100'] })
    }
};
