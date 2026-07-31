<script setup lang="ts">

import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import { marked } from 'marked';
import { getArticle, createArticle, updateArticle, lifecycleAPI, uploadAPI } from '../../api';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import { LucideChevronLeft, LucideSave, LucideLock, LucideRotateCcw, LucideSettings, LucideX } from 'lucide-vue-next';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { useI18n } from 'vue-i18n';
import { BTN, BTN_ICON, CARD, FIELD_GROUP, LABEL_BARE, LINK } from '../../ui/presets';
import EditorPanel from './EditorPanel.vue';
import ArticlePublishButton from './ArticlePublishButton.vue';
import ArticleAccessPanel from './ArticleAccessPanel.vue';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();
const { t } = useI18n();

const isEdit = !!route.params.id;
const articleId = ref<string | number | null>(route.params.id ? (route.params.id as string) : null);

// Content fields only. status/publish_at are lifecycle-managed on the backend (not sent here).
const form = ref({
    category_id: 0, content_template: "", is_top: 0,
    // 受众轴:'' = 继承栏目,-1 = teaser 继承栏目(见 docs/public-access.md §2)
    audience: "", teaser: -1,
    title: '', slug: '', description: '', thumbnail: '', content: '',
    data: {} as Record<string, any>   // custom fields declared by the category (article_data_fields)
});
const status = ref<string>('hidden');       // hidden | scheduled | visible
const publishAt = ref<Date | null>(null);    // scheduled publish time
const articleAuthorId = ref<any>(null);      // 只用于权限面板里的作者行

/**
 * DYAPI 会把空的 Date 列返回成**字符串 `"null"`**(和 `data` 字段返回 `'null'` 是同一个毛病),
 * 而 `new Date("null")` 是 Invalid Date —— 直接喂给 DatePicker 就是满屏 NaN。
 * 所以日期一律在边界处归一:非法值统一收成 `null`。
 */
const toDate = (v: any): Date | null => {
    if (v == null || v === '' || v === 'null') return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};
const revisions = ref<any[]>([]);
/** 「权限」面板 —— 独立弹窗,改动立即生效(见 docs/editor-access-panel.md)。 */
const accessOpen = ref(false);

const loading = ref(false);
const categories = ref<any[]>([]);
const categoryOptions = computed(() => { const opts = [{ label: '-', value: 0 }]; categories.value.forEach(c => opts.push({ label: c.name, value: c.id })); return opts; });

// Custom field definitions for the selected category, derived from the categories we already
// loaded — `manageableCategories` returns whole rows, so no extra request is needed.
// article_data_fields arrives normalised by DYAPI as object | null | '' — collapse all three.
// Being a computed, it also re-derives when the user switches category, without touching form.data.
/** 当前分类行(带后端算好的 audience_eff / audience_from),权限面板据此禁用更宽松的档位。 */
const currentCategory = computed(() =>
    categories.value.find((c: any) => Number(c.id) === Number(form.value.category_id)));

/** 当前分类的祖先链 id(root→parent),用于展示级联下来的受众授权。 */
const ancestorCategoryIds = computed(() => {
    const byId = new Map(categories.value.map((c: any) => [Number(c.id), c]));
    const out: number[] = [];
    const seen = new Set<number>();
    let id = Number(currentCategory.value?.parent_id) || 0;
    while (id > 0 && byId.has(id) && !seen.has(id)) {
        seen.add(id);
        out.unshift(id);
        id = Number(byId.get(id)!.parent_id) || 0;
    }
    return out;
});

/**
 * 分类给作者的正文格式说明(`categories.editor_hint`),渲染在正文编辑器上方。
 *
 * 自定义字段靠 title 自解释,而"正文里该按什么格式写"以前没有任何地方能说 —— 比如 neo 主题的
 * 成员页要求正文里有一个 `:::works` 块。内容由 super_admin 在分类里维护,和正文一样走 marked
 * (同一处 v-html 风险面,已记在 CLAUDE.md 的待硬化清单)。为空时整块不渲染,不占位。
 */
const editorHint = computed(() => {
    const cat = categories.value.find((c: any) => Number(c.id) === Number(form.value.category_id));
    const raw = String(cat?.editor_hint || '').trim();
    return raw ? (marked.parse(raw) as string) : '';
});

