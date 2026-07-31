<template>
  <AdminModal :title="isEditing ? $t('action.edit') : $t('user.new')" widthClass="max-w-lg" @close="emit('close')" @save="save" :disableSave="!formData.username || (!isEditing && !formData.password)">
    <form @submit.prevent="save" class="space-y-5" id="user-form">
      <div>
        <label :class="LABEL">{{ $t('form.username') }} <span class="text-danger">*</span></label>
        <InputText v-model="formData.username" unstyled :class="INPUT_CLASS" required/>
      </div>
      
      <div>
        <label :class="LABEL">{{ $t('form.nickname') }}</label>
        <InputText v-model="formData.nickname" unstyled :class="INPUT_CLASS" />
      </div>

      <div>
        <label :class="LABEL">
            {{ $t('form.password') }} <span v-if="!isEditing" class="text-danger">*</span>
        </label>
        <Password v-model="formData.password" unstyled :feedback="false" toggleMask fluid
          :inputProps="{ class: PASSWORD_PT.inputClass, placeholder: isEditing ? $t('form.leaveBlankToKeep') : '', autocomplete: 'current-password' }"
          :pt="PASSWORD_PT.pt" />
      </div>

      <div>
        <label :class="LABEL">{{ $t('form.role') }} <span :class="TEXT.caption">({{ $t('roles.primaryRole') }})</span></label>
        <Select v-model="formData.role" :options="roleOptions" optionLabel="label" optionValue="value" unstyled :pt="SELECT_PT" class="w-full" />
      </div>

      <div>
        <label :class="LABEL">{{ $t('roles.additionalRoles') }} <span :class="TEXT.caption">({{ $t('roles.additionalHint') }})</span></label>
        <div class="flex flex-wrap gap-2">
          <label v-for="r in roles.filter(x => x.name !== formData.role)" :key="r.id" class="flex items-center gap-1.5 px-2.5 py-1.5 border rounded-control text-small cursor-pointer transition-colors"
            :class="additionalRoleIds.includes(r.id) ? 'bg-accent text-white border-accent' : 'border-separator hover:bg-canvas'">
            <input type="checkbox" :value="r.id" v-model="additionalRoleIds" class="hidden" />
            {{ r.label || r.name }}
          </label>
          <span v-if="!roles.filter(x => x.name !== formData.role).length" :class="TEXT.caption">{{ $t('roles.noOtherRoles') }}</span>
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
import { listRole, listUserRole } from '../../api';
import { INPUT_CLASS, LABEL, PASSWORD_PT, SELECT_PT, TEXT } from '../../ui/presets';

const { t } = useI18n();


const props = defineProps<{
    initialData: any;
    isEditing: boolean;
}>();

const emit = defineEmits(['save', 'close']);

// 新建用户**不预选角色**:预选 admin 等于"点两下就建出一个管理员",是提权方向的默认值。
// 由创建者显式选一个(后端 users.role 的字段默认值也已改成空串)。
const formData = ref<any>({ role: '', nickname: '' });

// Roles are loaded from the RBAC roles table so any defined role can be assigned.
const roles = ref<any[]>([]);
const additionalRoleIds = ref<number[]>([]);   // user_roles beyond the primary
const roleOptions = computed(() =>
    roles.value.length
        ? roles.value.map((r: any) => ({ label: r.label || r.name, value: r.name }))
        // roles 表读不到时的兜底:只给 super_admin(唯一被代码硬依赖的角色名),不猜其它。
        : [{ label: t('role.super_admin') || 'Super Admin', value: 'super_admin' }]
);

onMounted(async () => {
    try {
        const res = await listRole({ limit: 999, orderBy: 'id' });
        roles.value = res.data || [];
    } catch (e) { console.error(e); }
    // Load this user's additional roles (user_roles) when editing.
    if (props.initialData?.id) {
        try {
            const res = await listUserRole({ filter: { user_id: props.initialData.id }, limit: 999 });
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
