<script setup lang="ts">

import { ref, onMounted, computed } from 'vue';
import Textarea from 'primevue/textarea';
import { useRoute, useRouter } from 'vue-router';
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import { crudAPI, lifecycleAPI, contentAPI, uploadAPI } from '../../api';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import DatePicker from 'primevue/datepicker';
import Button from 'primevue/button';
import { LucideChevronLeft, LucideEye, LucideSave, LucideCheck, LucideImage, LucideEyeOff, LucideClock, LucideRotateCcw } from 'lucide-vue-next';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { useI18n } from 'vue-i18n';
import { SELECT_PT, DATEPICKER_PT, INPUT_CLASS, BTN } from '../../ui/presets';
import AclEditor from '../../components/AclEditor.vue';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();
const { t } = useI18n();

const isEdit = !!route.params.id;
const articleId = ref<string | number | null>(route.params.id ? (route.params.id as string) : null);

// Content fields only. status/publish_at are lifecycle-managed on the backend (not sent here).
const form = ref({
    category_id: '', content_template: "", is_top: 0,
    title: '', slug: '', description: '', thumbnail: '', content: ''
});
const status = ref<string>('hidden');       // hidden | scheduled | visible
const publishAt = ref<Date | null>(null);    // scheduled publish time
const revisions = ref<any[]>([]);

const loading = ref(false);
const categories = ref<any[]>([]);
const categoryOptions = computed(() => { const opts = [{ label: '-', value: 0 }]; categories.value.forEach(c => opts.push({ label: c.name, value: c.id })); return opts; });

const statusCls = computed(() => ({
    hidden: 'bg-[#f3f4f6] text-[rgba(0,0,0,0.6)]',
    scheduled: 'bg-[#fff7ed] text-[#c2410c]',
    visible: 'bg-[#e0f2fe] text-[#0066cc]'
}[status.value] || 'bg-gray-100'));

onMounted(async () => {
    try {
        // Only categories the user may create in (new) or manage (edit) — backend-filtered.
        const res: any = await lifecycleAPI.manageableCategories(isEdit ? undefined : 'C');
        categories.value = res.data?.categories || [];
    } catch(e) { console.error('Failed to load categories', e); }
});

const loadArticle = async () => {
    if (!articleId.value) return;
    const res: any = await crudAPI.getOne('articles', articleId.value);
    const item = res.data || res;
    if (!item) return;
    form.value = {
        title: item.title || '', slug: item.slug || '', description: item.description || '',
        thumbnail: item.thumbnail || '', content: item.content || '',
        category_id: item.category_id || '', content_template: item.content_template || '', is_top: item.is_top || 0
    };
    status.value = item.status || 'hidden';
};

const loadRevisions = async () => {
    if (!articleId.value) return;
    try {
        const res: any = await lifecycleAPI.revisions('articles', articleId.value);
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
            await crudAPI.update('articles', articleId.value, { ...form.value });
        } else {
            const res: any = await crudAPI.create('articles', { ...form.value }); // author_id set server-side
            articleId.value = res.id ?? res.data?.id ?? res.data ?? null;
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
        const res: any = await contentAPI.previewToken(id);
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

const onUploadImg = async (files: File[], callback: (urls: string[]) => void) => {
    const formData = new FormData();
    files.forEach((file) => {
        formData.append('file', file);
    });
    
    const res: any = await uploadAPI.upload(formData);
    
    if (res?.data) {
        callback(res.data.map((item: any) => item.url));
    }
};

const thumbnailInput = ref<HTMLInputElement | null>(null);
const onThumbnailSelected = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    const file = target.files[0];
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const res: any = await uploadAPI.upload(formData);
        
        if (res?.data?.length > 0) {
            form.value.thumbnail = res.data[0].url;
            toast.add({ severity: 'success', summary: 'Success', detail: '缩略图上传成功', life: 3000 });
        }
    } finally {
        if (thumbnailInput.value) {
            thumbnailInput.value.value = '';
        }
    }
};
</script>

