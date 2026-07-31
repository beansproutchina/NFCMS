<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { ref, onMounted, computed, watch } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { listRole, createRole as apiCreateRole, removeRole, listRolePermission, createRolePermission,
         removeRolePermission, listResourceGrant, listCategory,
         schemaAPI, aclAPI, ARTICLES_CATEGORY, ARTICLES_AUDIENCE, VIEW_ACTION } from '../../api';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { LucidePlus, LucideTrash2 } from 'lucide-vue-next';
import { BTN, FIELD_GROUP, INPUT_CLASS_SM, PAGE, SECTION_TITLE, SELECT_PT, TEXT, TOGGLE } from '../../ui/presets';
const { t } = useI18n();

const toast = useToast();
const confirm = useConfirm();

const roles = ref<any[]>([]);
const selectedRole = ref<any>(null);
const perms = ref<any[]>([]);
const loading = ref(false);

// New-role form
const newRole = ref({ name: '', label: '' });
// New-permission row
const newPerm = ref({ model: '', action: 'R', scope: 'any' });

/**
 * 只列**引擎真的会判**的模型与动作。
 *
 * 这里过去列出后端注册的全部 13 张表、固定 5 个动作、固定两种 scope,而 RBAC(PolicyService)
 * 只管继承了 CMSModel 的表:给 `users` / `categories` / `menus` / RBAC 自身那三张表配一行权限,
 * 写进库里也没人读 —— 它们走 dyapi 的静态 permission map,只认 super_admin。同理,没有属主列的
 * 模型配 `own` 是静默无效,没有生命周期字段的模型(附件)根本谈不上 `publish`。
 *
 * 判据来自后端 `/schema` 的 `rbacActions` 与 `ownerField`(由模型自己声明,见 CMSModel),
 * 不在前端猜。空 `rbacActions` = 这张表不由 RBAC 管,直接不出现在下拉里。
 */
const models = ref<any[]>([]);
const rbacModels = computed(() => models.value.filter((m: any) => (m.rbacActions || []).length > 0));
const modelOptions = computed(() => rbacModels.value.map((m: any) => ({ label: `${m.modelName} (${m.tableName})`, value: m.tableName })));
const currentModel = computed(() => rbacModels.value.find((m: any) => m.tableName === newPerm.value.model));
const actionOptions = computed(() => currentModel.value?.rbacActions || ['R']);
// "own" is meaningless for create (whatever you create is yours) — only offer "any" for C.
// Category-limited create is expressed via the category grants section below.
const scopeOptions = computed(() => {
    if (newPerm.value.action === 'C') return ['any'];
    return currentModel.value?.ownerField ? ['any', 'own'] : ['any'];
});
// 换模型/动作后,原来选中的值可能已经不在候选里 —— 收回到合法值,别提交出一条无效权限。
watch([() => newPerm.value.model, () => newPerm.value.action], () => {
    if (!actionOptions.value.includes(newPerm.value.action)) newPerm.value.action = actionOptions.value[0];
    if (!scopeOptions.value.includes(newPerm.value.scope)) newPerm.value.scope = scopeOptions.value[0];
});

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
    if (!selectedRole.value || catForm.value.category_id == null) { toast.add({ severity: 'warn', summary: 'Warning', detail: t('validate.selectCategory'), life: 2500 }); return; }
    if (!catForm.value.access.length) { toast.add({ severity: 'warn', summary: 'Warning', detail: t('validate.selectPermission'), life: 2500 }); return; }
    const access = CAT_ACTIONS.filter((a) => catForm.value.access.includes(a)).join(',');
    await aclAPI.grant(ARTICLES_CATEGORY, catForm.value.category_id, { grantee_type: 'role', grantee_id: selectedRole.value.id, access });
    toast.add({ severity: 'success', summary: 'Success', detail: t('toast.granted'), life: 2000 });
    catForm.value = { category_id: null, access: [] };
    await loadCatGrants();
};

const revokeCatGrant = async (g: any) => {
    await aclAPI.revoke(ARTICLES_CATEGORY, g.resource_id, g.id);
    await loadCatGrants();
};

// --- 受众轴:该角色可在公开站查看哪些受限栏目(动作 V) ---
// 与上面的分类授权同构,只换合成 model 与动作 —— 见 docs/public-access.md §2。
const audGrants = ref<any[]>([]);
const audForm = ref<{ category_id: any }>({ category_id: null });

const loadAudGrants = async () => {
    if (!selectedRole.value) { audGrants.value = []; return; }
    const res = await listResourceGrant({
        filter: { $and: { model: ARTICLES_AUDIENCE, grantee_type: 'role', grantee_id: selectedRole.value.id } },
        limit: 999,
    });
    audGrants.value = res.data || [];
};

