<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import Button from 'primevue/button';
import Select from 'primevue/select';
import { listUser, listRole, aclAPI } from '../api';
import { useToast } from 'primevue/usetoast';
import { LucideTrash2, LucidePlus } from 'lucide-vue-next';
import UserPicker from './UserPicker.vue';
import { BTN, FIELD_GROUP, LABEL_BARE, SELECT_PT, TEXT } from '../ui/presets';

/**
 * Reusable resource-ACL editor. Lists grants for (model, resourceId) and lets the user
 * grant/revoke access to a user or role. Used for article row-sharing (model="articles")
 * and category-scoped article grants (model="articles_category", resourceId=category id).
 */
const props = withDefaults(defineProps<{
    model: string;
    resourceId: string | number | null;
    actions?: string[];   // access letters offered as toggles
    title?: string;
}>(), { actions: () => ['R', 'U', 'D'], title: '' });

const toast = useToast();
const grants = ref<any[]>([]);
const roles = ref<any[]>([]);
const userNames = ref<Record<number, string>>({});
const pickerVisible = ref(false);

const form = ref<{ grantee_type: 'user' | 'role'; grantee_id: any; user_label: string }>({
    grantee_type: 'user', grantee_id: null, user_label: '',
});
const selectedAccess = ref<string[]>([]);

const granteeTypeOptions = computed(() => [
    { label: '用户', value: 'user' },
    { label: '角色', value: 'role' },
]);
const roleOptions = computed(() => roles.value.map((r: any) => ({ label: r.label || r.name, value: r.id })));

const roleName = (id: number) => { const r = roles.value.find((x: any) => x.id == id); return r ? (r.label || r.name) : `#${id}`; };
const granteeLabel = (g: any) => g.grantee_type === 'user'
    ? `用户 ${userNames.value[g.grantee_id] || '#' + g.grantee_id}`
    : `角色 ${roleName(g.grantee_id)}`;

const load = async () => {
    if (props.resourceId == null) { grants.value = []; return; }
    try {
        const res = await aclAPI.list(props.model, props.resourceId);
        grants.value = res.data || [];
        // Resolve usernames for user grantees (one batched read).
        const uids = grants.value.filter((g: any) => g.grantee_type === 'user').map((g: any) => g.grantee_id);
        if (uids.length) {
            const ur = await listUser({ filter: { id: { $in: uids } }, limit: 999 });
            for (const u of (ur.data || [])) userNames.value[u.id] = u.nickname || u.username;
        }
    } catch (e) { console.error(e); }
};

const toggleAccess = (a: string) => {
    const i = selectedAccess.value.indexOf(a);
    if (i >= 0) selectedAccess.value.splice(i, 1); else selectedAccess.value.push(a);
};

const onUserSelected = (u: any) => { form.value.grantee_id = u.id; form.value.user_label = u.nickname || u.username; };

const addGrant = async () => {
    if (props.resourceId == null) return;
    if (form.value.grantee_id == null) { toast.add({ severity: 'warn', summary: 'Warning', detail: '请选择被授权对象', life: 2500 }); return; }
    if (!selectedAccess.value.length) { toast.add({ severity: 'warn', summary: 'Warning', detail: '请至少选择一项权限', life: 2500 }); return; }
    // Preserve the natural C,R,U,D,publish order.
    const access = props.actions.filter((a) => selectedAccess.value.includes(a)).join(',');
    try {
        await aclAPI.grant(props.model, props.resourceId, { grantee_type: form.value.grantee_type, grantee_id: Number(form.value.grantee_id), access });
        toast.add({ severity: 'success', summary: 'Success', detail: '已授予', life: 2000 });
        form.value = { grantee_type: form.value.grantee_type, grantee_id: null, user_label: '' };
        selectedAccess.value = [];
        await load();
    } catch (e) { console.error(e); }
};

const revoke = async (g: any) => {
    if (props.resourceId == null) return;
    try { await aclAPI.revoke(props.model, props.resourceId, g.id); await load(); } catch (e) { console.error(e); }
};

onMounted(async () => {
    try { const rr = await listRole({ limit: 999 }); roles.value = rr.data || []; } catch (e) { console.error(e); }
    await load();
});
watch(() => [props.model, props.resourceId], load);
</script>

<template>
    <div>
        <label v-if="title" class="mb-3 block" :class="LABEL_BARE">{{ title }}</label>

        <ul v-if="grants.length" class="mb-3" :class="FIELD_GROUP">
            <li v-for="g in grants" :key="g.id" class="flex items-center justify-between text-small bg-surface rounded-control px-3 py-2">
                <span class="text-label min-w-0 truncate">{{ granteeLabel(g) }} · <span class="font-medium">{{ g.access }}</span></span>
                <button @click="revoke(g)" class="text-danger hover:text-danger-hover shrink-0 ml-2 cursor-pointer"><LucideTrash2 :size="15" /></button>
            </li>
        </ul>
        <div v-else class="mb-3" :class="TEXT.caption">{{ $t('acl.none') }}</div>

        <div class="bg-surface rounded-control p-3" :class="FIELD_GROUP">
            <div class="flex gap-2">
                <Select v-model="form.grantee_type" :options="granteeTypeOptions" optionLabel="label" optionValue="value" unstyled :pt="SELECT_PT" class="w-[96px] shrink-0" @change="form.grantee_id = null; form.user_label = ''" />
                <template v-if="form.grantee_type === 'user'">
                    <button @click="pickerVisible = true" class="flex-1 min-w-0 h-10 px-3 border border-separator rounded-control text-body bg-white text-left truncate cursor-pointer hover:border-accent">
                        <span v-if="form.user_label">{{ form.user_label }}</span>
                        <span v-else class="text-label-3">{{ $t('acl.pickUser') }}</span>
                    </button>
                </template>
                <Select v-else v-model="form.grantee_id" :options="roleOptions" optionLabel="label" optionValue="value" :placeholder="$t('acl.pickRole')" unstyled :pt="SELECT_PT" class="flex-1 min-w-0" />
            </div>

            <div class="flex flex-wrap gap-1.5">
                <button v-for="a in actions" :key="a" @click="toggleAccess(a)"
                    class="px-2.5 h-8 rounded-control text-small border cursor-pointer transition-colors"
                    :class="selectedAccess.includes(a) ? 'bg-accent text-white border-accent' : 'bg-white text-label-2 border-separator hover:bg-canvas'">
                    {{ a }}
                </button>
                <Button unstyled @click="addGrant" :class="[BTN.primary, 'ml-auto']"><LucidePlus :size="14" /> {{ $t('acl.add') }}</Button>
            </div>
        </div>

        <UserPicker v-model:visible="pickerVisible" @select="onUserSelected" />
    </div>
</template>