<template>
    <div class="h-full flex flex-col pt-6 pb-0 px-6 max-w-screen-2xl mx-auto">
        <div class="flex justify-between items-center mb-6">
            <div class="flex items-center gap-4">
                <Button unstyled @click="router.push('/admin/articles')" class="w-10 h-10 rounded-full bg-[rgba(210,210,215,0.64)] flex items-center justify-center text-[rgba(0,0,0,0.48)] hover:bg-white hover:border-2 hover:border-apple-blue hover:text-black transition-all cursor-pointer">
                    <LucideChevronLeft :size="20" />
                </Button>
                <div>
                    <h1 class="text-[28px] font-display font-semibold leading-[1.14] tracking-[0.196px]">{{ isEdit ? $t('action.edit') : $t('action.new') }}</h1>
                </div>
            </div>

            <div class="flex gap-2 items-center">
                <span :class="statusCls" class="px-2.5 h-9 inline-flex items-center rounded-lg text-[12px] font-medium uppercase tracking-wider">{{ $t('contentStatus.' + status) }}</span>
                <Button unstyled @click="doPreview" :disabled="loading" :class="BTN.ghost">
                    <LucideEye :size="16" /> {{ $t('action.preview') }}
                </Button>
                <Button unstyled @click="saveDraft" :disabled="loading" :class="BTN.ghost">
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
            <div class="flex-1 flex flex-col bg-white rounded-[12px] shadow-[0px_5px_30px_rgba(0,0,0,0.06)] overflow-hidden border border-[rgba(0,0,0,0.05)]">
                <div class="px-6 py-4 border-b border-[rgba(0,0,0,0.05)] flex flex-col gap-2">
                    <InputText unstyled v-model="form.title" @blur="autoSlug" :placeholder="$t('form.title')" class="w-full text-[40px] font-display font-semibold outline-none placeholder:opacity-30" />
                </div>
                <div class="flex-1 overflow-hidden" style="--md-bk-color: transparent;">
                    <MdEditor v-model="form.content" @onUploadImg="onUploadImg" :language="$i18n.locale === 'zh' ? 'zh-CN' : 'en-US'" class="h-full !border-none" previewTheme="github" />
                </div>
            </div>

            <div class="w-[320px] bg-white rounded-[12px] shadow-[0px_5px_30px_rgba(0,0,0,0.06)] overflow-y-auto p-6 hidden lg:block border border-[rgba(0,0,0,0.05)]">
                <h3 class="text-[21px] font-display font-medium tracking-[0.231px] mb-6">{{ $t('article.properties') }}</h3>
                <div class="mt-4">
                    <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-2">{{ $t('form.category_id') || 'Category ID' }} <span class="text-red-500">*</span></label>
                    <Select v-model.number="form.category_id" :options="categoryOptions" optionLabel="label" optionValue="value" unstyled :pt="SELECT_PT" class="w-full" />
                </div>
                
                <div class="mt-4">
                    <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-2">{{ $t('form.content_template') || 'Local Template' }}</label>
                    <InputText unstyled v-model="form.content_template" placeholder="e.g. DefaultArticle" :class="INPUT_CLASS" />
                </div>

                <div class="mt-4">
                    <label class="text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-2 flex items-center gap-1"><LucideClock :size="14" /> {{ $t('article.schedule') }}</label>
                    <div class="flex gap-2">
                        <DatePicker v-model="publishAt" showTime hourFormat="24" dateFormat="yy-mm-dd" unstyled :pt="DATEPICKER_PT" class="flex-1" />
                        <Button unstyled @click="schedule" :disabled="loading" :class="BTN.ghost">{{ $t('action.schedule') }}</Button>
                    </div>
                </div>

                <div v-if="isEdit && revisions.length" class="mt-6 pt-4 border-t border-[rgba(0,0,0,0.06)]">
                    <label class="text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-3 flex items-center gap-1"><LucideRotateCcw :size="14" /> {{ $t('article.history') }}</label>
                    <ul class="flex flex-col gap-2 max-h-[220px] overflow-y-auto">
                        <li v-for="rev in revisions" :key="rev.version_no" class="flex items-center justify-between text-[12px] bg-[#f9f9fb] rounded-[8px] px-3 py-2">
                            <div class="min-w-0">
                                <div class="font-medium text-[rgba(0,0,0,0.8)]">v{{ rev.version_no }} · {{ rev.note }}</div>
                                <div class="text-[rgba(0,0,0,0.45)] truncate">{{ rev.created_at ? new Date(rev.created_at).toLocaleString() : '' }}</div>
                            </div>
                            <button @click="rollback(rev.version_no)" class="text-[#0066cc] hover:underline shrink-0 ml-2 cursor-pointer">{{ $t('action.rollback') }}</button>
                        </li>
                    </ul>
                </div>

                <div v-if="isEdit" class="mt-6 pt-4 border-t border-[rgba(0,0,0,0.06)]">
                    <AclEditor model="articles" :resource-id="articleId" :actions="['R', 'U', 'D', 'publish']" :title="$t('article.sharing')" />
                </div>

                <div class="mt-4 flex items-center justify-between">
                    <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)]">{{ $t('form.is_top') || 'Is Top' }}</label>
                    <input v-model="form.is_top" type="checkbox" :true-value="1" :false-value="0" class="h-5 w-5 rounded border-[rgba(0,0,0,0.15)]" />
                </div>

                <div class="mt-4 flex flex-col gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">{{ $t('form.thumbnail') || 'Thumbnail' }}</label>
                        <div 
                            class="relative w-full aspect-video border-2 border-dashed border-[rgba(0,0,0,0.15)] rounded-[12px] flex items-center justify-center overflow-hidden hover:border-apple-blue transition-colors cursor-pointer group" 
                            @click="thumbnailInput?.click()"
                        >
                            <input type="file" ref="thumbnailInput" class="hidden" accept="image/*" @change="onThumbnailSelected" />
                            <img v-if="form.thumbnail" :src="form.thumbnail" class="w-full h-full object-cover" />
                            <div v-else class="text-center text-[rgba(0,0,0,0.4)] group-hover:text-apple-blue transition-colors flex flex-col items-center">
                                <LucideImage :size="24" class="mb-2 opacity-50 group-hover:opacity-100" />
                                <span class="text-[13px] font-medium">{{ $t('action.upload') || 'Click to Upload' }}</span>
                            </div>
                        </div>
                        <div v-if="form.thumbnail" class="text-right">
                             <span @click.stop="form.thumbnail = ''" class="text-[12px] text-red-500 cursor-pointer hover:underline">{{ $t('action.remove') || 'Remove' }}</span>
                        </div>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">{{ $t('form.urlSlug') }}</label>
                        <InputText unstyled v-model="form.slug" placeholder="my-awesome-post" class="w-full h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue transition-shadow" />
                    </div>
                    
                    <div class="flex flex-col gap-2">
                        <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">{{ $t('form.description') || 'Description' }}</label>
                        <Textarea unstyled v-model="form.description" rows="4" placeholder="..." class="w-full border border-[rgba(0,0,0,0.04)] py-2 px-3 rounded-[11px] text-[14px] focus:outline-none focus:border-apple-blue transition-colors resize-none"></Textarea>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
