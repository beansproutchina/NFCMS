<script setup lang="ts">

import { ref, onMounted, computed, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import { crudAPI, uploadAPI } from '../../api';
import { useAuthStore } from '../../stores/auth';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import { LucideChevronLeft, LucideSave, LucideCheck, LucideSettings } from 'lucide-vue-next';
import { useToast } from 'primevue/usetoast';
import EditorPanel from './EditorPanel.vue';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const isEdit = !!route.params.id;
const articleId = route.params.id;

const form = ref<any>({
    category_id: '',
    content_template: "",
    is_top: 0,
    visible: 1,
    title: '',
    slug: '',
    description: '',
    thumbnail: '',
    content: '',
    data: {} as Record<string, any>
});

const loading = ref(false);
const categories = ref<any[]>([]);
const categoryOptions = computed(() => { const opts = [{ label: '-', value: 0 }]; categories.value.forEach(c => opts.push({ label: c.name, value: c.id })); return opts; });

// Get the article_data_fields definition for the currently selected category
const currentCategory = computed(() => {
    const cid = form.value.category_id;
    if (!cid) return null;
    return categories.value.find(c => c.id === cid) || null;
});

const articleDataFields = computed<{ key: string; title: string; type: string }[]>(() => {
    const cat = currentCategory.value;
    if (!cat || !cat.article_data_fields) return [];
    const src = typeof cat.article_data_fields === 'string'
        ? (() => { try { return JSON.parse(cat.article_data_fields); } catch { return {}; } })()
        : cat.article_data_fields;
    if (!src || typeof src !== 'object') return [];
    return Object.entries(src).map(([key, def]: [string, any]) => ({
        key,
        title: def.title || key,
        type: def.type || 'text'
    }));
});

onMounted(async () => {
    try {
        const res: any = await crudAPI.getList('categories');
        categories.value = res.data || res || [];
    } catch (e) { console.error('Failed to load categories', e); }
});

onMounted(async () => {
    if (isEdit) {
        try {
            const res: any = await crudAPI.getList(`articles/${articleId}`);
            const dataObj = res.data || res;
            if (dataObj) {
                const item = Array.isArray(dataObj) ? dataObj[0] : dataObj;
                form.value = {
                    title: item.title || '',
                    slug: item.slug || '',
                    description: item.description || '',
                    thumbnail: item.thumbnail || '',
                    visible: typeof item.visible === 'number' ? item.visible : 0,
                    content: item.content || '',
                    category_id: item.category_id || '',
                    content_template: item.content_template || '',
                    is_top: item.is_top || 0,
                    data: item.data && typeof item.data === 'object'
                        ? (typeof item.data === 'string' ? JSON.parse(item.data) : item.data)
                        : {}
                };
            }
        } catch (e) {
            console.error(e);
        }
    }
});

// Attachment upload helper for dynamic fields
const uploadAttachment = async (fieldKey: string, event: Event) => {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    const file = target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    try {
        const res: any = await uploadAPI.upload(formData);
        if (res?.data?.length > 0) {
            form.value.data[fieldKey] = res.data[0].url;
            toast.add({ severity: 'success', summary: 'Success', detail: '上传成功', life: 3000 });
        }
    } finally {
        target.value = '';
    }
};

const save = async (visibleAction: string) => {
    form.value.visible = visibleAction === "published" ? 1 : 0;
    loading.value = true;
    if (Number(form.value.category_id) === 0) {
        toast.add({ severity: 'warn', summary: 'Warning', detail: '请选择一个分类', life: 3000 });
        loading.value = false;
        return;
    }
    try {
        const payload = {
            ...form.value,
            author_id: authStore.user?.id,
            published_at: visibleAction === 'published' ? new Date().toISOString() : null
        };

        if (isEdit) {
            await crudAPI.update('articles', articleId as string, payload);
            toast.add({ severity: 'success', summary: 'Success', detail: '文章更新成功', life: 3000 });
        } else {
            await crudAPI.create('articles', payload);
            toast.add({ severity: 'success', summary: 'Success', detail: '文章创建成功', life: 3000 });
        }
        router.push('/admin/articles');
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

const autoSlug = () => {
    if (!form.value.slug && form.value.title) {
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

// Mobile panel toggle
const showMobilePanel = ref(false);
const toggleMobilePanel = () => { showMobilePanel.value = !showMobilePanel.value; };
const closeMobilePanel = () => { showMobilePanel.value = false; };
const isMobile = ref(false);
const checkMobile = () => { isMobile.value = window.innerWidth < 1024; };
onMounted(() => { checkMobile(); window.addEventListener('resize', checkMobile); });
onBeforeUnmount(() => { window.removeEventListener('resize', checkMobile); });
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
    <div class="h-full flex flex-col pt-6 pb-0 px-4 sm:px-6 max-w-screen-2xl mx-auto">
        <div class="flex justify-between items-center mb-4 sm:mb-6">
            <div class="flex items-center gap-3 sm:gap-4">
                <Button unstyled @click="router.push('/admin/articles')"
                    class="w-10 h-10 rounded-full bg-[rgba(210,210,215,0.64)] flex items-center justify-center text-[rgba(0,0,0,0.48)] hover:bg-white hover:border-2 hover:border-apple-blue hover:text-black transition-all cursor-pointer">
                    <LucideChevronLeft :size="20" />
                </Button>
                <div>
                    <h1 class="text-[22px] sm:text-[28px] font-display font-semibold leading-[1.14] tracking-[0.196px]">{{ isEdit ?
                        $t('action.edit') : $t('action.new') }}</h1>
                </div>
            </div>

            <div class="flex gap-2 sm:gap-3">
                <Button unstyled @click="save('draft')" :disabled="loading"
                    class="bg-[#fafafc] hover:bg-[#ededf2] text-[rgba(0,0,0,0.8)] border border-[rgba(0,0,0,0.04)] px-3 sm:px-4 py-2 rounded-[11px] font-text text-[13px] sm:text-[14px] transition-colors flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                    <LucideSave :size="16" /> <span class="hidden sm:inline">{{ $t('action.saveDraft') }}</span>
                </Button>
                <Button unstyled @click="save('published')" :disabled="loading"
                    class="bg-apple-blue hover:bg-[#0077ED] text-white flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-[8px] text-[14px] sm:text-[15px] font-medium transition-colors border border-transparent focus:outline-none cursor-pointer">
                    <LucideCheck :size="16" /> <span class="hidden sm:inline">{{ $t('action.publish') }}</span>
                </Button>
            </div>
        </div>

        <div class="flex-1 flex gap-4 sm:gap-6 pb-4 sm:pb-6 h-[calc(100vh-120px)] sm:h-[calc(100vh-140px)]">
            <!-- Editor area -->
            <div
                class="flex-1 flex flex-col bg-white rounded-[12px] shadow-[0px_5px_30px_rgba(0,0,0,0.06)] overflow-hidden border border-[rgba(0,0,0,0.05)] min-w-0">
                <div class="px-4 sm:px-6 py-3 sm:py-4 border-b border-[rgba(0,0,0,0.05)] flex flex-col gap-2">
                    <InputText unstyled v-model="form.title" @blur="autoSlug" :placeholder="$t('form.title')"
                        class="w-full text-[28px] sm:text-[40px] font-display font-semibold outline-none placeholder:opacity-30" />
                </div>
                <div class="flex-1 overflow-hidden" style="--md-bk-color: transparent;">
                    <MdEditor v-model="form.content" @onUploadImg="onUploadImg"
                        :language="$i18n.locale === 'zh' ? 'zh-CN' : 'en-US'" class="h-full !border-none"
                        previewTheme="github" />
                </div>
            </div>

            <!-- Desktop side panel (lg+) -->
            <div
                class="w-[320px] shrink-0 bg-white rounded-[12px] shadow-[0px_5px_30px_rgba(0,0,0,0.06)] overflow-y-auto p-6 hidden lg:block border border-[rgba(0,0,0,0.05)]">
                <h3 class="text-[21px] font-display font-medium tracking-[0.231px] mb-6">{{ $t('article.properties') }}
                </h3>
                <EditorPanel :form="form" :category-options="categoryOptions"
                    :article-data-fields="articleDataFields" :thumbnail-input="thumbnailInput"
                    @upload-thumbnail="onThumbnailSelected" @upload-attachment="uploadAttachment" />
            </div>
        </div>

        <!-- Mobile FAB button to open panel -->
        <button v-if="isMobile" @click="toggleMobilePanel"
            class="fixed right-4 bottom-6 z-40 w-14 h-14 rounded-full bg-apple-blue text-white shadow-lg flex items-center justify-center hover:bg-[#0077ED] transition-colors">
            <LucideSettings :size="22" />
        </button>

        <!-- Mobile drawer overlay -->
        <Teleport to="body">
            <Transition name="fade">
                <div v-if="showMobilePanel && isMobile" class="fixed inset-0 z-50 bg-black/40" @click="closeMobilePanel"></div>
            </Transition>
            <Transition name="slide">
                <div v-if="showMobilePanel && isMobile"
                    class="fixed right-0 top-0 bottom-0 z-50 w-[85vw] max-w-[380px] bg-white shadow-2xl overflow-y-auto p-6"
                    @click.stop>
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-[21px] font-display font-medium tracking-[0.231px]">{{ $t('article.properties') }}</h3>
                        <button @click="closeMobilePanel" class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                            ✕
                        </button>
                    </div>
                    <EditorPanel :form="form" :category-options="categoryOptions"
                        :article-data-fields="articleDataFields" :thumbnail-input="thumbnailInput"
                        @upload-thumbnail="onThumbnailSelected" @upload-attachment="uploadAttachment" />
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
    transition: transform 0.25s ease;
}
.slide-enter-from,
.slide-leave-to {
    transform: translateX(100%);
}
</style>
