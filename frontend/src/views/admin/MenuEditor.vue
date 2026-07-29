<template>
  <AdminModal :title="isEditing ? $t('action.edit') : $t('action.new')" widthClass="max-w-4xl" @close="emit('close')" @save="save" :disableSave="!formData.name">
    <div class="space-y-6">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label :class="LABEL">{{ $t('form.name') }} <span class="text-danger">*</span></label>
          <InputText unstyled v-model="formData.name" :class="INPUT_CLASS"/>
        </div>
        <div>
          <label :class="LABEL">{{ $t('form.locationKey') || 'Key Location (e.g. "header")' }}</label>
          <InputText unstyled v-model="formData.location" :class="INPUT_CLASS"/>
        </div>
      </div>

      <div class="bg-surface border border-separator-weak rounded-control p-4 flex items-center justify-between">
          <div>
              <h3 class="text-body font-semibold text-label mb-1">{{ $t('form.generateRecursively') || 'Generate from Category' }}</h3>
              <p class="text-small text-label-3">{{ $t('form.generateDesc') || 'Automatically fetch subcategories to build nested menu.' }}</p>
          </div>
          <div class="flex gap-2 items-center">
              <Select v-model="selectedCategoryForGenerate" :options="categoryOptions" optionLabel="label" optionValue="value" unstyled :pt="SELECT_PT" class="w-[220px] shrink-0" />
              <Button unstyled type="button" @click="generateFromCategory" :disabled="!selectedCategoryForGenerate" :class="BTN.primary">{{ $t('action.generate') || 'Generate' }}</Button>
          </div>
      </div>

      <div>
          <div class="flex justify-between items-center mb-3">
            <label :class="LABEL_BARE">{{ $t('form.menuItems') || 'Menu Items (Tree)' }}</label>
            <Button unstyled @click="addItem(formData.items)" type="button" class="text-small font-medium text-accent whitespace-nowrap px-3 py-2 bg-info-fill hover:bg-info-fill rounded-control focus:outline-none transition-colors">+ {{ $t('action.addRootItem') || 'Add Root Item' }}</Button>
          </div>
          <div class="bg-canvas border border-separator-weak rounded-card p-4 min-h-[200px]">
            <MenuItemEditor v-if="formData.items && formData.items.length" :items="formData.items" :categories="categories" :articles="articles" @update="formData.items = $event" />
            <div v-else class="text-center text-label-3 py-12 text-body">{{ $t('system.noEntries') || 'No items added.' }}</div>
          </div>
      </div>
    </div>
  </AdminModal>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AdminModal from '../../components/AdminModal.vue';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Select from 'primevue/select';
import { BTN, INPUT_CLASS, LABEL, LABEL_BARE, SELECT_PT } from '../../ui/presets';
import { listCategory, listArticle } from '../../api';
import MenuItemEditor from './MenuItemEditor.vue';

const { t } = useI18n();

const props = defineProps<{ initialData: any, isEditing: boolean }>();
const emit = defineEmits(['close', 'save']);

const formData = ref<any>({ name: '', location: '', items: [] });
const categories = ref<any[]>([]);
const articles = ref<any[]>([]);
const selectedCategoryForGenerate = ref<number | null>(null);

const categoryOptions = computed(() => {
    const opts = [{ label: t('form.selectCategory') || 'Select Category', value: null }];
    categories.value.forEach((c: any) => opts.push({ label: c.name, value: c.id }));
    return opts;
});

onMounted(async () => {
    try {
        const catRes = await listCategory();
        const artRes = await listArticle();
        categories.value = catRes.data || [];
        articles.value = artRes.data || [];
    } catch(e) {}
});

watch(() => props.initialData, (newVal) => {
    formData.value = JSON.parse(JSON.stringify(newVal));
    if (!formData.value.items) formData.value.items = [];
}, { immediate: true, deep: true });

const addItem = (arr: any[]) => {
    arr.push({ label: 'New Item', url: '/', type: 'custom', refId: null, children: [] });
};

const buildMenuTree = (parentId: number | null): any[] => {
    return categories.value
        .filter(c => c.parent_id === parentId)
        .sort((a, b) => (a.weight) - (b.weight))
        .map(c => {
            return {
                label: c.name,
                url: `/a/${c.slug}`,
                type: 'category',
                refId: c.id,
                children: buildMenuTree(c.id)
            };
        });
};

const generateFromCategory = () => {
    if (!selectedCategoryForGenerate.value) return;
    const newItems = buildMenuTree(selectedCategoryForGenerate.value);
    if (!formData.value.items) formData.value.items = [];
    formData.value.items.push(...newItems);
    selectedCategoryForGenerate.value = null; // reset
};

const save = () => {
    emit('save', formData.value);
};
</script>