const articleDataFields = computed(() => {
    const cat = categories.value.find((c: any) => Number(c.id) === Number(form.value.category_id));
    const raw = cat?.article_data_fields;
    const obj = (raw && typeof raw === 'object') ? raw as Record<string, any> : {};
    return Object.entries(obj).map(([key, def]: [string, any]) => ({
        key,
        title: def?.title || key,
        type: def?.type || 'text',
    }));
});

onMounted(async () => {
    try {
        // Only categories the user may create in (new) or manage (edit) — backend-filtered.
        const res = await lifecycleAPI.manageableCategories(isEdit ? undefined : 'C');
        categories.value = res.data?.categories || [];
    } catch(e) { console.error('Failed to load categories', e); }
});

const loadArticle = async () => {
    if (!articleId.value) return;
    const res = await getArticle(articleId.value);
    const item = res.data;
    if (!item) return;
    form.value = {
        title: item.title || '', slug: item.slug || '', description: item.description || '',
        thumbnail: item.thumbnail || '', content: item.content || '',
        category_id: item.category_id || 0, content_template: item.content_template || '', is_top: item.is_top || 0,
        audience: item.audience || '', teaser: item.teaser === undefined ? -1 : Number(item.teaser),
        // `data` comes back as object | null | '' (DYAPI JSON.parse with a swallowed error) — normalise.
        data: (item.data && typeof item.data === 'object') ? item.data : {}
    };
    status.value = item.status || 'hidden';
    // 权限面板要显示"作者 · 始终可编辑"那一行(作者靠 own scope 生效,不在 resource_grants 里),
    // 且 publish_at 决定定时按钮显示什么时间 —— 两者都不是表单字段,单独存。
    articleAuthorId.value = item.author_id ?? null;
    publishAt.value = toDate(item.publish_at);
};

const loadRevisions = async () => {
    if (!articleId.value) return;
    try {
        const res = await lifecycleAPI.revisions('articles', articleId.value);
        revisions.value = res.data || [];
    } catch (e) { console.error(e); }
};

onMounted(async () => {
    if (isEdit) { await loadArticle(); await loadRevisions(); }
});

const refresh = async () => { await loadArticle(); await loadRevisions(); };

// Persist content fields (create or update). Returns the article id, or null on validation failure.
const persist = async (): Promise<string | number | null> => {
    if (Number(form.value.category_id) === 0) {
        toast.add({ severity: 'warn', summary: 'Warning', detail: t('validate.selectCategory'), life: 3000 });
        return null;
    }
    loading.value = true;
    try {
        if (articleId.value) {
            await updateArticle(articleId.value, { ...form.value });
        } else {
            const res = await createArticle({ ...form.value }); // author_id set server-side
            articleId.value = res.id ?? null;         // HTTPCreate returns { code, id }
        }
        return articleId.value;
    } finally {
        loading.value = false;
    }
};

const saveDraft = async () => {
    const id = await persist();
    if (id) { toast.add({ severity: 'success', summary: 'Success', detail: t('toast.saved'), life: 2500 }); await loadRevisions(); }
};

const publish = async () => {
    const id = await persist();
    if (!id) return;
    await lifecycleAPI.transition('articles', id, { to: 'visible' });
    status.value = 'visible';
    toast.add({ severity: 'success', summary: 'Success', detail: t('toast.published'), life: 2500 });
    await refresh();
};

const unpublish = async () => {
    if (!articleId.value) return;
    await lifecycleAPI.transition('articles', articleId.value, { to: 'hidden' });
    status.value = 'hidden';
    toast.add({ severity: 'info', summary: 'Info', detail: t('toast.hidden'), life: 2500 });
    await refresh();
};

/** 时间由头部的发布按钮组件给(它自带选时间的对话框),这里只负责落库。 */
const schedule = async (when: Date) => {
    if (!when) return;
    const id = await persist();
    if (!id) return;
    await lifecycleAPI.transition('articles', id, { to: 'scheduled', publish_at: when.toISOString() });
    status.value = 'scheduled';
    publishAt.value = when;
    toast.add({ severity: 'success', summary: 'Success', detail: t('toast.scheduled'), life: 2500 });
    await refresh();
};

/** 取消定时 = 退回草稿(同一个 transition 接口)。 */
const cancelSchedule = async () => {
    if (!articleId.value) return;
    await lifecycleAPI.transition('articles', articleId.value, { to: 'hidden' });
    status.value = 'hidden';
    publishAt.value = null;
    toast.add({ severity: 'info', summary: 'Info', detail: t('toast.scheduleCancelled'), life: 2500 });
    await refresh();
};

