<script setup lang="ts">
/**
 * 文章的「权限」面板 —— 把原先散在三处、混着三种生效时机、还把 `R U D publish V` 裸字母摊在
 * 界面上的东西,收成一个说人话的面板。
 *
 * 两个正交的轴在这里各占一段:
 *   ①「谁能看到这篇」 = 受众轴(`audience`/`teaser` 两个文章字段)
 *   ②「访问与协作」   = 一份人员名单,每人一个权限档(`resource_grants` 的 access 字符串)
 *
 * **改动立即生效**,不等文章保存 —— 所以新建文章(还没有 id)时整个面板不可用,由调用方禁用入口。
 *
 * 设计与逐条取舍见 docs/editor-access-panel.md。后端一行没动。
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import Select from 'primevue/select';
import Checkbox from 'primevue/checkbox';
import RadioButton from 'primevue/radiobutton';
import Message from 'primevue/message';
import AdminModal from '../../components/AdminModal.vue';
import UserPicker from '../../components/UserPicker.vue';
import { aclAPI, listRole, listUser, updateArticle, ARTICLES_AUDIENCE } from '../../api';
import {
    INHERIT, articleAudienceTiers, categoryStateText, isTeaserLockedByCategory,
    permTierOptions, permTierOf, accessOfPermTier, describeAccess, PERM_CUSTOM,
} from '../../ui/audience';
import {
    BTN_SM, BTN_REMOVE, CHECKBOX_PT, FIELD_GROUP, LABEL_BARE, MESSAGE_PT, RADIO_PT, SELECT_PT, TEXT,
} from '../../ui/presets';
import { LucideInfo, LucideTriangleAlert, LucidePlus, LucideTrash2 } from 'lucide-vue-next';

/**
 * 刻意**不接一个 `article` 对象**:调用方若传行内字面量(`{ ...form, ... }`),正文每敲一个字都会
 * 产生新对象引用,watcher 随之重跑,把用户刚选中的档位打回未保存的旧值。所以只接真正需要的字段,
 * watcher 也只盯这几个。
 */
const props = defineProps<{
    articleId: string | number;
    /** `''` = 继承分类。 */
    audience: string;
    /** `-1` = 继承分类。 */
    teaser: number;
    status: string;
    publishAt: Date | null;
    authorId: any;
    /** 带 annotate 字段的分类行(后端下发 audience_eff / audience_from)。 */
    category: any;
    /** 文章所在分类的祖先链 id(root→parent),用于展示继承来的授权。 */
    ancestorIds?: (string | number)[];
    categories?: any[];
}>();

const emit = defineEmits<{ close: []; changed: [patch: Record<string, any>] }>();

const { t, locale } = useI18n();

// ── ① 谁能看到这篇 ────────────────────────────────────────────────────

const categoryEff = computed(() => props.category?.audience_eff || 'public');
const tiers = computed(() => articleAudienceTiers(t, categoryEff.value, props.category?.name));

/** 当前档位。库里 `audience=''` → INHERIT。 */
const tier = ref<string>(INHERIT);
const teaser = ref<number>(0);

watch(() => [props.audience, props.teaser], ([a, tz]) => {
    tier.value = a ? String(a) : INHERIT;
    teaser.value = Number(tz) === 1 ? 1 : 0;
}, { immediate: true });

/** 有效受众(本文自选 ∪ 分类继承,取更严的) —— 决定摘要开关与名单说明的显隐。 */
const SEVERITY: Record<string, number> = { public: 0, authenticated: 1, restricted: 2 };
const effectiveAudience = computed(() => {
    const own = tier.value === INHERIT ? 'public' : tier.value;
    return (SEVERITY[own] ?? 0) >= (SEVERITY[categoryEff.value] ?? 0) ? own : categoryEff.value;
});
const restricted = computed(() => effectiveAudience.value !== 'public');

/**
 * 分类当前生效的状态 —— **任何时候都标出来**,包括「所有人可见」。
 * 只在受限时才显示的话,作者看到「跟随分类的设置」而下面空着,分不清是"分类本来就是公开的"还是
 * "这行没加载出来" —— 那就是让他猜。
 */
const categoryNote = computed(() => (props.category ? categoryStateText(t, props.category) : ''));

