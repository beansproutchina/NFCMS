<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import axios from 'axios';
import { LucidePlus, LucideSearch, LucideEdit, LucideTrash } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const router = useRouter();
const articles = ref([]);
const loading = ref(true);
const globalFilter = ref('');

const fetchArticles = async () => {
    loading.value = true;
    try {
        const res = await axios.get('/api/articles');
        articles.value = res.data.data || [];
    } catch(e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

onMounted(fetchArticles);

const editArticle = (id: number) => {
    router.push(`/admin/articles/edit/${id}`);
};

const deleteArticle = async (id: number) => {
    if(confirm(t('action.confirmDelete'))) {
        try {
            await axios.delete(`/api/articles?id=${id}`);
            fetchArticles();
        } catch(e) {
            console.error(e);
        }
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
</script>

<template>
    <div class="max-w-7xl mx-auto py-10 w-full px-6">
        <div class="flex justify-between items-end mb-8">
            <div>
                <h1 class="text-[40px] font-semibold leading-[1.1] tracking-tight mb-2">{{ $t('system.articles') }}</h1>
            </div>
            <div class="flex gap-4 items-center">
                <span class="relative">
                    <LucideSearch class="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" :size="16" />
                    <InputText v-model="globalFilter" :placeholder="$t('action.search')" class="pl-9 bg-[#fafafc] border-[3px] border-[rgba(0,0,0,0.04)] py-2 px-4 rounded-[11px] text-[17px] text-[rgba(0,0,0,0.8)] focus:outline-none focus:border-apple-blue" />
                </span>
                <Button unstyled @click="router.push('/admin/articles/new')" class="bg-apple-blue hover:bg-[#2997ff] text-white flex items-center gap-2 px-[15px] py-[8px] rounded-[8px] font-text text-[17px] cursor-pointer">
                    <LucidePlus :size="16" /> {{ $t('action.new') }}
                </Button>
            </div>
        </div>

        <div class="bg-white rounded-[12px] shadow-[0px_5px_30px_rgba(0,0,0,0.06)] overflow-hidden border border-[rgba(0,0,0,0.05)]">
            <DataTable 
                :value="articles" 
                :loading="loading" 
                paginator 
                :rows="10" 
                dataKey="id" 
                :globalFilterFields="['title', 'slug', 'status']"
                :filters="{ global: { value: globalFilter, matchMode: 'contains' } }"
                responsiveLayout="scroll"
                unstyled
                v-bind="$attrs"
                class="w-full text-left font-text text-[14px]"
                :pt="tablePt"
            >
                <Column field="id" header="ID" :sortable="true" style="width: 5%" :pt="columnPt"></Column>
                <Column field="title" :header="$t('form.title')" :sortable="true" style="width: 30%" :pt="columnPt">
                    <template #body="{ data }">
                        <span class="font-semibold text-apple-text-dark text-[17px] tracking-tight">{{ data.title }}</span>
                    </template>
                </Column>
                <Column field="slug" :header="$t('form.slug')" :sortable="true" style="width: 20%" :pt="columnPt"></Column>
                <Column field="status" :header="$t('form.status')" :sortable="true" style="width: 15%" :pt="columnPt">
                    <template #body="{ data }">
                        <span :class="{'bg-[#e0f2fe] text-[#0066cc]': data.status === 'published', 'bg-[#f3f4f6] text-[rgba(0,0,0,0.6)]': data.status === 'draft'}" class="px-2 py-1 rounded-[5px] text-[12px] font-medium uppercase tracking-wider">
                            {{ data.status }}
                        </span>
                    </template>
                </Column>
                <Column field="published_at" :header="$t('form.date')" :sortable="true" style="width: 15%" :pt="columnPt">
                    <template #body="{ data }">
                        <span class="text-[rgba(0,0,0,0.6)]">{{ data.published_at ? new Date(data.published_at).toLocaleDateString() : '-' }}</span>
                    </template>
                </Column>
                <Column :header="$t('form.actions')" :exportable="false" style="min-width: 8rem; width: 15%" :pt="columnPt">
                    <template #body="slotProps">
                        <div class="flex gap-2">
                            <Button unstyled @click="editArticle(slotProps.data.id)" class="text-[#0066cc] hover:underline text-[14px] flex items-center cursor-pointer">
                                {{ $t('action.edit') }}
                            </Button>
                            <Button unstyled @click="deleteArticle(slotProps.data.id)" class="text-red-500 hover:underline text-[14px] flex items-center cursor-pointer">
                                {{ $t('action.delete') }}
                            </Button>
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>
