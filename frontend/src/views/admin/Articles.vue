<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import SmartTable from '../../components/SmartTable.vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { listArticle, removeArticle, listCategory, lifecycleAPI } from '../../api';
import { BTN, CHIP, INPUT_CLASS, LINK, PAGE, SEARCH, SELECT_PT, TEXT } from '../../ui/presets';
import { LucidePlus, LucideSearch,  } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

const { t } = useI18n();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();
const articles = ref([]);
const categories = ref<any[]>([]);
const loading = ref(true);
const globalFilter = ref('');
const selectedCategory = ref<number | null>(null);

const totalRecords = ref(0);
const lazyParams = ref({ page: 0, rows: 10, sortField: 'id', sortOrder: -1 });

const loadCategories = async () => {
    try {
        const catRes = await listCategory();
        categories.value = catRes.data || [];
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

        const res = await listArticle(params);
        articles.value = res.data || [];
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
    confirm.require({
        header: t('confirm.title'), message: t('action.confirmDelete'),
        accept: async () => {
        try {
            await removeArticle(id);
            toast.add({ severity: 'success', summary: 'Success', detail: t('toast.articleDeleted'), life: 3000 });
            fetchArticles();
        } catch(e) {
            console.error(e);
        }
        },
    });
};

const STATUS_CLS: Record<string, string> = {
    hidden: 'bg-canvas text-label-2',
    scheduled: 'bg-warn-fill text-warn',
    visible: 'bg-info-fill text-link'
};
const statusMeta = (s: string) => ({
    label: s ? t('contentStatus.' + s) : '-',
    cls: STATUS_CLS[s] || 'bg-canvas text-label-2'
});

const toggleVisibility = async (data: any) => {
    try {
        const to = data.status === 'visible' ? 'hidden' : 'visible';
        await lifecycleAPI.transition('articles', data.id, { to });
        toast.add({ severity: 'success', summary: 'Success', detail: to === 'visible' ? t('toast.published') : t('toast.hidden'), life: 2500 });
        fetchArticles();
    } catch(e) { console.error(e); }
};

</script>

<template>
    <div :class="PAGE.container">
        <div :class="PAGE.header">
            <div>
                <h1 :class="PAGE.title">{{ $t('system.articles') }}</h1>
            </div>
            <div class="flex flex-wrap gap-4 items-center">
                <Select 
                    v-model="selectedCategory" 
                    :options="[{id: null, name: $t('form.category')}, ...categories]" 
                    optionLabel="name" 
                    optionValue="id" 
                    unstyled
                    :placeholder='$t("form.category")'
                    :pt="SELECT_PT"
                    class="min-w-[200px]"
                    @change="onFilterChange"
                />
                <span class="relative">
                    <LucideSearch :class="SEARCH.icon" :size="16" />
                    <InputText unstyled v-model="globalFilter" :placeholder="$t('action.search')" :class="[INPUT_CLASS, SEARCH.input]" />
                </span>
                <Button unstyled @click="router.push('/admin/articles/new')" :class="BTN.primary">
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
                { field: 'status', header: $t('form.status') || 'Status', sortable: true, style: 'width: 15%' },
                { field: 'published_at', header: $t('form.date'), sortable: true, style: 'width: 15%' }
            ]"
        >
            <template #title="{ data }">
                <span class="font-semibold text-label text-title-item tracking-tight">{{ data.title }}</span>
            </template>
            <template #category_id="{ data }">
                <span class="text-body text-label">{{ getCategoryName(data.category_id) }}</span>
            </template>
            <template #is_top="{ data }">
                <span v-if="data.is_top" :class="CHIP.accent">TOP</span>
            </template>
            <template #status="{ data }">
                <span :class="statusMeta(data.status).cls" class="px-2 py-1 rounded-control text-small font-medium uppercase tracking-wider">
                    {{ statusMeta(data.status).label }}
                </span>
            </template>
            <template #published_at="{ data }">
                <span class="text-label-2">{{ data.published_at ? new Date(data.published_at).toLocaleDateString() : '-' }}</span>
            </template>
            <template #actions="{ data }">
                <div class="flex gap-2">
                    <Button unstyled @click="editArticle(data.id)" :class="LINK.action">
                        {{ $t('action.edit') }}
                    </Button>
                    <Button unstyled @click="toggleVisibility(data)" class="hover:underline flex items-center cursor-pointer" :class="TEXT.muted">
                        {{ data.status === 'visible' ? $t('action.unpublish') : $t('action.publish') }}
                    </Button>
                    <Button unstyled @click="deleteArticle(data.id)" :class="LINK.danger">
                        {{ $t('action.delete') }}
                    </Button>
                </div>
            </template>
        </SmartTable>

    </div>
</template>
