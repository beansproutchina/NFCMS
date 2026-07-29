<script setup lang="ts">

import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import { getArticle, createArticle, updateArticle, lifecycleAPI, contentAPI, uploadAPI } from '../../api';
import InputText from 'primevue/inputtext';
import DatePicker from 'primevue/datepicker';
import Button from 'primevue/button';
import { LucideChevronLeft, LucideEye, LucideSave, LucideCheck, LucideEyeOff, LucideClock, LucideRotateCcw, LucideSettings, LucideX } from 'lucide-vue-next';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { useI18n } from 'vue-i18n';
import { DATEPICKER_PT, BTN } from '../../ui/presets';
import AclEditor from '../../components/AclEditor.vue';
import EditorPanel from './EditorPanel.vue';

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
    title: '', slug: '', description: '', thumbnail: '', content: '',
    data: {} as Record<string, any>   // custom fields declared by the category (article_data_fields)
});
const status = ref<string>('hidden');       // hidden | scheduled | visible
const publishAt = ref<Date | null>(null);    // scheduled publish time
const revisions = ref<any[]>([]);

const loading = ref(false);
const categories = ref<any[]>([]);
const categoryOptions = computed(() => { const opts = [{ label: '-', value: 0 }]; categories.value.forEach(c => opts.push({ label: c.name, value: c.id })); return opts; });

// Custom field definitions for the selected category, derived from the categories we already
// loaded — `manageableCategories` returns whole rows, so no extra request is needed.
// article_data_fields arrives normalised by DYAPI as object | null | '' — collapse all three.
// Being a computed, it also re-derives when the user switches category, without touching form.data.
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

const statusCls = computed(() => ({
    hidden: 'bg-canvas text-label-2',
    scheduled: 'bg-warn-fill text-warn',
    visible: 'bg-info-fill text-link'
}[status.value] || 'bg-canvas'));

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
        // `data` comes back as object | null | '' (DYAPI JSON.parse with a swallowed error) — normalise.
        data: (item.data && typeof item.data === 'object') ? item.data : {}
    };
    status.value = item.status || 'hidden';
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
        toast.add({ severity: 'warn', summary: 'Warning', detail: '请选择一个分类', life: 3000 });
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
    if (id) { toast.add({ severity: 'success', summary: 'Success', detail: '已保存', life: 2500 }); await loadRevisions(); }
};

const publish = async () => {
    const id = await persist();
    if (!id) return;
    await lifecycleAPI.transition('articles', id, { to: 'visible' });
    status.value = 'visible';
    toast.add({ severity: 'success', summary: 'Success', detail: '已发布', life: 2500 });
    await refresh();
};

const unpublish = async () => {
    if (!articleId.value) return;
    await lifecycleAPI.transition('articles', articleId.value, { to: 'hidden' });
    status.value = 'hidden';
    toast.add({ severity: 'info', summary: 'Info', detail: '已隐藏', life: 2500 });
    await refresh();
};

const schedule = async () => {
    if (!publishAt.value) { toast.add({ severity: 'warn', summary: 'Warning', detail: '请选择发布时间', life: 3000 }); return; }
    const id = await persist();
    if (!id) return;
    await lifecycleAPI.transition('articles', id, { to: 'scheduled', publish_at: publishAt.value.toISOString() });
    status.value = 'scheduled';
    toast.add({ severity: 'success', summary: 'Success', detail: '已设为定时发布', life: 2500 });
    await refresh();
};

