<script setup lang="ts">

import { ref, onMounted, computed } from 'vue';
import Textarea from 'primevue/textarea';
import { useRoute, useRouter } from 'vue-router';
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import { crudAPI, lifecycleAPI, contentAPI, uploadAPI } from '../../api';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Button from 'primevue/button';
import { LucideChevronLeft, LucideSave, LucideCheck, LucideImage, LucideEyeOff, LucideClock, LucideRotateCcw } from 'lucide-vue-next';
import { useToast } from 'primevue/usetoast';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const isEdit = !!route.params.id;
const articleId = ref<string | number | null>(route.params.id ? (route.params.id as string) : null);

// Content fields only. status/publish_at are lifecycle-managed on the backend (not sent here).
const form = ref({
    category_id: '', content_template: "", is_top: 0,
    title: '', slug: '', description: '', thumbnail: '', content: ''
});
const status = ref<string>('hidden');       // hidden | scheduled | visible
const publishAt = ref<string>('');           // datetime-local for scheduling
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
        const res: any = await crudAPI.getList('categories');
        categories.value = res.data || res || [];
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
    if (isEdit) { await loadArticle(); await loadRevisions(); await loadGrants(); await loadGranteeSources(); }
});

const refresh = async () => { await loadArticle(); await loadRevisions(); await loadGrants(); };

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
    await lifecycleAPI.transition('articles', id, { to: 'scheduled', publish_at: new Date(publishAt.value).toISOString() });
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

const rollback = async (versionNo: number) => {
    if (!articleId.value) return;
    if (!confirm(`回滚到版本 v${versionNo}？当前内容会先存为一个新版本。`)) return;
    await lifecycleAPI.rollback('articles', articleId.value, versionNo);
    toast.add({ severity: 'success', summary: 'Success', detail: `已回滚到 v${versionNo}`, life: 2500 });
    await refresh();
};

// --- Sharing (resource ACL) ---
const grants = ref<any[]>([]);
const shareForm = ref({ grantee_type: 'user', grantee_id: '' as any, access: 'R' });
const usersList = ref<any[]>([]);
const rolesList = ref<any[]>([]);
const granteeOptions = computed(() =>
    shareForm.value.grantee_type === 'user'
        ? usersList.value.map((u: any) => ({ label: `${u.username} (#${u.id})`, value: u.id }))
        : rolesList.value.map((r: any) => ({ label: `${r.label || r.name} (#${r.id})`, value: r.id }))
);

const loadGranteeSources = async () => {
    try { const ur: any = await crudAPI.getList('users', { limit: 999 }); usersList.value = ur.data || []; } catch (e) { console.error(e); }
    try { const rr: any = await crudAPI.getList('roles', { limit: 999 }); rolesList.value = rr.data || []; } catch (e) { console.error(e); }
};

const loadGrants = async () => {
    if (!articleId.value) return;
    try {
        const res: any = await lifecycleAPI.grants('articles', articleId.value);
        grants.value = res.data || [];
    } catch (e) { console.error(e); }
};

const addShare = async () => {
    if (!articleId.value) { toast.add({ severity: 'warn', summary: 'Warning', detail: '请先保存文章', life: 2500 }); return; }
    if (!shareForm.value.grantee_id) { toast.add({ severity: 'warn', summary: 'Warning', detail: '请填写用户/角色 ID', life: 2500 }); return; }
    await lifecycleAPI.share('articles', articleId.value, {
        grantee_type: shareForm.value.grantee_type,
        grantee_id: Number(shareForm.value.grantee_id),
        access: shareForm.value.access
    });
    shareForm.value.grantee_id = '';
    toast.add({ severity: 'success', summary: 'Success', detail: '已共享', life: 2000 });
    await loadGrants();
};