const addAudGrant = async () => {
    if (!selectedRole.value || audForm.value.category_id == null) {
        toast.add({ severity: 'warn', summary: 'Warning', detail: t('validate.selectCategory'), life: 2500 }); return;
    }
    await aclAPI.grant(ARTICLES_AUDIENCE, audForm.value.category_id,
        { grantee_type: 'role', grantee_id: selectedRole.value.id, access: VIEW_ACTION });
    toast.add({ severity: 'success', summary: 'Success', detail: t('toast.granted'), life: 2000 });
    audForm.value = { category_id: null };
    await loadAudGrants();
};

const revokeAudGrant = async (g: any) => {
    await aclAPI.revoke(ARTICLES_AUDIENCE, g.resource_id, g.id);
    await loadAudGrants();
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
    await loadAudGrants();
};

const createRole = async () => {
    if (!newRole.value.name) { toast.add({ severity: 'warn', summary: 'Warning', detail: t('validate.roleNameRequired'), life: 2500 }); return; }
    try {
        await apiCreateRole({ name: newRole.value.name, label: newRole.value.label || newRole.value.name });
        newRole.value = { name: '', label: '' };
        toast.add({ severity: 'success', summary: 'Success', detail: t('toast.roleCreated'), life: 2500 });
        await loadRoles();
    } catch (e) { console.error(e); }
};

const deleteRole = async (r: any) => {
    if (r.is_system) { toast.add({ severity: 'warn', summary: 'Warning', detail: t('validate.systemRoleUndeletable'), life: 2500 }); return; }
    confirm.require({
        header: t('confirm.title'), message: t('confirm.deleteRole', { name: r.label || r.name }),
        accept: async () => {
            await removeRole(r.id);
            if (selectedRole.value?.id === r.id) selectedRole.value = null;
            toast.add({ severity: 'success', summary: 'Success', detail: t('toast.roleDeleted'), life: 2500 });
            await loadRoles();
        },
    });
};

const addPerm = async () => {
    if (!newPerm.value.model) { toast.add({ severity: 'warn', summary: 'Warning', detail: t('validate.modelRequired'), life: 2500 }); return; }
    await createRolePermission({
        role_id: selectedRole.value.id,
        model: newPerm.value.model.trim(),
        action: newPerm.value.action,
        scope: newPerm.value.scope
    });
    newPerm.value = { model: newPerm.value.model, action: 'R', scope: 'any' };
    toast.add({ severity: 'success', summary: 'Success', detail: t('toast.permissionAdded'), life: 2000 });
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
            if (rbacModels.value.length && !newPerm.value.model) newPerm.value.model = rbacModels.value[0].tableName;
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
                            <Select v-model="newPerm.action" :options="actionOptions" unstyled :pt="SELECT_PT" class="w-[130px] shrink-0" />
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
                                    :class="[TOGGLE.base, catForm.access.includes(a) ? TOGGLE.on : TOGGLE.off]">
                                    {{ a }}
                                </button>
                                <Button unstyled @click="addCatGrant" :class="[BTN.primary, 'ml-auto']">
                                    <LucidePlus :size="14" /> {{ $t('roles.addPerm') }}
                                </Button>
                            </div>
                        </div>

                        <!-- 受众轴:该角色在公开站可查看哪些受限栏目(只读,不含编辑权) -->
                        <div class="mt-8 pt-5 border-t border-separator-weak">
                            <h3 class="text-body font-semibold mb-1">{{ $t('roles.audienceGrants') }}</h3>
                            <p class="mb-4" :class="TEXT.caption">{{ $t('roles.audienceGrantsHint') }}</p>

                            <ul v-if="audGrants.length" class="mb-3" :class="FIELD_GROUP">
                                <li v-for="g in audGrants" :key="g.id" class="flex items-center justify-between text-body bg-surface rounded-control px-3 py-2">
                                    <span><span class="font-medium">{{ categoryName(g.resource_id) }}</span> · <span class="bg-indigo-fill text-indigo px-2 py-0.5 rounded-chip text-small">{{ g.access }}</span></span>
                                    <LucideTrash2 :size="15" class="opacity-40 hover:opacity-100 hover:text-danger cursor-pointer" @click="revokeAudGrant(g)" />
                                </li>
                            </ul>
                            <div v-else class="mb-3" :class="TEXT.caption">{{ $t('roles.noAudienceGrants') }}</div>

                            <div class="flex gap-2 items-center bg-surface rounded-control p-3 flex-wrap">
                                <Select v-model="audForm.category_id" :options="categoryOptions" optionLabel="label" optionValue="value" :placeholder="$t('roles.pickCategory')" unstyled :pt="SELECT_PT" class="w-[200px] shrink-0" />
                                <Button unstyled @click="addAudGrant" :class="[BTN.primary, 'ml-auto']">
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
