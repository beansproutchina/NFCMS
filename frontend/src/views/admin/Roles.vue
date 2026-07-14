<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import { crudAPI } from '../../api';
import { useToast } from 'primevue/usetoast';
import { LucidePlus, LucideTrash2, LucideShieldCheck } from 'lucide-vue-next';

const toast = useToast();

const roles = ref<any[]>([]);
const selectedRole = ref<any>(null);
const perms = ref<any[]>([]);
const loading = ref(false);

// New-role form
const newRole = ref({ name: '', label: '' });
// New-permission row
const newPerm = ref({ model: '', action: 'R', scope: 'any' });

const ACTIONS = ['C', 'R', 'U', 'D', 'publish', 'share'];
const SCOPES = ['any', 'own'];

const isSystem = computed(() => !!selectedRole.value?.is_system);

const loadRoles = async () => {
    const res: any = await crudAPI.getList('roles', { limit: 999, orderBy: 'weight', orderDesc: true });
    roles.value = res.data || res || [];
    if (!selectedRole.value && roles.value.length) selectRole(roles.value[0]);
};

const loadPerms = async () => {
    if (!selectedRole.value) { perms.value = []; return; }
    const res: any = await crudAPI.getList('role_permissions', { filter: { role_id: selectedRole.value.id }, limit: 999 });
    perms.value = res.data || res || [];
};

const selectRole = async (r: any) => {
    selectedRole.value = r;
    await loadPerms();
};

const createRole = async () => {
    if (!newRole.value.name) { toast.add({ severity: 'warn', summary: 'Warning', detail: '角色标识必填', life: 2500 }); return; }
    try {
        await crudAPI.create('roles', { name: newRole.value.name, label: newRole.value.label || newRole.value.name });
        newRole.value = { name: '', label: '' };
        toast.add({ severity: 'success', summary: 'Success', detail: '角色已创建', life: 2500 });
        await loadRoles();
    } catch (e) { console.error(e); }
};

const deleteRole = async (r: any) => {
    if (r.is_system) { toast.add({ severity: 'warn', summary: 'Warning', detail: '内置角色不可删除', life: 2500 }); return; }
    if (!confirm(`删除角色 "${r.name}"?`)) return;
    await crudAPI.remove('roles', r.id);
    if (selectedRole.value?.id === r.id) selectedRole.value = null;
    toast.add({ severity: 'success', summary: 'Success', detail: '角色已删除', life: 2500 });
    await loadRoles();
};

const addPerm = async () => {
    if (!newPerm.value.model) { toast.add({ severity: 'warn', summary: 'Warning', detail: '模型(表名)必填,如 articles', life: 2500 }); return; }
    await crudAPI.create('role_permissions', {
        role_id: selectedRole.value.id,
        model: newPerm.value.model.trim(),
        action: newPerm.value.action,
        scope: newPerm.value.scope
    });
    newPerm.value = { model: newPerm.value.model, action: 'R', scope: 'any' };
    toast.add({ severity: 'success', summary: 'Success', detail: '权限已添加', life: 2000 });
    await loadPerms();
};

const removePerm = async (p: any) => {
    await crudAPI.remove('role_permissions', p.id);
    await loadPerms();
};

onMounted(async () => { loading.value = true; try { await loadRoles(); } finally { loading.value = false; } });
</script>

