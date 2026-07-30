<template>
    <div :class="PAGE.container">
        <div :class="PAGE.header">
            <div>
                <h1 :class="PAGE.title">{{ $t('system.users') }}</h1>
            </div>
            <div>
                <Button unstyled v-if="isSuperAdmin" @click="openEditor()"
                    class="bg-accent hover:bg-accent-hover text-white flex items-center justify-center gap-2 px-4 py-2 rounded-control text-body font-medium transition-colors border border-transparent focus:outline-none cursor-pointer">
                    <LucidePlus :size="16" /> {{ $t('action.new') }}
                </Button>
            </div>
        </div>

        <SmartTable :data="users" :loading="loading" :lazy="true" :totalRecords="totalRecords" @page="onPage"
            @sort="onSort" :rows="lazyParams.rows" :first="lazyParams.page * lazyParams.rows" :columns="columns">
            <template #role="{ data }">
                <span
                    :class="{ 'bg-purple-100 text-purple-700': data.role === 'super_admin', 'bg-blue-100 text-blue-700': data.role !== 'super_admin' }"
                    class="px-2 py-1 rounded-control text-small font-medium tracking-wider">
                    {{ data.role === 'super_admin' ? $t('form.superadmin') : $t('form.admin') }}
                </span>
            </template>
            <template #lastontime="{ data }">
                <span class="text-label-2">{{ data.lastontime ? new Date(data.lastontime).toLocaleString() :
                    '-' }}</span>
            </template>
            <template #actions="{ data }">
                <div class="flex gap-2">
                    <Button unstyled @click="openEditor(data)"
                        :class="LINK.action">
                        {{ $t('action.edit') }}
                    </Button>
                    <Button unstyled v-if="isSuperAdmin && data.username !== currentUser.username"
                        @click="deleteUser(data.id)"
                        :class="LINK.danger">
                        {{ $t('action.delete') }}
                    </Button>
                </div>
            </template>
        </SmartTable>

        <UserEditor v-if="showModal" :initial-data="editingItem" :is-editing="!!editingItem?.id"
            :is-super-admin="isSuperAdmin" @close="showModal = false" @save="handleSave" />
    </div>
</template>

<script setup lang="ts">
import { LINK, PAGE } from '../../ui/presets';
import { LucidePlus } from 'lucide-vue-next';

import { ref, computed, onMounted } from 'vue';
import Button from 'primevue/button';
import { useI18n } from 'vue-i18n';
import SmartTable from '../../components/SmartTable.vue';
import { listUser, getUser, createUser, updateUser, removeUser,
         listUserRole, createUserRole, removeUserRole } from '../../api';
import UserEditor from './UserEditor.vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { useAuthStore } from '../../stores/auth';

const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();
const authStore = useAuthStore();
const isSuperAdmin = authStore.isSuperAdmin;
const currentUser = computed(() => authStore.user || { username: '' });

const columns = [
    { field: 'id', header: 'ID', sortable: true, style: 'width: 5%' },
    { field: 'username', header: t('form.username'), sortable: true, style: 'width: 20%' },
    { field: 'nickname', header: t('form.nickname'), sortable: true, style: 'width: 20%' },
    { field: 'role', header: t('form.role'), sortable: true, style: 'width: 15%' },
    { field: 'lastontime', header: 'Last Login', sortable: true, style: 'width: 15%' },
];

const users = ref<any[]>([]);
const totalRecords = ref(0);
const loading = ref(true);
const showModal = ref(false);
const editingItem = ref<any>(null);

const lazyParams = ref({ page: 0, rows: 10, sortField: 'id', sortOrder: -1 });

const onPage = (event: any) => {
    lazyParams.value = event;
    fetchUsers();
};

const onSort = (event: any) => {
    lazyParams.value = event;
    fetchUsers();
};

const fetchUsers = async () => {
    loading.value = true;
    try {
        const params: any = {
            limit: lazyParams.value.rows,
            page: lazyParams.value.page,
        };
        if (lazyParams.value.sortField) {
            params.orderBy = lazyParams.value.sortField;
            params.orderDesc = lazyParams.value.sortOrder === -1;
        }

        const res = await listUser(params);
        users.value = res.data || [];
        totalRecords.value = res.total || 0;
    } catch (e) {
        console.error(e);
        // Fallback for admin if list fails (in case API forbids listing): Try to fetch just themselves
        if (!isSuperAdmin && currentUser.value.id) {
            try {
                const selfRes = await getUser(currentUser.value.id);
                users.value = [selfRes.data];   // getUser returns { code, data: row }
                totalRecords.value = 1;
            } catch (e2) { }
        }
    } finally {
        loading.value = false;
    }
};

onMounted(fetchUsers);

const openEditor = (item?: any) => {
    // If not super admin and trying to edit someone else, block it (UI should prevent this anyway)
    if (!isSuperAdmin && item && item.id !== currentUser.value.id) return;

    editingItem.value = item ? { ...item } : { username: '', password: '', role: '' };  // 不预选角色,见 UserEditor
    showModal.value = true;
};

const deleteUser = async (id: number) => {
    confirm.require({
        header: t('confirm.title'), message: t('action.confirmDelete'),
        accept: async () => {
        try {
            await removeUser(id);
            toast.add({ severity: 'success', summary: 'Success', detail: t('toast.userDeleted'), life: 3000 });
            fetchUsers();
        } catch (e) {
            console.error('Delete failed', e);
        }
        },
    });
};

// Reconcile the user_roles table to match the desired additional-role id set.
const syncUserRoles = async (userId: number, desiredRoleIds: number[]) => {
    if (!userId) return;
    const res = await listUserRole({ filter: { user_id: userId }, limit: 999 });
    const existing = res.data || [];
    const existingIds = existing.map((u: any) => u.role_id);
    for (const rid of desiredRoleIds) {
        if (!existingIds.includes(rid)) await createUserRole({ user_id: userId, role_id: rid });
    }
    for (const u of existing) {
        if (!desiredRoleIds.includes(u.role_id)) await removeUserRole(u.id);
    }
};

const handleSave = async (formData: any, additionalRoleIds: number[] = []) => {
    try {
        // Prevent password update if left empty during edit
        if (formData.id && !formData.password) {
            delete formData.password;
        }

        let userId = formData.id;
        if (formData.id) {
            await updateUser(formData.id, formData);
            toast.add({ severity: 'success', summary: 'Success', detail: t('toast.userUpdated'), life: 3000 });
            // If they changed their own name, reflect it in the auth store.
            if (formData.id === currentUser.value.id && formData.username) {
                authStore.setUser({ ...currentUser.value, username: formData.username });
            }
        } else {
            const res = await createUser(formData);
            userId = res.id;   // HTTPCreate returns { code, id }
            toast.add({ severity: 'success', summary: 'Success', detail: t('toast.userCreated'), life: 3000 });
        }
        await syncUserRoles(userId, additionalRoleIds);
        showModal.value = false;
        fetchUsers();
    } catch (e) {
        console.error('Save failed', e);
        toast.add({ severity: 'error', summary: 'Error', detail: t('toast.saveFailed'), life: 3000 });
    }
};
</script>
