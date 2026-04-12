<template>
  <AdminModal :title="isEditing ? $t('action.edit') : $t('action.new')" widthClass="max-w-lg" @close="emit('close')" @save="save">
    <form @submit.prevent="save" class="space-y-4" id="category-form">
      <div>
        <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('form.name') }}</label>
        <InputText v-model="formData.name" unstyled
          class="w-full h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue  bg-white  transition-shadow" />
      </div>

      <div>
        <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('form.slug') }}</label>
        <InputText v-model="formData.slug" unstyled
          class="w-full h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue bg-white  transition-shadow" />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('form.list_template') || 'List Template' }}</label>
          <InputText v-model="formData.list_template" unstyled placeholder="e.g. ListTemplate1"
            class="w-full h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue bg-white  transition-shadow" />
        </div>
        <div>
          <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('form.content_template') }}</label>
          <InputText v-model="formData.content_template" unstyled placeholder="e.g. ContentTemplate1"
            class="w-full h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue bg-white  transition-shadow" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('form.parent_id') }}</label>
          <Select v-model="formData.parent_id" :options="categoryOptions" optionLabel="label" optionValue="value"
            unstyled
            :pt="{ root: 'w-full h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:ring-1 focus:ring-apple-blue bg-white transition-shadow flex items-center justify-between cursor-pointer relative', label: 'text-[14px] text-[rgba(0,0,0,0.8)] truncate', dropdown: 'w-4 h-4 opacity-50 absolute right-3 top-1/2 -translate-y-1/2', overlay: 'bg-white border border-[rgba(0,0,0,0.15)] rounded-[8px] shadow-lg mt-1 py-1 z-[9999]', option: ({ context }: any) => ({ class: ['px-3 py-2 text-[14px] cursor-pointer hover:bg-[#f5f5f7]', context.selected ? 'bg-apple-blue text-white hover:bg-apple-blue' : 'text-[rgba(0,0,0,0.8)]'] }) }" />
        </div>
        <div>
          <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('form.weight') }}</label>
          <InputText v-model.number="formData.weight" unstyled
            class="w-full h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue  bg-white transition-shadow" />
        </div>
      </div>

      <div>
        <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('form.extraData')}}</label>
        <div class="border rounded-[8px] border-[rgba(0,0,0,0.15)] p-2 bg-white  max-h-40 overflow-y-auto ">
          <div v-for="(item, idx) in formData.metaPairs" :key="idx" class="flex gap-2 mb-2">
            <InputText v-model="item.key" unstyled placeholder="Key"
              class="w-1/3 h-8 px-2 border border-[rgba(0,0,0,0.15)] rounded text-xs focus:outline-none focus:ring-1 focus:ring-apple-blue" />
            <InputText v-model="item.value" unstyled placeholder="Value"
              class="flex-1 h-8 px-2 border border-[rgba(0,0,0,0.15)] rounded text-xs focus:outline-none focus:ring-1 focus:ring-apple-blue" />
            <Button type="button" @click="formData.metaPairs.splice(idx, 1)" unstyled
              class="text-red-500 hover:text-red-700 text-xs px-2 focus:outline-none">X</Button>
          </div>
          <Button type="button"
            @click="formData.metaPairs = formData.metaPairs || []; formData.metaPairs.push({ key: '', value: '' })"
            unstyled class="text-apple-blue text-[13px] hover:underline mt-1 focus:outline-none">+ {{ $t('action.new') }}</Button>
        </div>
      </div>
      <button type="submit" class="hidden"></button>
    </form>
  </AdminModal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AdminModal from '../../components/AdminModal.vue';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Button from 'primevue/button';

const { t } = useI18n();
const props = defineProps<{
  initialData: any;
  isEditing: boolean;
  categories: any[];
}>();

const emit = defineEmits(['save', 'close']);

const formData = ref<any>({});

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
}, { immediate: true });

const save = () => {
  emit('save', formData.value);
};
</script>