const rollback = (versionNo: number) => {
    if (!articleId.value) return;
    confirm.require({
        header: t('confirm.title'),
        message: t('confirm.rollbackMsg', { v: versionNo }),
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: t('confirm.accept'),
        rejectLabel: t('confirm.reject'),
        accept: async () => {
            await lifecycleAPI.rollback('articles', articleId.value, versionNo);
            toast.add({ severity: 'success', summary: 'Success', detail: t('toast.rolledBack', { v: versionNo }), life: 2500 });
            await refresh();
        }
    });
};


const autoSlug = () => {
    if(!form.value.slug && form.value.title) {
        form.value.slug = form.value.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/(^-|-$)+/g, '');
    }
};

// md-editor-v3's upload contract (a callback, not a UI control) — kept, but sharing the
// same multipart helper as everything else. All other file inputs live in FileUploader.
const onUploadImg = async (files: File[], callback: (urls: string[]) => void) => {
    const res = await uploadAPI.uploadFiles(files);
    if (res?.data) callback(res.data.map((item: any) => item.url));
};

// The property panel is a `hidden lg:block` sidebar on wide screens; below lg it is the only
// way to reach category_id (a save-blocking required field), so it also mounts in a drawer.
const isMobile = ref(false);
const showMobilePanel = ref(false);
const checkMobile = () => { isMobile.value = window.innerWidth < 1024; };
onMounted(() => { checkMobile(); window.addEventListener('resize', checkMobile); });
onBeforeUnmount(() => { window.removeEventListener('resize', checkMobile); });
</script>

<template>
    <div class="h-full flex flex-col pt-6 pb-0 px-6 max-w-screen-2xl mx-auto">
        <div class="flex justify-between items-center mb-6">
            <div class="flex items-center gap-4">
                <Button unstyled @click="router.push('/admin/articles')" :class="BTN_ICON.nav">
                    <LucideChevronLeft :size="20" />
                </Button>
                <div>
                    <h1 class="text-[28px] font-semibold leading-[1.14] tracking-[0.196px]">{{ isEdit ? $t('action.edit') : $t('action.new') }}</h1>
                </div>
            </div>

            <!-- 三个按钮:保存 / 权限 / 发布▼。状态由第三个按钮自己表达,不再有单独的状态 chip。
                 见 docs/editor-access-panel.md §4。 -->
            <div class="flex gap-2 items-center">
                <Button unstyled @click="saveDraft" :disabled="loading" :class="BTN.secondary">
                    <LucideSave :size="16" /> <span class="hidden sm:inline">{{ $t('action.save') }}</span>
                </Button>
                <!-- 立即生效需要文章 id,所以新建态禁用并解释。 -->
                <Button unstyled @click="accessOpen = true" :disabled="!isEdit || loading"
                    :title="!isEdit ? $t('access.newArticleHint') : ''" :class="BTN.secondary">
                    <LucideLock :size="16" /> <span class="hidden sm:inline">{{ $t('access.title') }}</span>
                </Button>
                <ArticlePublishButton :status="(status as any)" :publish-at="publishAt" :loading="loading"
                    :is-mobile="isMobile" @publish="publish" @unpublish="unpublish"
                    @schedule="schedule" @cancel-schedule="cancelSchedule" />
            </div>
        </div>

        <div class="flex-1 flex gap-6 pb-6 h-[calc(100vh-140px)]">
            <div class="flex-1 flex flex-col overflow-hidden" :class="CARD">
                <div class="px-6 py-4 border-b border-separator-weak flex flex-col gap-2">
                    <InputText unstyled v-model="form.title" @blur="autoSlug" :placeholder="$t('form.title')" class="w-full text-title-page font-semibold outline-none placeholder:opacity-30" />
                </div>
                <!-- 分类给作者的正文格式说明。为空时整块不存在,不占位。 -->
                <div v-if="editorHint" class="editor-hint px-6 py-3 border-b border-separator-weak bg-info-fill text-body text-label"
                    v-html="editorHint"></div>
                <div class="flex-1 overflow-hidden" style="--md-bk-color: transparent;">
                    <MdEditor v-model="form.content" @onUploadImg="onUploadImg" :language="$i18n.locale === 'zh' ? 'zh-CN' : 'en-US'" class="h-full border-none!" previewTheme="github" />
                </div>
            </div>

            <div class="w-[320px] shrink-0 overflow-y-auto p-6 hidden lg:block" :class="CARD">
                <h3 class="text-title-section font-medium tracking-[0.231px] mb-6">{{ $t('article.properties') }}</h3>

                <EditorPanel :form="form" :category-options="categoryOptions" :article-data-fields="articleDataFields" :categories="categories" />

                <div v-if="isEdit && revisions.length" class="mt-6 pt-4 border-t border-separator-weak">
                    <label class="mb-3 flex items-center gap-1" :class="LABEL_BARE"><LucideRotateCcw :size="14" /> {{ $t('article.history') }}</label>
                    <ul class="max-h-[220px] overflow-y-auto" :class="FIELD_GROUP">
                        <li v-for="rev in revisions" :key="rev.version_no" class="flex items-center justify-between text-small bg-surface rounded-control px-3 py-2">
                            <div class="min-w-0">
                                <div class="font-medium text-label">v{{ rev.version_no }} · {{ rev.note }}</div>
                                <div class="text-label-3 truncate">{{ rev.created_at ? new Date(rev.created_at).toLocaleString() : '' }}</div>
                            </div>
                            <button @click="rollback(rev.version_no)" class="shrink-0 ml-2" :class="LINK.small">{{ $t('action.rollback') }}</button>
                        </li>
                    </ul>
                </div>

            </div>
        </div>

        <ArticleAccessPanel v-if="accessOpen && articleId" :article-id="articleId"
            :audience="form.audience" :teaser="form.teaser" :status="status" :publish-at="publishAt"
            :author-id="articleAuthorId"
            :category="currentCategory" :ancestor-ids="ancestorCategoryIds" :categories="categories"
            @close="accessOpen = false"
            @changed="(patch) => { form.audience = patch.audience; form.teaser = patch.teaser; }" />

        <!-- Below lg the sidebar is hidden, so the same panel opens as a drawer. -->
        <button v-if="isMobile" @click="showMobilePanel = true"
            class="fixed right-4 bottom-6 z-40 w-14 h-14 rounded-full bg-accent text-white shadow-lg flex items-center justify-center hover:bg-accent-hover transition-colors cursor-pointer">
            <LucideSettings :size="22" />
        </button>

        <Teleport to="body">
            <Transition name="fade">
                <div v-if="showMobilePanel && isMobile" class="fixed inset-0 z-50 bg-label/40" @click="showMobilePanel = false"></div>
            </Transition>
            <Transition name="slide">
                <div v-if="showMobilePanel && isMobile"
                    class="fixed right-0 top-0 bottom-0 z-50 w-[85vw] max-w-[380px] bg-white shadow-2xl overflow-y-auto p-6">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-title-section font-medium tracking-[0.231px]">{{ $t('article.properties') }}</h3>
                        <button @click="showMobilePanel = false" :class="BTN_ICON.subtle">
                            <LucideX :size="16" />
                        </button>
                    </div>
                    <EditorPanel :form="form" :category-options="categoryOptions" :article-data-fields="articleDataFields" :categories="categories" />
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }

