<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { MdPreview } from 'md-editor-v3';
import 'md-editor-v3/lib/preview.css';

const route = useRoute();
const router = useRouter();
const article = ref<any>(null);
const loading = ref(true);
const siteName = ref('NFCMS');
const slug = ref(route.params.slug as string);

onMounted(async () => {
    try {
        const configRes = await axios.get('/api/systemconfig?filter={"key":"site_name"}');
        if (configRes.data?.data?.length) {
            siteName.value = configRes.data.data[0].value;
        }
        
        const res = await axios.get(`/api/articles?filter={"slug":"${slug.value}"}`);
        if(res.data.data && res.data.data.length > 0) {
            article.value = res.data.data[0];
        } else {
            router.push('/');
        }
    } catch(e) {
        console.error(e);
        router.push('/');
    } finally {
        loading.value = false;
    }
});
</script>

<template>
  <div class="min-h-screen bg-[#ffffff] flex flex-col font-text text-apple-text-dark">
    <!-- Navbar -->
    <nav class="sticky top-0 z-50 w-full h-[48px] bg-[rgba(0,0,0,0.8)] backdrop-blur-[20px] backdrop-saturate-[180%] flex items-center px-4 md:px-12 justify-between text-white transition-all">
        <div class="cursor-pointer font-semibold text-[16px] tracking-wide" @click="router.push('/')">
           {{ siteName }}
        </div>
        <div class="flex items-center gap-6 text-[12px] opacity-80">
            <button @click="router.push('/')" class="hover:opacity-100 hover:underline">{{ $t('front.home') }}</button>
            <button @click="router.push('/admin')" class="hover:opacity-100 hover:underline">Admin</button>
        </div>
    </nav>

    <!-- Main Content Reader -->
    <main v-if="loading" class="flex-1 w-full max-w-[980px] mx-auto py-32 px-6 flex justify-center items-center opacity-50">Loading...</main>
    <main v-else-if="article" class="flex-1 w-full bg-white">
        <div class="w-full bg-[#f5f5f7] flex justify-center items-center py-20 px-6 border-b border-[rgba(0,0,0,0.05)]">
            <div class="max-w-[740px] w-full mt-10">
                <button @click="router.push('/')" class="text-[#0066cc] text-[14px] hover:underline mb-12 flex items-center gap-2">
                    &lt; {{ $t('front.back') }}
                </button>
                <h1 class="text-[56px] font-display font-semibold leading-[1.07] tracking-[-0.28px] mb-6 text-black">{{ article.title }}</h1>
                <div class="flex items-center gap-4 text-[14px] opacity-60 font-medium tracking-wide border-t border-[rgba(0,0,0,0.1)] pt-6">
                    <span>{{ $t('front.publishedOn') }} {{ article.published_at ? new Date(article.published_at).toLocaleDateString() : 'N/A' }}</span>
                </div>
            </div>
        </div>

        <!-- Render Markdown Content Context -->
        <div class="w-full max-w-[740px] mx-auto py-20 px-6">
            <MdPreview :editorId="'preview-only'" :modelValue="article.content" previewTheme="github" class="!bg-transparent text-[17px] leading-[1.47] tracking-[-0.374px]" />
        </div>
    </main>
  </div>
</template>
