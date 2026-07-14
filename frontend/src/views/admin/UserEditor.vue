<template>
  <AdminModal :title="isEditing ? $t('action.edit') : $t('user.new')" widthClass="max-w-lg" @close="emit('close')" @save="save" :disableSave="!formData.username || (!isEditing && !formData.password)">
    <form @submit.prevent="save" class="space-y-5" id="user-form">
      <div>
        <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('form.username') }} <span class="text-red-500">*</span></label>
        <InputText v-model="formData.username" unstyled class="w-full h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue bg-white  transition-shadow" required/>
      </div>
      
      <div>
        <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">
            {{ $t('form.password') }} <span v-if="!isEditing" class="text-red-500">*</span>
        </label>
        <Password v-model="formData.password" unstyled :feedback="false" toggleMask fluid :inputProps="{ class: 'w-full h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue bg-white  transition-shadow', placeholder: isEditing ? $t('form.leaveBlankToKeep') : '', autocomplete: 'current-password' }" :pt="{ root: 'relative w-full', maskIcon: 'absolute right-3 top-1/2 -translate-y-1/2 opacity-50 cursor-pointer w-4 h-4', unmaskIcon: 'absolute right-3 top-1/2 -translate-y-1/2 opacity-50 cursor-pointer w-4 h-4' }" />
      </div>

      <div>
        <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('form.role') }} <span class="text-[12px] text-[rgba(0,0,0,0.45)]">({{ $t('roles.primaryRole') }})</span></label>
        <Select v-model="formData.role" :options="roleOptions" optionLabel="label" optionValue="value" unstyled :pt="{ root: 'w-full h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue bg-white  transition-shadow flex items-center justify-between cursor-pointer relative', label: 'text-[14px] text-[rgba(0,0,0,0.8)] truncate', dropdown: 'w-4 h-4 opacity-50 absolute right-3 top-1/2 -translate-y-1/2', overlay: 'bg-white border border-[rgba(0,0,0,0.15)] rounded-[8px] shadow-lg mt-1 py-1 z-[9999]', option: ({ context }: any) => ({ class: ['px-3 py-2 text-[14px] cursor-pointer hover:bg-[#f5f5f7]', context.selected ? 'bg-apple-blue text-white hover:bg-apple-blue' : 'text-[rgba(0,0,0,0.8)]'] }) }" />
      </div>

      <div>
        <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-1">{{ $t('roles.additionalRoles') }} <span class="text-[12px] text-[rgba(0,0,0,0.45)]">({{ $t('roles.additionalHint') }})</span></label>
        <div class="flex flex-wrap gap-2">
          <label v-for="r in roles.filter(x => x.name !== formData.role)" :key="r.id" class="flex items-center gap-1.5 px-2.5 py-1.5 border rounded-[8px] text-[13px] cursor-pointer transition-colors"
            :class="additionalRoleIds.includes(r.id) ? 'bg-apple-blue text-white border-apple-blue' : 'border-[rgba(0,0,0,0.15)] hover:bg-[#f5f5f7]'">
            <input type="checkbox" :value="r.id" v-model="additionalRoleIds" class="hidden" />
            {{ r.label || r.name }}
          </label>
          <span v-if="!roles.filter(x => x.name !== formData.role).length" class="text-[13px] text-[rgba(0,0,0,0.4)]">{{ $t('roles.noOtherRoles') }}</span>
        </div>
      </div>
      <button type="submit" class="hidden"></button>
    </form>
  </AdminModal>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import AdminModal from '../../components/AdminModal.vue';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Select from 'primevue/select';
import { crudAPI } from '../../api';

const { t } = useI18n();


const props = defineProps<{
    initialData: any;
    isEditing: boolean;
}>();

const emit = defineEmits(['save', 'close']);

const formData = ref<any>({ role: 'admin' });

// Roles are loaded from the RBAC roles table so any defined role can be assigned.
const roles = ref<any[]>([]);
const additionalRoleIds = ref<number[]>([]);   // user_roles beyond the primary
const roleOptions = computed(() =>
    roles.value.length
        ? roles.value.map((r: any) => ({ label: r.label || r.name, value: r.name }))
        : [{ label: t('role.admin') || 'Admin', value: 'admin' }, { label: t('role.super_admin') || 'Super Admin', value: 'super_admin' }]
);

onMounted(async () => {
    try {
        const res: any = await crudAPI.getList('roles', { limit: 999, orderBy: 'weight', orderDesc: true });
        roles.value = res.data || res || [];
    } catch (e) { console.error(e); }
    // Load this user's additional roles (user_roles) when editing.
    if (props.initialData?.id) {
        try {
            const res: any = await crudAPI.getList('user_roles', { filter: { user_id: props.initialData.id }, limit: 999 });
            additionalRoleIds.value = (res.data || []).map((u: any) => u.role_id);
        } catch (e) { console.error(e); }
    }
});

watch(() => props.initialData, (newVal) => {
    formData.value = { ...newVal, password: '' };
}, { immediate: true });

// Emit the form plus the desired additional-role id set; the parent syncs user_roles.
const save = () => {
    emit('save', formData.value, additionalRoleIds.value.slice());
};

</script>
