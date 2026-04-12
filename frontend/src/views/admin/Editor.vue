<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import axios from 'axios';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import { LucideChevronLeft, LucideSave, LucideCheck } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const isEdit = !!route.params.id;
const articleId = route.params.id;

const form = ref({
    title: '',
    slug: '',
    excerpt: '',
    status: 'draft',
    content: ''
});

const loading = ref(false);

onMounted(async () => {
    if (isEdit) {
        try {
            const res = await axios.get(`/api/articles/${articleId}`);
            if (res.data.data) {
                const data = Array.isArray(res.data.data) ? res.data.data[0] : res.data.data;
                form.value = {
                    title: data.title || '',
                    slug: data.slug || '',
                    excerpt: data.excerpt || '',
                    status: data.status || 'draft',
                    content: data.content || ''
                };
            }
        } catch (e) {
            console.error(e);
        }
    }
});

const save = async (status: string) => {
    form.value.status = status;
    loading.value = true;
    try {
        const payload = {
            ...form.value,
            published_at: status === 'published' ? new Date().toISOString() : null
        };
        
        if (isEdit) {
            await axios.put(`/api/articles?id=${articleId}`, payload);
        } else {
            await axios.post('/api/articles', payload);
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
}
</script>

<template>
    <div class="h-full flex flex-col pt-6 pb-0 px-6 max-w-screen-2xl mx-auto">
        <div class="flex justify-between items-center mb-6">
            <div class="flex items-center gap-4">
                <button @click="router.push('/admin/articles')" class="w-10 h-10 rounded-full bg-[rgba(210,210,215,0.64)] flex items-center justify-center text-[rgba(0,0,0,0.48)] hover:bg-white hover:border-2 hover:border-apple-blue hover:text-black transition-all cursor-pointer">
                    <LucideChevronLeft :size="20" />
                </button>
                <div>
                    <h1 class="text-[28px] font-display font-semibold leading-[1.14] tracking-[0.196px]">{{ isEdit ? $t('action.edit') : $t('action.new') }}</h1>
                </div>
            </div>

            <div class="flex gap-3">
                <Button unstyled @click="save('draft')" :disabled="loading" class="bg-[#fafafc] hover:bg-[#ededf2] text-[rgba(0,0,0,0.8)] border-[3px] border-[rgba(0,0,0,0.04)] px-4 py-2 rounded-[11px] font-text text-[14px] transition-colors flex items-center gap-2 cursor-pointer">
                    <LucideSave :size="16" /> {{ $t('action.saveDraft') }}
                </Button>
                <Button unstyled @click="save('published')" :disabled="loading" class="bg-apple-blue hover:bg-[#2997ff] text-white px-4 py-2 rounded-[8px] font-text text-[14px] transition-colors flex items-center gap-2 cursor-pointer border border-transparent">
                    <LucideCheck :size="16" /> {{ $t('action.publish') }}
                </Button>
            </div>
        </div>

        <div class="flex-1 flex gap-6 pb-6 h-[calc(100vh-140px)]">
            <div class="flex-1 flex flex-col bg-white rounded-[12px] shadow-[0px_5px_30px_rgba(0,0,0,0.06)] overflow-hidden border border-[rgba(0,0,0,0.05)]">
                <div class="px-6 py-4 border-b border-[rgba(0,0,0,0.05)] flex flex-col gap-2">
                    <input v-model="form.title" @blur="autoSlug" :placeholder="$t('form.title')" class="w-full text-[40px] font-display font-semibold outline-none placeholder:opacity-30" />
                </div>
                <div class="flex-1 overflow-hidden" style="--md-bk-color: transparent;">
                    <MdEditor v-model="form.content" :language="$i18n.locale === 'zh' ? 'zh-CN' : 'en-US'" class="h-full !border-none" previewTheme="github" />
                </div>
            </div>

            <div class="w-[320px] bg-white rounded-[12px] shadow-[0px_5px_30px_rgba(0,0,0,0.06)] overflow-y-auto p-6 hidden lg:block border border-[rgba(0,0,0,0.05)]">
                <h3 class="text-[21px] font-display font-medium tracking-[0.231px] mb-6">{{ $t('system.settings') }}</h3>
                
                <div class="flex flex-col gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">{{ $t('form.urlSlug') }}</label>
                        <InputText v-model="form.slug" placeholder="my-awesome-post" class="w-full bg-[#fafafc] border-[3px] border-[rgba(0,0,0,0.04)] py-2 px-3 rounded-[11px] text-[14px] focus:outline-none focus:border-apple-blue transition-colors" />
                    </div>
                    
                    <div class="flex flex-col gap-2">
                        <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">{{ $t('form.excerpt') }}</label>
                        <textarea v-model="form.excerpt" rows="4" placeholder="..." class="w-full bg-[#fafafc] border-[3px] border-[rgba(0,0,0,0.04)] py-2 px-3 rounded-[11px] text-[14px] focus:outline-none focus:border-apple-blue transition-colors resize-none"></textarea>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
