<template>
  <AdminModal :title="isEditing ? $t('action.edit') : $t('action.new')" widthClass="max-w-lg" @close="emit('close')" @save="save">
    <form @submit.prevent="save" class="space-y-4" id="category-form">
      <div>
        <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('form.name') }}</label>
        <InputText v-model="formData.name" unstyled :class="INPUT_CLASS" />
      </div>

      <div>
        <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('form.slug') }}</label>
        <InputText v-model="formData.slug" unstyled :class="INPUT_CLASS" />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('form.list_template') || 'List Template' }}</label>
          <InputText v-model="formData.list_template" unstyled placeholder="e.g. ListTemplate1" :class="INPUT_CLASS" />
        </div>
        <div>
          <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('form.content_template') }}</label>
          <InputText v-model="formData.content_template" unstyled placeholder="e.g. ContentTemplate1" :class="INPUT_CLASS" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('form.parent_id') }}</label>
          <Select v-model="formData.parent_id" :options="categoryOptions" optionLabel="label" optionValue="value"
            unstyled :pt="SELECT_PT" class="w-full" />
        </div>
        <div>
          <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('form.weight') }}</label>
          <InputText v-model.number="formData.weight" unstyled :class="INPUT_CLASS" />
        </div>
      </div>

      <!-- Article Data Fields Editor -->
      <div>
        <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('form.articleDataFields') }}</label>
        <p class="text-[12px] text-[rgba(0,0,0,0.5)] mb-2">{{ $t('form.articleDataFieldsDesc') }}</p>
        <div class="border rounded-[8px] border-[rgba(0,0,0,0.15)] p-3 bg-white max-h-60 overflow-y-auto space-y-2">
          <div v-for="(field, idx) in formData.articleFieldDefs" :key="idx" class="flex gap-2 items-start">
            <div class="w-1/4">
              <InputText v-model="field.key" unstyled placeholder="Key"
                class="w-full h-8 px-2 border border-[rgba(0,0,0,0.15)] rounded text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <div class="w-1/4">
              <InputText v-model="field.title" unstyled :placeholder="$t('form.fieldTitle')"
                class="w-full h-8 px-2 border border-[rgba(0,0,0,0.15)] rounded text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <div class="w-1/4">
              <Select v-model="field.type" :options="fieldTypeOptions" optionLabel="label" optionValue="value" unstyled
                :pt="{ root: 'w-full h-8 px-2 border border-[rgba(0,0,0,0.15)] rounded text-xs focus:outline-none focus:ring-1 focus:ring-accent flex items-center justify-between cursor-pointer relative bg-white', label: 'text-xs truncate', dropdown: 'w-3 h-3 opacity-50 absolute right-1 top-1/2 -translate-y-1/2', overlay: 'bg-white border border-[rgba(0,0,0,0.15)] rounded shadow-lg mt-1 py-1 z-[9999]', option: ({ context }: any) => ({ class: ['px-2 py-1 text-xs cursor-pointer hover:bg-[#f5f5f7]', context.selected ? 'bg-accent text-white hover:bg-accent' : 'text-[rgba(0,0,0,0.8)]'] }) }" />
            </div>
            <Button type="button" @click="formData.articleFieldDefs.splice(idx, 1)" unstyled
              class="text-red-500 hover:text-red-700 text-xs px-2 focus:outline-none mt-1">X</Button>
          </div>
          <Button type="button"
            @click="formData.articleFieldDefs.push({ key: '', title: '', type: 'text' })"
            unstyled class="text-accent text-[13px] hover:underline mt-1 focus:outline-none">+ {{ $t('action.new') }}</Button>
        </div>
      </div>

      <div>
        <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('form.extraData')}}</label>
        <div class="border rounded-[8px] border-[rgba(0,0,0,0.15)] p-2 bg-white  max-h-40 overflow-y-auto ">
          <div v-for="(item, idx) in formData.metaPairs" :key="idx" class="flex gap-2 mb-2">
            <InputText v-model="item.key" unstyled placeholder="Key"
              class="w-1/3 h-8 px-2 border border-[rgba(0,0,0,0.15)] rounded text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
            <InputText v-model="item.value" unstyled placeholder="Value"
              class="flex-1 h-8 px-2 border border-[rgba(0,0,0,0.15)] rounded text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
            <Button type="button" @click="formData.metaPairs.splice(idx, 1)" unstyled
              class="text-red-500 hover:text-red-700 text-xs px-2 focus:outline-none">X</Button>
          </div>
          <Button type="button"
            @click="formData.metaPairs = formData.metaPairs || []; formData.metaPairs.push({ key: '', value: '' })"
            unstyled class="text-accent text-[13px] hover:underline mt-1 focus:outline-none">+ {{ $t('action.new') }}</Button>
        </div>
      </div>
      <button type="submit" class="hidden"></button>
    </form>

    <div v-if="isEditing && formData.id" class="mt-6 pt-5 border-t border-[rgba(0,0,0,0.08)]">
      <AclEditor model="articles_category" :resource-id="formData.id" :actions="['C', 'R', 'U', 'D', 'publish']" :title="$t('acl.categoryArticles')" />
      <p class="text-[12px] text-[rgba(0,0,0,0.45)] mt-2">{{ $t('acl.categoryArticlesHint') }}</p>
    </div>
  </AdminModal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AdminModal from '../../components/AdminModal.vue';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Button from 'primevue/button';
import { SELECT_PT, INPUT_CLASS } from '../../ui/presets';
import AclEditor from '../../components/AclEditor.vue';

const { t } = useI18n();
const props = defineProps<{
  initialData: any;
  isEditing: boolean;
  categories: any[];
}>();

const emit = defineEmits(['save', 'close']);

const formData = ref<any>({});

const fieldTypeOptions = [
  { label: t('form.fieldTypeText'), value: 'text' },
  { label: t('form.fieldTypeTextarea'), value: 'textarea' },
  { label: t('form.fieldTypeNumber'), value: 'number' },
  { label: t('form.fieldTypeAttachment'), value: 'attachment' },
];

const categoryOptions = computed(() => {
  const opts = [{ label: t('form.none') || 'None (Root)', value: 0 }];
  props.categories.forEach(c => {
    if (c.id !== formData.value.id) {
      opts.push({ label: c.name, value: c.id });
    }
  });
  return opts;
});

watch(() => props.initialData, (newVal) => {
  formData.value = { ...newVal };

  // Convert article_data_fields from object to array of definitions
  const fieldDefs: { key: string; title: string; type: string }[] = [];
  if (newVal.article_data_fields && typeof newVal.article_data_fields === 'object') {
    const src = typeof newVal.article_data_fields === 'string'
      ? JSON.parse(newVal.article_data_fields)
      : newVal.article_data_fields;
    for (const [key, def] of Object.entries(src)) {
      const d = def as any;
      fieldDefs.push({ key, title: d.title || '', type: d.type || 'text' });
    }
  }
  formData.value.articleFieldDefs = fieldDefs;
}, { immediate: true });

const save = () => {
  // Convert articleFieldDefs array back to article_data_fields object
  const articleDataFields: Record<string, { title: string; type: string }> = {};
  if (formData.value.articleFieldDefs) {
    for (const field of formData.value.articleFieldDefs) {
      if (field.key && field.key.trim()) {
        articleDataFields[field.key.trim()] = { title: field.title || '', type: field.type || 'text' };
      }
    }
  }
  formData.value.article_data_fields = articleDataFields;
  delete formData.value.articleFieldDefs;

  emit('save', formData.value);
};
</script>