/**
 * 分类链把「完全隐藏」钉死时,文章勾「公开摘要」也不生效(teaser 在各受限层之间取最小值),
 * 所以直接禁用 —— 与"更宽松的受众档位置灰"同一个原则:点了没反应的控件比一句警告更糟。
 */
const teaserLocked = computed(() => isTeaserLockedByCategory(props.category));

const noticeSeverity = computed(() => (props.status === 'hidden' ? 'warn' : 'info'));
const noticeText = computed(() => {
    if (props.status === 'hidden') return t('access.noticeDraft');
    if (props.status === 'scheduled') {
        const at = props.publishAt ? new Date(props.publishAt) : null;
        return t('access.noticeScheduled', {
            time: at ? at.toLocaleString(locale.value === 'zh' ? 'zh-CN' : 'en-US') : '',
        });
    }
    return '';
});

/** 受众/摘要立即生效:只 PATCH 这两个字段,不碰正文(编辑器里未保存的草稿不受影响)。 */
const saving = ref(false);
async function pushAudience(next: { audience?: string; teaser?: number }) {
    const before = { audience: tier.value, teaser: teaser.value };
    saving.value = true;
    try {
        const patch = {
            audience: next.audience !== undefined
                ? (next.audience === INHERIT ? '' : next.audience)
                : (tier.value === INHERIT ? '' : tier.value),
            // 跟随分类档下 teaser 也该继承 —— 回到 -1,而不是留一个僵住的 0/1。
            teaser: (next.audience ?? tier.value) === INHERIT ? -1 : (next.teaser ?? teaser.value),
        };
        await updateArticle(props.articleId, patch as any);
        emit('changed', patch);
    } catch (e: any) {
        // 立即生效的失败必须回滚 UI,否则界面在说谎。
        tier.value = before.audience;
        teaser.value = before.teaser;
        // 错误提示统一由 api.ts 拦截器 → App.vue 的 app-error 弹出(后端消息比通用文案更有信息量)
            console.error(e);
    } finally {
        saving.value = false;
    }
}

const onTierChange = (v: string) => { tier.value = v; pushAudience({ audience: v }); };
const onTeaserChange = () => pushAudience({ teaser: teaser.value });

// ── ② 访问与协作 ─────────────────────────────────────────────────────

const grants = ref<any[]>([]);
const inherited = ref<any[]>([]);
const roles = ref<any[]>([]);
const userNames = ref<Record<number, string>>({});
const pickerVisible = ref(false);

const roleName = (id: any) => {
    const r = roles.value.find((x: any) => x.id == id);
    return r ? (r.label || r.name) : `#${id}`;
};
const granteeLabel = (g: any) => g.grantee_type === 'user'
    ? (userNames.value[g.grantee_id] || `#${g.grantee_id}`)
    : `${roleName(g.grantee_id)}（${t('acl.granteeRole')}）`;

const authorName = computed(() => {
    const id = props.authorId;
    return id != null ? (userNames.value[id] || `#${id}`) : '';
});

async function resolveUserNames(ids: any[]) {
    const want = ids.filter((id) => id != null && userNames.value[id] === undefined);
    if (!want.length) return;
    const res = await listUser({ filter: { id: { $in: want } }, limit: 999 });
    for (const u of res.data || []) userNames.value[u.id] = u.nickname || u.username;
}

async function load() {
    try {
        const [g, r] = await Promise.all([
            aclAPI.list('articles', props.articleId),
            listRole({ limit: 999, orderBy: 'id' }),
        ]);
        grants.value = g.data || [];
        roles.value = r.data || [];

        // 从祖先分类级联下来的**受众**授权:级联到本文却不在本文的名单里,不显示的话作者会在
        // "名单为空"的同时其实已被授权(与分类编辑器里的继承展示同一个道理)。
        const inh: any[] = [];
        for (const cid of props.ancestorIds || []) {
            const cat = (props.categories || []).find((c: any) => Number(c.id) === Number(cid));
            try {
                const res: any = await aclAPI.list(ARTICLES_AUDIENCE, cid);
                for (const row of res.data || []) inh.push({ ...row, _fromName: cat?.name ?? `#${cid}` });
            } catch { /* 无权读就不展示,不是错误 */ }
        }
        inherited.value = inh;

        await resolveUserNames([
            props.authorId,
            ...grants.value.filter((x: any) => x.grantee_type === 'user').map((x: any) => x.grantee_id),
            ...inh.filter((x: any) => x.grantee_type === 'user').map((x: any) => x.grantee_id),
        ]);
    } catch (e) { console.error(e); }
}
watch(() => props.articleId, load, { immediate: true });

