<script setup lang="ts">
import { ref, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import axios from 'axios';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const schemas = ref([]);
const loading = ref(true);

const fetchSchemas = async () => {
    loading.value = true;
    try {
        const res = await axios.get('/api/schematools/all');
        schemas.value = res.data.data || [];
    } catch(e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

const tablePt = {
    root: { class: 'w-full text-left' },
    table: { class: 'min-w-full border-collapse table-fixed' },
    thead: { class: 'bg-[#f5f5f7] border-b border-[rgba(0,0,0,0.05)]' },
    headerRow: { class: 'text-[14px]' },
    tbody: { class: 'bg-white' },
    bodyRow: { class: 'hover:bg-[#fafafc] transition-colors text-[14px] border-b border-[rgba(0,0,0,0.05)]' },
    pcPaginator: {
        root: { class: 'flex justify-center items-center gap-2 px-6 py-4 border-t border-[rgba(0,0,0,0.05)] bg-[#f5f5f7] rounded-b-[12px]' },
        content: { class: 'flex items-center gap-2' },
        first: { class: 'w-8 h-8 flex items-center justify-center rounded-[5px] text-[rgba(0,0,0,0.5)] hover:bg-[#ebebeb] hover:text-[rgba(0,0,0,0.8)] transition-colors focus:outline-none' },
        prev: { class: 'w-8 h-8 flex items-center justify-center rounded-[5px] text-[rgba(0,0,0,0.5)] hover:bg-[#ebebeb] hover:text-[rgba(0,0,0,0.8)] transition-colors focus:outline-none' },
        next: { class: 'w-8 h-8 flex items-center justify-center rounded-[5px] text-[rgba(0,0,0,0.5)] hover:bg-[#ebebeb] hover:text-[rgba(0,0,0,0.8)] transition-colors focus:outline-none' },
        last: { class: 'w-8 h-8 flex items-center justify-center rounded-[5px] text-[rgba(0,0,0,0.5)] hover:bg-[#ebebeb] hover:text-[rgba(0,0,0,0.8)] transition-colors focus:outline-none' },
        page: ({ context }: any) => ({
            class: [
                'w-8 h-8 flex flex-col items-center justify-center rounded-[5px] font-medium text-[15px] transition-colors focus:outline-none',
                context.active ? 'bg-[#0071e3] text-white' : 'text-[rgba(0,0,0,0.8)] hover:bg-[#ebebeb] cursor-pointer'
            ]
        }),
        pages: { class: 'flex gap-1 items-center' },
        firstIcon: { class: 'w-3 h-3 fill-current' },
        prevIcon: { class: 'w-3 h-3 fill-current' },
        nextIcon: { class: 'w-3 h-3 fill-current' },
        lastIcon: { class: 'w-3 h-3 fill-current' }
    }
};

const columnPt = {
    headerCell: { class: 'py-4 px-6 font-semibold text-[rgba(0,0,0,0.8)] text-left whitespace-nowrap' },
    columnHeaderContent: { class: 'flex items-center gap-2 cursor-pointer hover:text-[#0071e3] select-none' },
    sortIcon: { class: 'w-3 h-3 fill-current text-[rgba(0,0,0,0.4)]' },
    bodyCell: { class: 'py-5 px-6 text-left align-middle truncate' },
};

onMounted(fetchSchemas);
</script>

<template>
    <div class="max-w-7xl mx-auto py-10 w-full px-6">
        <div class="flex justify-between items-end mb-8">
            <div>
                <h1 class="text-[40px] font-semibold leading-[1.1] tracking-tight mb-2">{{ $t('system.schemas') }}</h1>
            </div>
        </div>

        <div class="bg-white rounded-[12px] shadow-[0px_5px_30px_rgba(0,0,0,0.06)] overflow-hidden border border-[rgba(0,0,0,0.05)]">
            <DataTable 
                :value="schemas" 
                :loading="loading" 
                paginator 
                :rows="10" 
                responsiveLayout="scroll"
                unstyled
                v-bind="$attrs"
                class="w-full text-left font-text text-[14px]"
                :pt="tablePt"
            >
                <Column field="modelName" header="Model Name" :sortable="true" :pt="columnPt"></Column>
                <Column field="tableName" header="Table Name" :sortable="true" :pt="columnPt"></Column>
                <Column field="routePath" header="API Route" :sortable="true" :pt="columnPt"></Column>
                <Column header="Fields count" :pt="columnPt">
                    <template #body="{ data }">
                        <span class="px-2 py-1 rounded-[5px] bg-[#f3f4f6] text-[12px] font-medium text-[rgba(0,0,0,0.6)]">{{ data.fields ? data.fields.length : 0 }} Fields</span>
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>
