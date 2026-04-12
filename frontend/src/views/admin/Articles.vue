<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import SmartTable from '../../components/SmartTable.vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { crudAPI } from '../../api';
import { LucidePlus, LucideSearch,  } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';

const { t } = useI18n();
const router = useRouter();
const toast = useToast();
const articles = ref([]);
const categories = ref<any[]>([]);
const loading = ref(true);
const globalFilter = ref('');
const selectedCategory = ref<number | null>(null);

const totalRecords = ref(0);
const lazyParams = ref({ page: 0, rows: 10, sortField: 'id', sortOrder: -1 });

const loadCategories = async () => {
    try {
        const catRes: any = await crudAPI.getList('categories');
        categories.value = catRes.data || catRes || [];
    } catch(e) {
        console.error(e);
    }
};

const fetchArticles = async () => {
    loading.value = true;
    try {
        let filter: any = {};
        if (globalFilter.value) {
            filter.$or = {
                title: { $contains: globalFilter.value },
                slug: { $contains: globalFilter.value }
            };
        }
        if (selectedCategory.value) {
            filter.category_id = selectedCategory.value;
        }

        const params: any = {
            limit: lazyParams.value.rows,
            page: lazyParams.value.page,
            filter
        };
        if (lazyParams.value.sortField) {
            params.orderBy = lazyParams.value.sortField;
            params.orderDesc = lazyParams.value.sortOrder === -1;
        }

        const res: any = await crudAPI.getList('articles', params);
        articles.value = res.data || res || [];
        totalRecords.value = res.total || 0;
    } catch(e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

const getCategoryName = (id: number) => {
    const cat = categories.value.find(c => c.id === id);
    return cat ? cat.name : '-';
};

const onPage = (event: any) => {
    lazyParams.value = event;
    fetchArticles();
};

const onSort = (event: any) => {
    lazyParams.value = event;
    fetchArticles();
};

let filterTimeout: any;
const onFilterChange = () => {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
        lazyParams.value.page = 0;
        fetchArticles();
    }, 500);
};

watch(globalFilter, onFilterChange);

onMounted(async () => {
    await loadCategories();
    fetchArticles();
});

const editArticle = (id: number) => {
    router.push(`/admin/articles/edit/${id}`);
};

const deleteArticle = async (id: number) => {
    if(confirm(t('action.confirmDelete'))) {
        try {
            await crudAPI.remove('articles', id);
            toast.add({ severity: 'success', summary: 'Success', detail: '文章删除成功', life: 3000 });
            fetchArticles();
        } catch(e) {
            console.error(e);
        }
    }
};

</script>

<template>
    <div class="max-w-7xl mx-auto py-10 w-full px-6">
        <div class="flex justify-between items-end mb-8">
            <div>
                <h1 class="text-[40px] font-semibold leading-[1.1] tracking-tight mb-2">{{ $t('system.articles') }}</h1>
            </div>
            <div class="flex flex-wrap gap-4 items-center">
                <Select 
                    v-model="selectedCategory" 
                    :options="[{id: null, name: $t('form.category')}, ...categories]" 
                    optionLabel="name" 
                    optionValue="id" 
                    unstyled
                    :placeholder='$t("form.category")'
                    :pt="{ root: 'h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue transition-shadow bg-white flex items-center justify-between cursor-pointer relative min-w-[200px]', label: 'text-[14px] text-[rgba(0,0,0,0.8)] truncate', dropdown: 'w-4 h-4 opacity-50 absolute right-3 top-1/2 -translate-y-1/2', overlay: 'bg-white border border-[rgba(0,0,0,0.15)] rounded-[8px] shadow-lg mt-1 py-1 z-[9999]', option: ({ context }: any) => ({ class: ['px-3 py-2 text-[14px] cursor-pointer hover:bg-[#f5f5f7]', context.selected ? 'bg-apple-blue text-white hover:bg-apple-blue' : 'text-[rgba(0,0,0,0.8)]'] }) }"
                    @change="onFilterChange"
                />
                <span class="relative">
                    <LucideSearch class="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" :size="16" />
                    <InputText unstyled v-model="globalFilter" :placeholder="$t('action.search')" class="pl-9 border border-[rgba(0,0,0,0.04)] py-2 px-4 rounded-[11px] text-[17px] text-[rgba(0,0,0,0.8)] focus:outline-none focus:border-apple-blue" />
                </span>
                <Button unstyled @click="router.push('/admin/articles/new')" class="bg-apple-blue hover:bg-[#0077ED] text-white flex items-center justify-center gap-2 px-4 py-2 rounded-[8px] text-[15px] font-medium transition-colors border border-transparent focus:outline-none cursor-pointer">
                    <LucidePlus :size="16" /> {{ $t('action.new') }}
                </Button>
            </div>
        </div>

        
        <SmartTable 
            :data="articles" 
            :loading="loading" 
            :lazy="true"
            :totalRecords="totalRecords"
            @page="onPage"
            @sort="onSort"
            :rows="lazyParams.rows"
            :first="lazyParams.page * lazyParams.rows"
            :columns="[
                { field: 'id', header: 'ID', sortable: true, style: 'width: 5%' },
                { field: 'title', header: $t('form.title'), sortable: true, style: 'width: 30%' },
                { field: 'slug', header: $t('form.slug'), sortable: true, style: 'width: 20%' },
                { field: 'category_id', header: $t('form.category_id') || 'Category', sortable: true, style: 'width: 10%' },
                { field: 'is_top', header: $t('form.is_top') || 'Top', sortable: true, style: 'width: 10%' },
                { field: 'visible', header: $t('form.status') || 'Status', sortable: true, style: 'width: 15%' },
                { field: 'published_at', header: $t('form.date'), sortable: true, style: 'width: 15%' }
            ]"
        >
            <template #title="{ data }">
                <span class="font-semibold text-apple-text-dark text-[17px] tracking-tight">{{ data.title }}</span>
            </template>
            <template #category_id="{ data }">
                <span class="text-[14px] text-[rgba(0,0,0,0.8)]">{{ getCategoryName(data.category_id) }}</span>
            </template>
            <template #is_top="{ data }">
                <span v-if="data.is_top" class="text-green-600 bg-green-100 px-2 py-1 rounded text-xs">TOP</span>
            </template>
            <template #visible="{ data }">
                <span :class="{'bg-[#e0f2fe] text-[#0066cc]': data.visible === 1, 'bg-[#f3f4f6] text-[rgba(0,0,0,0.6)]': data.visible === 0}" class="px-2 py-1 rounded-[5px] text-[12px] font-medium uppercase tracking-wider">
                    {{ data.visible ? ($t('form.published') || 'Published') : ($t('form.draft') || 'Draft') }}
                </span>
            </template>
            <template #published_at="{ data }">
                <span class="text-[rgba(0,0,0,0.6)]">{{ data.published_at ? new Date(data.published_at).toLocaleDateString() : '-' }}</span>
            </template>
            <template #actions="{ data }">
                <div class="flex gap-2">
                    <Button unstyled @click="editArticle(data.id)" class="text-[#0066cc] hover:underline text-[14px] flex items-center cursor-pointer">
                        {{ $t('action.edit') }}
                    </Button>
                    <Button unstyled @click="deleteArticle(data.id)" class="text-red-500 hover:underline text-[14px] flex items-center cursor-pointer">
                        {{ $t('action.delete') }}
                    </Button>
                </div>
            </template>
        </SmartTable>

    </div>
</template>
