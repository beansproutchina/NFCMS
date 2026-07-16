<template>
  <AdminModal :title="isEditing ? $t('action.edit') : $t('user.new')" widthClass="max-w-lg" @close="emit('close')"
    @save="save" :disableSave="!formData.username || (!isEditing && !formData.password)">
    <form @submit.prevent="save" class="space-y-5" id="user-form">
      <div>
        <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('form.username') }} <span
            class="text-red-500">*</span></label>
        <InputText v-model="formData.username" unstyled
          class="w-full h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue bg-white  transition-shadow"
          required />
      </div>
      <div>
        <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('form.nickname') }} </label>
        <InputText v-model="formData.nickname" unstyled
          class="w-full h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue bg-white  transition-shadow"
           />
      </div>
      <div>
        <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">
          {{ $t('form.password') }} <span v-if="!isEditing" class="text-red-500">*</span>
        </label>
        <Password v-model="formData.password" unstyled :feedback="false" toggleMask fluid
          :inputProps="{ class: 'w-full h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue bg-white  transition-shadow', placeholder: isEditing ? $t('form.leaveBlankToKeep') : '', autocomplete: 'new-password' }"
          :pt="{ root: 'relative w-full', maskIcon: 'absolute right-3 top-1/2 -translate-y-1/2 opacity-50 cursor-pointer w-4 h-4', unmaskIcon: 'absolute right-3 top-1/2 -translate-y-1/2 opacity-50 cursor-pointer w-4 h-4' }" />
      </div>

      <div>
        <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('form.role') }}</label>
        <Select v-model="formData.role" :options="roleOptions" optionLabel="label" optionValue="value" unstyled
          :pt="{ root: 'w-full h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue bg-white  transition-shadow flex items-center justify-between cursor-pointer relative', label: 'text-[14px] text-[rgba(0,0,0,0.8)] truncate', dropdown: 'w-4 h-4 opacity-50 absolute right-3 top-1/2 -translate-y-1/2', overlay: 'bg-white border border-[rgba(0,0,0,0.15)] rounded-[8px] shadow-lg mt-1 py-1 z-[9999]', option: ({ context }: any) => ({ class: ['px-3 py-2 text-[14px] cursor-pointer hover:bg-[#f5f5f7]', context.selected ? 'bg-apple-blue text-white hover:bg-apple-blue' : 'text-[rgba(0,0,0,0.8)]'] }) }" />
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
import Password from 'primevue/password';
import Select from 'primevue/select';

const { t } = useI18n();


const props = defineProps<{
  initialData: any;
  isEditing: boolean;
}>();

const emit = defineEmits(['save', 'close']);

const formData = ref<any>({ role: 'admin' });

const roleOptions = computed(() => [
  { label: t('role.admin') || 'Admin', value: 'admin' },
  { label: t('role.super_admin') || 'Super Admin', value: 'super_admin' },
  { label: t('role.editor') || 'Editor', value: 'editor' }
]);

watch(() => props.initialData, (newVal) => {
  formData.value = { ...newVal, password: '' };
}, { immediate: true });

const save = () => {
  emit('save', formData.value);
};

</script>