const doPreview = async () => {
    const id = await persist();
    if (!id) return;
    try {
        const res = await contentAPI.previewToken(id);
        const token = res.data?.token;
        if (token) window.open(`/preview?id=${id}&pt=${encodeURIComponent(token)}`, '_blank');
    } catch (e) { console.error(e); }
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
            toast.add({ severity: 'success', summary: 'Success', detail: `已回滚到 v${versionNo}`, life: 2500 });
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
                <Button unstyled @click="router.push('/admin/articles')" class="w-10 h-10 rounded-full bg-[rgba(210,210,215,0.64)] flex items-center justify-center text-label-3 hover:bg-white hover:border-2 hover:border-accent hover:text-label transition-all cursor-pointer">
                    <LucideChevronLeft :size="20" />
                </Button>
                <div>
                    <h1 class="text-[28px] font-semibold leading-[1.14] tracking-[0.196px]">{{ isEdit ? $t('action.edit') : $t('action.new') }}</h1>
                </div>
            </div>

            <div class="flex gap-2 items-center">
                <span :class="statusCls" class="px-2.5 h-9 inline-flex items-center rounded-lg text-small font-medium uppercase tracking-wider">{{ $t('contentStatus.' + status) }}</span>
                <Button unstyled @click="doPreview" :disabled="loading" :class="BTN.secondary">
                    <LucideEye :size="16" /> {{ $t('action.preview') }}
                </Button>
                <Button unstyled @click="saveDraft" :disabled="loading" :class="BTN.secondary">
                    <LucideSave :size="16" /> {{ $t('action.save') }}
                </Button>
                <Button v-if="status === 'visible'" unstyled @click="unpublish" :disabled="loading" :class="BTN.danger">
                    <LucideEyeOff :size="16" /> {{ $t('action.unpublish') }}
                </Button>
                <Button v-else unstyled @click="publish" :disabled="loading" :class="BTN.primary">
                    <LucideCheck :size="16" /> {{ $t('action.publish') }}
                </Button>
            </div>
        </div>

        <div class="flex-1 flex gap-6 pb-6 h-[calc(100vh-140px)]">
            <div class="flex-1 flex flex-col bg-white rounded-card shadow-card overflow-hidden border border-separator-weak">
                <div class="px-6 py-4 border-b border-separator-weak flex flex-col gap-2">
                    <InputText unstyled v-model="form.title" @blur="autoSlug" :placeholder="$t('form.title')" class="w-full text-title-page font-semibold outline-none placeholder:opacity-30" />
                </div>
                <div class="flex-1 overflow-hidden" style="--md-bk-color: transparent;">
                    <MdEditor v-model="form.content" @onUploadImg="onUploadImg" :language="$i18n.locale === 'zh' ? 'zh-CN' : 'en-US'" class="h-full border-none!" previewTheme="github" />
                </div>
            </div>

            <div class="w-[320px] shrink-0 bg-white rounded-card shadow-card overflow-y-auto p-6 hidden lg:block border border-separator-weak">
                <h3 class="text-title-section font-medium tracking-[0.231px] mb-6">{{ $t('article.properties') }}</h3>

                <EditorPanel :form="form" :category-options="categoryOptions" :article-data-fields="articleDataFields" />

                <div class="mt-4">
                    <label class="text-body font-medium text-label mb-2 flex items-center gap-1"><LucideClock :size="14" /> {{ $t('article.schedule') }}</label>
                    <div class="flex gap-2">
                        <DatePicker v-model="publishAt" showTime hourFormat="24" dateFormat="yy-mm-dd" unstyled :pt="DATEPICKER_PT" class="flex-1" />
                        <Button unstyled @click="schedule" :disabled="loading" :class="BTN.secondary">{{ $t('action.schedule') }}</Button>
                    </div>
                </div>

                <div v-if="isEdit && revisions.length" class="mt-6 pt-4 border-t border-separator-weak">
                    <label class="text-body font-medium text-label mb-3 flex items-center gap-1"><LucideRotateCcw :size="14" /> {{ $t('article.history') }}</label>
                    <ul class="flex flex-col gap-2 max-h-[220px] overflow-y-auto">
                        <li v-for="rev in revisions" :key="rev.version_no" class="flex items-center justify-between text-small bg-surface rounded-control px-3 py-2">
                            <div class="min-w-0">
                                <div class="font-medium text-label">v{{ rev.version_no }} · {{ rev.note }}</div>
                                <div class="text-label-3 truncate">{{ rev.created_at ? new Date(rev.created_at).toLocaleString() : '' }}</div>
                            </div>
                            <button @click="rollback(rev.version_no)" class="text-link hover:underline shrink-0 ml-2 cursor-pointer">{{ $t('action.rollback') }}</button>
                        </li>
                    </ul>
                </div>

                <div v-if="isEdit" class="mt-6 pt-4 border-t border-separator-weak">
                    <AclEditor model="articles" :resource-id="articleId" :actions="['R', 'U', 'D', 'publish']" :title="$t('article.sharing')" />
                </div>
            </div>
        </div>

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
                        <button @click="showMobilePanel = false" class="w-8 h-8 rounded-full bg-canvas flex items-center justify-center text-label-2 hover:bg-surface-hover transition-colors cursor-pointer">
                            <LucideX :size="16" />
                        </button>
                    </div>
                    <EditorPanel :form="form" :category-options="categoryOptions" :article-data-fields="articleDataFields" />
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
</style>
