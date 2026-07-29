<template>
    <div :class="PAGE.container">
        <div :class="PAGE.header">
            <div>
                <h1 :class="PAGE.title">{{ $t('system.categories') }}
                </h1>
            </div>
            <Button unstyled @click="openForm()"
                class="bg-accent hover:bg-accent-hover text-white flex items-center justify-center gap-2 px-4 py-2 rounded-control text-body font-medium transition-colors border border-transparent focus:outline-none cursor-pointer">
                <LucidePlus :size="16" /> {{ $t('action.new') }}
            </Button>
        </div>

        <div
            class="bg-white rounded-card shadow-card border border-separator-weak p-6 flex-1 overflow-auto">
            <div v-if="loading" :class="EMPTY">{{ $t('system.loading') || 'Loading...'
            }}</div>
            <div v-else>
                <!-- Simple custom tree implementation since PrimeVue TreeTable can be complex to setup perfectly -->
                <ul class="space-y-2">
                    <CategoryItem v-for="cat in rootCategories" :key="cat.id" :category="cat"
                        :allCategories="categories" @edit="openForm" @delete="deleteCategory" />
                </ul>
                <div v-if="rootCategories.length === 0" :class="EMPTY">{{
                    $t('system.noEntries') || 'No entries found.' }}</div>
            </div>
        </div>

        <!-- Category Form Modal -->
        <CategoryEditor v-if="showModal" :initialData="formData" :isEditing="isEditing" :categories="categories"
            @close="showModal = false" @save="saveCategory" />
    </div>
</template>

<script setup lang="ts">
import { EMPTY, PAGE } from '../../ui/presets';
import { LucidePlus } from 'lucide-vue-next';


import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { listCategory, createCategory, updateCategory, removeCategory } from '../../api';
import CategoryItem from './CategoryItem.vue';
import CategoryEditor from './CategoryEditor.vue';
import { useToast } from 'primevue/usetoast';

const { t } = useI18n();
const toast = useToast();
const categories = ref<any[]>([]);
const loading = ref(true);

const rootCategories = computed(() => {
    return categories.value.filter(c => !c.parent_id).sort((a, b) => (a.weight) - (b.weight));
});

const fetchCategories = async () => {
    try {
        const res = await listCategory();
        categories.value = res.data || [];
    } catch (err) {
        console.error(err);
    } finally {
        loading.value = false;
    }
};

const showModal = ref(false);
const isEditing = ref(false);
const formData = ref<any>({});

const openForm = (cat?: any) => {
    if (cat) {
        isEditing.value = true;
        formData.value = { ...cat };

        // Convert object data to metaPairs array for the editor
        let pairs: any[] = [];
        if (cat.data && typeof cat.data === 'object') {
            for (const [key, value] of Object.entries(cat.data)) {
                pairs.push({ key, value });
            }
        } else if (cat.data && typeof cat.data === 'string') {
            try {
                const parsed = JSON.parse(cat.data);
                for (const [key, value] of Object.entries(parsed)) {
                    pairs.push({ key, value });
                }
            } catch (err) { }
        }
        formData.value.metaPairs = pairs;

    } else {
        isEditing.value = false;
        formData.value = { parent_id: 1, weight: 50, metaPairs: [], articleFieldDefs: [], list_template: 'DefaultCategory', content_template: 'DefaultArticle' };
    }
    showModal.value = true;
};

const saveCategory = async (emittedData: any) => {
    const payload = { ...emittedData };

    if (!payload.parent_id) {
        payload.parent_id = 0;
    }

    if (payload.metaPairs) {
        payload.data = {};
        payload.metaPairs.forEach((pair: any) => {
            if (pair.key && pair.key.trim()) {
                payload.data[pair.key.trim()] = pair.value;
            }
        });
        delete payload.metaPairs;
    } else if (payload.data && typeof payload.data === 'string') {
        try {
            payload.data = JSON.parse(payload.data);
        } catch {
            payload.data = {};
        }
    }

    if (isEditing.value) {
        await updateCategory(payload.id, payload);
        toast.add({ severity: 'success', summary: 'Success', detail: '分类更新成功', life: 3000 });
    } else {
        await createCategory(payload);
        toast.add({ severity: 'success', summary: 'Success', detail: '分类创建成功', life: 3000 });
    }
    showModal.value = false;
    fetchCategories();

};

const deleteCategory = async (id: number) => {
    if (!confirm(t('action.confirmDelete'))) return;
    try {
        await removeCategory(id);
        toast.add({ severity: 'success', summary: 'Success', detail: '分类删除成功', life: 3000 });
        fetchCategories();
    } catch (err) {
        alert("Failed to delete category");
    }
};

onMounted(fetchCategories);
</script>
