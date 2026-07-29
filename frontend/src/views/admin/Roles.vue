<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { listRole, createRole as apiCreateRole, removeRole, listRolePermission, createRolePermission,
         removeRolePermission, listResourceGrant, listCategory,
         schemaAPI, aclAPI, ARTICLES_CATEGORY } from '../../api';
import { useToast } from 'primevue/usetoast';
import { LucidePlus, LucideTrash2 } from 'lucide-vue-next';
import { BTN, FIELD_GROUP, INPUT_CLASS_SM, PAGE, SECTION_TITLE, SELECT_PT, TEXT } from '../../ui/presets';

const toast = useToast();

const roles = ref<any[]>([]);
const selectedRole = ref<any>(null);
const perms = ref<any[]>([]);
const loading = ref(false);

// New-role form
const newRole = ref({ name: '', label: '' });
// New-permission row
const newPerm = ref({ model: '', action: 'R', scope: 'any' });

const models = ref<any[]>([]); // registered models (from schematools) for the permission dropdown
const modelOptions = computed(() => models.value.map((m: any) => ({ label: `${m.modelName} (${m.tableName})`, value: m.tableName })));
const ACTIONS = ['C', 'R', 'U', 'D', 'publish', 'share'];
const SCOPES = ['any', 'own'];
// "own" is meaningless for create (whatever you create is yours) — only offer "any" for C.
// Category-limited create is expressed via the category grants section below.
const scopeOptions = computed(() => (newPerm.value.action === 'C' ? ['any'] : SCOPES));
watch(() => newPerm.value.action, (a) => { if (a === 'C') newPerm.value.scope = 'any'; });

const isSystem = computed(() => !!selectedRole.value?.is_system);

// --- Category-scoped article grants (per selected role) ---
const categories = ref<any[]>([]);
const catGrants = ref<any[]>([]);
const catForm = ref<{ category_id: any; access: string[] }>({ category_id: null, access: [] });
const CAT_ACTIONS = ['C', 'R', 'U', 'D', 'publish'];
const categoryOptions = computed(() => categories.value.map((c: any) => ({ label: c.name, value: c.id })));
const categoryName = (id: number) => { const c = categories.value.find((x: any) => x.id == id); return c ? c.name : `#${id}`; };

const loadCatGrants = async () => {
    if (!selectedRole.value) { catGrants.value = []; return; }
    const res = await listResourceGrant({
        filter: { $and: { model: ARTICLES_CATEGORY, grantee_type: 'role', grantee_id: selectedRole.value.id } },
        limit: 999,
    });
    catGrants.value = res.data || [];
};

const toggleCatAccess = (a: string) => {
    const i = catForm.value.access.indexOf(a);
    if (i >= 0) catForm.value.access.splice(i, 1); else catForm.value.access.push(a);
};

const addCatGrant = async () => {
    if (!selectedRole.value || catForm.value.category_id == null) { toast.add({ severity: 'warn', summary: 'Warning', detail: '请选择分类', life: 2500 }); return; }
    if (!catForm.value.access.length) { toast.add({ severity: 'warn', summary: 'Warning', detail: '请至少选择一项权限', life: 2500 }); return; }
    const access = CAT_ACTIONS.filter((a) => catForm.value.access.includes(a)).join(',');
    await aclAPI.grant(ARTICLES_CATEGORY, catForm.value.category_id, { grantee_type: 'role', grantee_id: selectedRole.value.id, access });
    toast.add({ severity: 'success', summary: 'Success', detail: '已授予', life: 2000 });
    catForm.value = { category_id: null, access: [] };
    await loadCatGrants();
};

const revokeCatGrant = async (g: any) => {
    await aclAPI.revoke(ARTICLES_CATEGORY, g.resource_id, g.id);
    await loadCatGrants();
};

const loadRoles = async () => {
    const res = await listRole({ limit: 999, orderBy: 'weight', orderDesc: true });
    roles.value = res.data || [];
    if (!selectedRole.value && roles.value.length) selectRole(roles.value[0]);
};

const loadPerms = async () => {
    if (!selectedRole.value) { perms.value = []; return; }
    const res = await listRolePermission({ filter: { role_id: selectedRole.value.id }, limit: 999 });
    perms.value = res.data || [];
};