<template>
    <div class="max-w-7xl mx-auto py-10 w-full px-6">
        <div class="mb-8">
            <h1 class="text-[40px] font-semibold leading-[1.1] tracking-tight mb-2 flex items-center gap-3">
                <LucideShieldCheck :size="32" /> {{ $t('system.roles') }}
            </h1>
            <p class="text-[15px] text-[rgba(0,0,0,0.55)]">{{ $t('roles.desc') }}</p>
        </div>

        <div class="flex gap-6">
            <!-- Roles list -->
            <div class="w-[280px] shrink-0 bg-[#f9f9fb] rounded-[12px] border border-[rgba(0,0,0,0.06)] p-4 h-fit">
                <div class="flex flex-col gap-1 mb-4">
                    <button v-for="r in roles" :key="r.id" @click="selectRole(r)"
                        class="flex items-center justify-between px-3 py-2 rounded-[8px] text-left transition-colors cursor-pointer"
                        :class="selectedRole?.id === r.id ? 'bg-[rgba(0,0,0,0.08)] font-semibold' : 'hover:bg-[rgba(0,0,0,0.04)]'">
                        <span>{{ r.label || r.name }} <span class="text-[12px] text-[rgba(0,0,0,0.4)]">{{ r.name }}</span></span>
                        <LucideTrash2 v-if="!r.is_system" :size="14" class="opacity-40 hover:opacity-100 hover:text-red-500" @click.stop="deleteRole(r)" />
                    </button>
                </div>
                <div class="border-t border-[rgba(0,0,0,0.06)] pt-3 flex flex-col gap-2">
                    <InputText v-model="newRole.name" unstyled :placeholder="$t('roles.roleKey')" class="w-full h-9 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] text-[13px] focus:outline-none focus:border-apple-blue" />
                    <InputText v-model="newRole.label" unstyled :placeholder="$t('roles.roleLabel')" class="w-full h-9 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] text-[13px] focus:outline-none focus:border-apple-blue" />
                    <Button unstyled @click="createRole" class="bg-apple-blue hover:bg-[#0077ED] text-white flex items-center justify-center gap-2 h-9 rounded-[8px] text-[14px] font-medium cursor-pointer">
                        <LucidePlus :size="15" /> {{ $t('roles.newRole') }}
                    </Button>
                </div>
            </div>

            <!-- Permission matrix for selected role -->
            <div class="flex-1 bg-white rounded-[12px] border border-[rgba(0,0,0,0.06)] p-6">
                <div v-if="!selectedRole" class="text-[rgba(0,0,0,0.4)]">{{ $t('roles.selectPane') }}</div>
                <template v-else>
                    <h2 class="text-[21px] font-semibold mb-1">{{ selectedRole.label || selectedRole.name }}</h2>
                    <div class="text-[13px] text-[rgba(0,0,0,0.45)] mb-5">{{ selectedRole.name }}<span v-if="isSystem"> · {{ $t('roles.builtin') }}</span></div>

                    <div v-if="selectedRole.name === 'super_admin'" class="text-[14px] text-[rgba(0,0,0,0.6)] bg-[#f5f5f7] rounded-[8px] px-4 py-3">
                        {{ $t('roles.superAll') }}
                    </div>
                    <template v-else>
                        <table class="w-full text-[14px] mb-4">
                            <thead>
                                <tr class="text-left text-[12px] uppercase tracking-wider text-[rgba(0,0,0,0.45)] border-b border-[rgba(0,0,0,0.08)]">
                                    <th class="py-2">{{ $t('roles.model') }}</th><th class="py-2">{{ $t('roles.act') }}</th><th class="py-2">{{ $t('roles.scope') }}</th><th class="py-2 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="p in perms" :key="p.id" class="border-b border-[rgba(0,0,0,0.05)]">
                                    <td class="py-2 font-medium">{{ p.model }}</td>
                                    <td class="py-2"><span class="bg-[#eef2ff] text-[#3730a3] px-2 py-0.5 rounded text-[12px]">{{ p.action }}</span></td>
                                    <td class="py-2"><span :class="p.scope === 'own' ? 'text-[#c2410c]' : 'text-[#0066cc]'">{{ p.scope }}</span></td>
                                    <td class="py-2 text-right"><LucideTrash2 :size="15" class="opacity-40 hover:opacity-100 hover:text-red-500 cursor-pointer inline" @click="removePerm(p)" /></td>
                                </tr>
                                <tr v-if="!perms.length"><td colspan="4" class="py-4 text-[rgba(0,0,0,0.4)]">{{ $t('roles.noPerms') }}</td></tr>
                            </tbody>
                        </table>

                        <!-- add permission row -->
                        <div class="flex gap-2 items-center bg-[#f9f9fb] rounded-[8px] p-3">
                            <InputText v-model="newPerm.model" unstyled placeholder="articles" class="flex-1 h-9 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] text-[13px] bg-white focus:outline-none focus:border-apple-blue" />
                            <select v-model="newPerm.action" class="h-9 px-2 border border-[rgba(0,0,0,0.15)] rounded-[8px] text-[13px] bg-white cursor-pointer">
                                <option v-for="a in ACTIONS" :key="a" :value="a">{{ a }}</option>
                            </select>
                            <select v-model="newPerm.scope" class="h-9 px-2 border border-[rgba(0,0,0,0.15)] rounded-[8px] text-[13px] bg-white cursor-pointer">
                                <option v-for="s in SCOPES" :key="s" :value="s">{{ s }}</option>
                            </select>
                            <Button unstyled @click="addPerm" class="bg-apple-blue hover:bg-[#0077ED] text-white flex items-center gap-1 h-9 px-4 rounded-[8px] text-[13px] font-medium cursor-pointer">
                                <LucidePlus :size="14" /> {{ $t('roles.addPerm') }}
                            </Button>
                        </div>
                    </template>
                </template>
            </div>
        </div>
    </div>
</template>
