<script setup lang="ts">

import { ref, onMounted, computed } from 'vue';
import Textarea from 'primevue/textarea';
import { useRoute, useRouter } from 'vue-router';
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import { crudAPI } from '../../api';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Button from 'primevue/button';
import { LucideChevronLeft, LucideSave, LucideCheck, LucideImage } from 'lucide-vue-next';
import { useToast } from 'primevue/usetoast';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const isEdit = !!route.params.id;
const articleId = route.params.id;

const form = ref({ category_id: '', content_template: "", is_top: 0, visible: 1, 
    title: '',
    slug: '',
    description: '',
    thumbnail: '',
    // removed duplicate visible property
    content: ''
});

const loading = ref(false);
const categories = ref<any[]>([]);
const categoryOptions = computed(() => { const opts = [{ label: '-', value: 0 }]; categories.value.forEach(c => opts.push({ label: c.name, value: c.id })); return opts; });

onMounted(async () => {
    try {
        const res: any = await crudAPI.getList('categories');
        categories.value = res.data || res || [];
    } catch(e) { console.error('Failed to load categories', e); }
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
                    is_top: item.is_top || 0
                };
            }
        } catch (e) {
            console.error(e);
        }
    }
});

const save = async (visibleAction: string) => {
    form.value.visible = visibleAction === "published" ? 1 : 0;
    loading.value = true;
    if(Number(form.value.category_id) === 0){
        toast.add({ severity: 'warn', summary: 'Warning', detail: '请选择一个分类', life: 3000 });
        loading.value = false;
        return;
    }
    try {
        const payload = {
            ...form.value,
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
    if(!form.value.slug && form.value.title) {
        form.value.slug = form.value.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/(^-|-$)+/g, '');
    }
};

import { uploadAPI } from '../../api';
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

            <div class="flex gap-3">
                <Button unstyled @click="save('draft')" :disabled="loading" class="bg-[#fafafc] hover:bg-[#ededf2] text-[rgba(0,0,0,0.8)] border border-[rgba(0,0,0,0.04)] px-4 py-2 rounded-[11px] font-text text-[14px] transition-colors flex items-center gap-2 cursor-pointer">
                    <LucideSave :size="16" /> {{ $t('action.saveDraft') }}
                </Button>
                <Button unstyled @click="save('published')" :disabled="loading" class="bg-apple-blue hover:bg-[#0077ED] text-white flex items-center justify-center gap-2 px-4 py-2 rounded-[8px] text-[15px] font-medium transition-colors border border-transparent focus:outline-none cursor-pointer">
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

                <div class="mt-4 flex items-center justify-between">
                    <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)]">{{ $t('form.visible') || 'Visible' }}</label>
                    <input v-model="form.visible" type="checkbox" :true-value="1" :false-value="0" class="h-5 w-5 rounded border-[rgba(0,0,0,0.15)]" />
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