const selectRole = async (r: any) => {
    selectedRole.value = r;
    await loadPerms();
    await loadCatGrants();
};

const createRole = async () => {
    if (!newRole.value.name) { toast.add({ severity: 'warn', summary: 'Warning', detail: '角色标识必填', life: 2500 }); return; }
    try {
        await apiCreateRole({ name: newRole.value.name, label: newRole.value.label || newRole.value.name });
        newRole.value = { name: '', label: '' };
        toast.add({ severity: 'success', summary: 'Success', detail: '角色已创建', life: 2500 });
        await loadRoles();
    } catch (e) { console.error(e); }
};

const deleteRole = async (r: any) => {
    if (r.is_system) { toast.add({ severity: 'warn', summary: 'Warning', detail: '内置角色不可删除', life: 2500 }); return; }
    if (!confirm(`删除角色 "${r.name}"?`)) return;
    await removeRole(r.id);
    if (selectedRole.value?.id === r.id) selectedRole.value = null;
    toast.add({ severity: 'success', summary: 'Success', detail: '角色已删除', life: 2500 });
    await loadRoles();
};

const addPerm = async () => {
    if (!newPerm.value.model) { toast.add({ severity: 'warn', summary: 'Warning', detail: '模型(表名)必填,如 articles', life: 2500 }); return; }
    await createRolePermission({
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
    await removeRolePermission(p.id);
    await loadPerms();
};

onMounted(async () => {
    loading.value = true;
    try {
        await loadRoles();
        try {
            const res = await schemaAPI.getAll();
            models.value = res.data || [];
            if (models.value.length && !newPerm.value.model) newPerm.value.model = models.value[0].tableName;
        } catch (e) { console.error(e); }
        try {
            const cr = await listCategory({ limit: 999, orderBy: 'weight' });
            categories.value = cr.data || [];
        } catch (e) { console.error(e); }
    } finally { loading.value = false; }
});
</script>

<template>
    <div :class="PAGE.container">
        <div class="mb-8">
            <h1 :class="PAGE.title">{{ $t('system.roles') }}</h1>
            <p :class="TEXT.muted">{{ $t('roles.desc') }}</p>
        </div>

        <div class="flex gap-6">
            <!-- Roles list -->
            <div class="w-[280px] shrink-0 bg-surface rounded-card border border-separator-weak p-4 h-fit">
                <div class="flex flex-col gap-1 mb-4">
                    <button v-for="r in roles" :key="r.id" @click="selectRole(r)"
                        class="flex items-center justify-between px-3 py-2 rounded-control text-left transition-colors cursor-pointer"
                        :class="selectedRole?.id === r.id ? 'bg-fill-strong font-semibold' : 'hover:bg-fill'">
                        <span>{{ r.label || r.name }} <span :class="TEXT.caption">{{ r.name }}</span></span>
                        <LucideTrash2 v-if="!r.is_system" :size="14" class="opacity-40 hover:opacity-100 hover:text-danger" @click.stop="deleteRole(r)" />
                    </button>
                </div>
                <div class="border-t border-separator-weak pt-3 flex flex-col gap-2">
                    <InputText v-model="newRole.name" unstyled :placeholder="$t('roles.roleKey')" :class="INPUT_CLASS_SM" />
                    <InputText v-model="newRole.label" unstyled :placeholder="$t('roles.roleLabel')" :class="INPUT_CLASS_SM" />
                    <Button unstyled @click="createRole" :class="[BTN.primary, 'w-full']">
                        <LucidePlus :size="15" /> {{ $t('roles.newRole') }}
                    </Button>
                </div>
            </div>

            <!-- Permission matrix for selected role -->
            <div class="flex-1 bg-white rounded-card border border-separator-weak p-6">
                <div v-if="!selectedRole" class="text-label-3">{{ $t('roles.selectPane') }}</div>
                <template v-else>
                    <h2 class="mb-1" :class="SECTION_TITLE">{{ selectedRole.label || selectedRole.name }}</h2>
                    <div class="mb-5" :class="TEXT.caption">{{ selectedRole.name }}<span v-if="isSystem"> · {{ $t('roles.builtin') }}</span></div>

                    <div v-if="selectedRole.name === 'super_admin'" class="bg-canvas rounded-control px-4 py-3" :class="TEXT.muted">
                        {{ $t('roles.superAll') }}
                    </div>
                    <template v-else>
                        <table class="w-full text-body mb-4">
                            <thead>
                                <tr class="text-left uppercase tracking-wider border-b border-separator-weak" :class="TEXT.caption">
                                    <th class="py-2">{{ $t('roles.model') }}</th><th class="py-2">{{ $t('roles.act') }}</th><th class="py-2">{{ $t('roles.scope') }}</th><th class="py-2 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="p in perms" :key="p.id" class="border-b border-separator-weak">
                                    <td class="py-2 font-medium">{{ p.model }}</td>
                                    <td class="py-2"><span class="bg-indigo-fill text-indigo px-2 py-0.5 rounded-chip text-small">{{ p.action }}</span></td>
                                    <td class="py-2"><span :class="p.scope === 'own' ? 'text-warn' : 'text-link'">{{ p.scope }}</span></td>
                                    <td class="py-2 text-right"><LucideTrash2 :size="15" class="opacity-40 hover:opacity-100 hover:text-danger cursor-pointer inline" @click="removePerm(p)" /></td>
                                </tr>
                                <tr v-if="!perms.length"><td colspan="4" class="py-4 text-label-3">{{ $t('roles.noPerms') }}</td></tr>
                            </tbody>
                        </table>

                        <!-- add permission row -->
                        <div class="flex gap-2 items-center bg-surface rounded-control p-3">
                            <Select v-model="newPerm.model" :options="modelOptions" optionLabel="label" optionValue="value" unstyled :pt="SELECT_PT" class="flex-1 min-w-0" />
                            <Select v-model="newPerm.action" :options="ACTIONS" unstyled :pt="SELECT_PT" class="w-[130px] shrink-0" />
                            <Select v-model="newPerm.scope" :options="scopeOptions" unstyled :pt="SELECT_PT" class="w-[110px] shrink-0" />
                            <Button unstyled @click="addPerm" :class="BTN.primary">
                                <LucidePlus :size="14" /> {{ $t('roles.addPerm') }}
                            </Button>
                        </div>

                        <!-- Category-scoped article grants: manage articles within a category subtree -->
                        <div class="mt-8 pt-5 border-t border-separator-weak">
                            <h3 class="text-body font-semibold mb-1">{{ $t('roles.categoryGrants') }}</h3>
                            <p class="mb-4" :class="TEXT.caption">{{ $t('roles.categoryGrantsHint') }}</p>

                            <ul v-if="catGrants.length" class="mb-3" :class="FIELD_GROUP">
                                <li v-for="g in catGrants" :key="g.id" class="flex items-center justify-between text-body bg-surface rounded-control px-3 py-2">
                                    <span><span class="font-medium">{{ categoryName(g.resource_id) }}</span> · <span class="bg-indigo-fill text-indigo px-2 py-0.5 rounded-chip text-small">{{ g.access }}</span></span>
                                    <LucideTrash2 :size="15" class="opacity-40 hover:opacity-100 hover:text-danger cursor-pointer" @click="revokeCatGrant(g)" />
                                </li>
                            </ul>
                            <div v-else class="mb-3" :class="TEXT.caption">{{ $t('roles.noCategoryGrants') }}</div>

                            <div class="flex gap-2 items-center bg-surface rounded-control p-3 flex-wrap">
                                <Select v-model="catForm.category_id" :options="categoryOptions" optionLabel="label" optionValue="value" :placeholder="$t('roles.pickCategory')" unstyled :pt="SELECT_PT" class="w-[200px] shrink-0" />
                                <button v-for="a in CAT_ACTIONS" :key="a" @click="toggleCatAccess(a)"
                                    class="px-2.5 h-8 rounded-control text-small border cursor-pointer transition-colors"
                                    :class="catForm.access.includes(a) ? 'bg-accent text-white border-accent' : 'bg-white text-label-2 border-separator hover:bg-canvas'">
                                    {{ a }}
                                </button>
                                <Button unstyled @click="addCatGrant" :class="[BTN.primary, 'ml-auto']">
                                    <LucidePlus :size="14" /> {{ $t('roles.addPerm') }}
                                </Button>
                            </div>
                        </div>
                    </template>
                </template>
            </div>
        </div>
    </div>
</template>