.slide-enter-active,
.slide-leave-active { transition: transform 0.25s ease; }
.slide-enter-from,
.slide-leave-to { transform: translateX(100%); }

/**
 * 分类提示的最小排版。必须用 `:deep()` —— 内容来自 `v-html`,那些节点没有 scoped 属性,
 * 普通选择器一条都不生效(主题那边踩过同一个坑,见 frontend_themes/neo/prose.css 顶部注释)。
 * 后台没有 prose 层,所以这里只补最少的几条:段距、列表、行内码、可点的链接。
 */
.editor-hint :deep(p) { margin: 0 0 0.4em; }
.editor-hint :deep(p:last-child) { margin-bottom: 0; }
.editor-hint :deep(ul),
.editor-hint :deep(ol) { margin: 0.3em 0; padding-left: 1.3em; list-style: disc; }
.editor-hint :deep(ol) { list-style: decimal; }
.editor-hint :deep(code) {
  font-family: ui-monospace, monospace;
  font-size: 0.9em;
  padding: 0.05em 0.3em;
  background: var(--color-white);
  border: 1px solid var(--color-separator);
  border-radius: var(--radius-chip);
}
.editor-hint :deep(pre) {
  margin: 0.4em 0;
  padding: 0.6em 0.8em;
  background: var(--color-white);
  border: 1px solid var(--color-separator);
  border-radius: var(--radius-control);
  overflow-x: auto;
}
.editor-hint :deep(pre code) { border: 0; padding: 0; background: none; }
.editor-hint :deep(a) { color: var(--color-link); text-decoration: underline; }
.editor-hint :deep(strong) { font-weight: 600; }
</style>