/** 每行的当前档位(存量非标准组合 → 'custom',下拉里禁用)。 */
const tierOfRow = (g: any) => permTierOf(g.access);

async function setRowTier(g: any, key: string) {
    if (key === PERM_CUSTOM) return;             // 禁用项,选不中
    const access = accessOfPermTier(key);
    if (!access || access === g.access) return;
    const before = g.access;
    g.access = access;                            // 乐观更新
    try {
        await aclAPI.grant('articles', props.articleId, {
            grantee_type: g.grantee_type, grantee_id: Number(g.grantee_id), access,
        });
    } catch (e: any) {
        g.access = before;
        // 错误提示统一由 api.ts 拦截器 → App.vue 的 app-error 弹出(后端消息比通用文案更有信息量)
            console.error(e);
    }
}

async function removeRow(g: any) {
    try {
        await aclAPI.revoke('articles', props.articleId, g.id);
        grants.value = grants.value.filter((x: any) => x.id !== g.id);
    } catch (e: any) {
        // 错误提示统一由 api.ts 拦截器 → App.vue 的 app-error 弹出(后端消息比通用文案更有信息量)
            console.error(e);
    }
}

async function onUserSelected(u: any) {
    pickerVisible.value = false;
    if (!u?.id) return;
    if (grants.value.some((g: any) => g.grantee_type === 'user' && g.grantee_id == u.id)) return;
    userNames.value[u.id] = u.nickname || u.username;
    // 新人默认「可查看」——最小权限,而不是猜他要编辑。
    const access = accessOfPermTier('view')!;
    try {
        await aclAPI.grant('articles', props.articleId, { grantee_type: 'user', grantee_id: Number(u.id), access });
        await load();
    } catch (e: any) {
        // 错误提示统一由 api.ts 拦截器 → App.vue 的 app-error 弹出(后端消息比通用文案更有信息量)
            console.error(e);
    }
}
</script>