const revokeShare = async (grantId: number) => {
    if (!articleId.value) return;
    await lifecycleAPI.revoke('articles', articleId.value, grantId);
    await loadGrants();
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

            <div class="flex gap-3 items-center">
                <span :class="statusCls" class="px-2.5 py-1 rounded-[6px] text-[12px] font-medium uppercase tracking-wider">{{ $t('contentStatus.' + status) }}</span>
                <Button unstyled @click="doPreview" :disabled="loading" class="bg-[#fafafc] hover:bg-[#ededf2] text-[rgba(0,0,0,0.8)] border border-[rgba(0,0,0,0.04)] px-4 py-2 rounded-[11px] font-text text-[14px] transition-colors flex items-center gap-2 cursor-pointer">
                    <LucideEye :size="16" /> {{ $t('action.preview') }}
                </Button>
                <Button unstyled @click="saveDraft" :disabled="loading" class="bg-[#fafafc] hover:bg-[#ededf2] text-[rgba(0,0,0,0.8)] border border-[rgba(0,0,0,0.04)] px-4 py-2 rounded-[11px] font-text text-[14px] transition-colors flex items-center gap-2 cursor-pointer">
                    <LucideSave :size="16" /> {{ $t('action.saveDraft') }}
                </Button>
                <Button v-if="status === 'visible'" unstyled @click="unpublish" :disabled="loading" class="bg-[#fafafc] hover:bg-[#ededf2] text-[#c2410c] border border-[rgba(0,0,0,0.04)] px-4 py-2 rounded-[11px] font-text text-[14px] transition-colors flex items-center gap-2 cursor-pointer">
                    <LucideEyeOff :size="16" /> {{ $t('action.unpublish') }}
                </Button>
                <Button v-else unstyled @click="publish" :disabled="loading" class="bg-apple-blue hover:bg-[#0077ED] text-white flex items-center justify-center gap-2 px-4 py-2 rounded-[8px] text-[15px] font-medium transition-colors border border-transparent focus:outline-none cursor-pointer">
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
                    <Select v-model.number="form.category_id" :options="categoryOptions" optionLabel="label" optionValue="value" unstyled :pt="{ root: 'h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] text-[14px] cursor-pointer flex items-center justify-between w-full relative focus:ring-1 focus:ring-apple-blue focus:outline-none', label: 'truncate', dropdown: 'w-4 h-4 opacity-50 absolute right-2 top-1/2 -translate-y-1/2', overlay: 'bg-white border border-[rgba(0,0,0,0.15)] rounded-[8px] shadow-lg mt-1 py-1 z-[9999]', option: ({ context }: any) => ({ class: ['px-3 py-2 text-[14px] cursor-pointer hover:bg-gray-100', context.selected ? 'bg-apple-blue text-white hover:bg-apple-blue' : 'text-gray-800'] }) }"/>
                </div>
                
                <div class="mt-4">
                    <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-2">{{ $t('form.content_template') || 'Local Template' }}</label>
                    <InputText unstyled v-model="form.content_template" placeholder="e.g. DefaultArticle" class="w-full h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue transition-shadow" />
                </div>

                <div class="mt-4">
                    <label class="text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-2 flex items-center gap-1"><LucideClock :size="14" /> {{ $t('article.schedule') }}</label>
                    <div class="flex gap-2">
                        <input v-model="publishAt" type="datetime-local" class="flex-1 h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] text-[13px] focus:outline-none focus:border-apple-blue" />
                        <Button unstyled @click="schedule" :disabled="loading" class="bg-[#fafafc] hover:bg-[#ededf2] text-[rgba(0,0,0,0.8)] border border-[rgba(0,0,0,0.1)] px-3 rounded-[8px] text-[13px] cursor-pointer">{{ $t('action.schedule') }}</Button>
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
                    <label class="text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-3 block">{{ $t('article.sharing') }}</label>
                    <ul v-if="grants.length" class="flex flex-col gap-2 mb-3">
                        <li v-for="g in grants" :key="g.id" class="flex items-center justify-between text-[12px] bg-[#f9f9fb] rounded-[8px] px-3 py-2">
                            <span class="text-[rgba(0,0,0,0.8)]">{{ g.grantee_type === 'user' ? $t('roles.targetUser') : $t('roles.targetRole') }} #{{ g.grantee_id }} · <span class="font-medium">{{ g.access }}</span></span>
                            <button @click="revokeShare(g.id)" class="text-red-500 hover:underline shrink-0 ml-2 cursor-pointer">{{ $t('action.revoke') }}</button>
                        </li>
                    </ul>
                    <div class="flex flex-col gap-2">
                        <div class="flex gap-2">
                            <select v-model="shareForm.grantee_type" @change="shareForm.grantee_id = ''" class="h-9 px-2 border border-[rgba(0,0,0,0.15)] rounded-[8px] text-[13px] bg-white cursor-pointer">
                                <option value="user">{{ $t('roles.targetUser') }}</option>
                                <option value="role">{{ $t('roles.targetRole') }}</option>
                            </select>
                            <select v-model="shareForm.grantee_id" class="flex-1 w-0 h-9 px-2 border border-[rgba(0,0,0,0.15)] rounded-[8px] text-[13px] bg-white cursor-pointer">
                                <option value="" disabled>{{ shareForm.grantee_type === 'user' ? $t('roles.pickUser') : $t('roles.pickRole') }}</option>
                                <option v-for="o in granteeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
                            </select>
                        </div>
                        <div class="flex gap-2">
                            <select v-model="shareForm.access" class="h-9 px-2 border border-[rgba(0,0,0,0.15)] rounded-[8px] text-[13px] bg-white cursor-pointer">
                                <option value="R">{{ $t('roles.readOnly') }}</option>
                                <option value="R,U">{{ $t('roles.readWrite') }}</option>
                                <option value="R,U,D">{{ $t('roles.readWriteDelete') }}</option>
                            </select>
                            <Button unstyled @click="addShare" class="flex-1 bg-apple-blue hover:bg-[#0077ED] text-white flex items-center justify-center gap-1 h-9 rounded-[8px] text-[13px] font-medium cursor-pointer">{{ $t('action.share') }}</Button>
                        </div>
                    </div>
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