<template>
    <AdminModal :title="$t('access.title')" widthClass="max-w-lg" hideSave
        :cancelText="$t('action.close')" @close="emit('close')">

        <Message v-if="noticeText" :severity="noticeSeverity" :closable="false" unstyled :pt="MESSAGE_PT" class="mb-5">
            <template #icon>
                <LucideTriangleAlert v-if="noticeSeverity === 'warn'" :size="15" />
                <LucideInfo v-else :size="15" />
            </template>
            {{ noticeText }}
        </Message>

        <!-- ① 谁能看到这篇 -->
        <label :class="LABEL_BARE">{{ $t('access.who') }}</label>
        <div class="mt-2" :class="FIELD_GROUP">
            <label v-for="opt in tiers" :key="opt.value" :title="opt.reason || ''"
                class="flex items-start gap-2 rounded-control px-2 py-1.5 transition-colors"
                :class="opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-fill'">
                <RadioButton :modelValue="tier" :value="opt.value" name="audience-tier"
                    :disabled="opt.disabled || saving" unstyled :pt="RADIO_PT" class="mt-0.5"
                    @update:modelValue="onTierChange(opt.value)" />
                <span class="min-w-0">
                    <span class="text-body text-label">
                        {{ opt.value === INHERIT && category?.name
                            ? $t('access.tierInheritOf', { name: category.name }) : opt.label }}
                    </span>
                    <span v-if="opt.value === INHERIT && categoryNote" class="block" :class="TEXT.caption">
                        {{ categoryNote }}
                    </span>
                    <span v-else-if="opt.disabled" class="block" :class="TEXT.caption">{{ opt.reason }}</span>
                </span>
            </label>
        </div>

        <!-- 摘要墙:只在"实际受限"时才有意义;跟随分类档下不出现(那时 teaser 也继承) -->
        <div v-if="restricted && tier !== INHERIT" class="mt-3 pl-2">
            <label class="flex items-start gap-2" :class="teaserLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'">
                <Checkbox unstyled v-model="teaser" :true-value="1" :false-value="0" binary :pt="CHECKBOX_PT"
                    :disabled="teaserLocked || saving" @change="onTeaserChange" />
                <span class="min-w-0">
                    <span class="text-body text-label">{{ $t('access.teaser') }}</span>
                    <!-- 覆盖关系必须说清:分类钉死「完全隐藏」→ 这里改不动;分类允许摘要 →
                         这里取消勾选是**收紧**,生效。 -->
                    <span v-if="teaserLocked" class="block" :class="TEXT.caption">
                        {{ $t('access.teaserLocked', { name: category?.name || '' }) }}
                    </span>
                    <span v-else-if="categoryEff !== 'public' && category?.teaser_eff === 1" class="block" :class="TEXT.caption">
                        {{ $t('access.teaserTightenHint') }}
                    </span>
                </span>
            </label>
        </div>

        <!-- ② 访问与协作 -->
        <div class="mt-6 pt-5 border-t border-separator-weak">
            <label :class="LABEL_BARE">{{ $t('access.people') }}</label>

            <ul class="mt-2" :class="FIELD_GROUP">
                <!-- 作者:靠 own scope 生效、不在 resource_grants 里。不显示的话"我没在名单里
                     为什么能改"没人能理解。 -->
                <li v-if="authorName" class="flex items-center justify-between bg-surface rounded-control px-3 py-2">
                    <span class="text-body text-label min-w-0 truncate">{{ authorName }}</span>
                    <span class="ml-2 shrink-0" :class="TEXT.caption">{{ $t('access.authorRow') }}</span>
                </li>

                <li v-for="g in grants" :key="g.id" class="bg-surface rounded-control px-3 py-2">
                    <div class="flex items-center gap-2">
                        <span class="text-body text-label min-w-0 flex-1 truncate">{{ granteeLabel(g) }}</span>
                        <Select :modelValue="tierOfRow(g)" @update:modelValue="setRowTier(g, $event)"
                            :options="permTierOptions($t, g.access)" optionLabel="label" optionValue="value"
                            optionDisabled="disabled" unstyled :pt="SELECT_PT" class="w-[130px] shrink-0" />
                        <button @click="removeRow(g)" :class="BTN_REMOVE"><LucideTrash2 :size="15" /></button>
                    </div>
                    <p v-if="tierOfRow(g) === PERM_CUSTOM" class="mt-1" :class="TEXT.caption">
                        {{ $t('access.customIs', { list: describeAccess($t, g.access) }) }}
                    </p>
                    <p v-else-if="!restricted && tierOfRow(g) === 'view'" class="mt-1" :class="TEXT.caption">
                        {{ $t('access.redundantView') }}
                    </p>
                </li>

                <!-- 从上级分类级联下来的受众授权(只读) -->
                <li v-for="g in inherited" :key="`inh-${g.id}`"
                    class="flex items-center justify-between bg-surface/60 rounded-control px-3 py-2 opacity-75">
                    <span class="text-body text-label min-w-0 truncate">{{ granteeLabel(g) }}</span>
                    <span class="ml-2 shrink-0" :class="TEXT.caption">
                        {{ $t('access.inheritedFrom', { name: g._fromName }) }} · {{ $t('access.readOnly') }}
                    </span>
                </li>
            </ul>

            <p v-if="restricted && !grants.length && !inherited.length" class="mt-2" :class="TEXT.caption">
                {{ $t('access.emptyListWarn') }}
            </p>

            <div class="mt-3 flex items-center gap-3">
                <Button unstyled @click="pickerVisible = true" :class="BTN_SM.secondary">
                    <LucidePlus :size="14" /> {{ $t('access.addPerson') }}
                </Button>
            </div>

            <Message severity="info" :closable="false" unstyled :pt="MESSAGE_PT" class="mt-4">
                <template #icon><LucideInfo :size="15" /></template>
                {{ $t('access.immediate') }}
            </Message>
        </div>

        <UserPicker v-model:visible="pickerVisible" @select="onUserSelected" />
    </AdminModal>
</template>
