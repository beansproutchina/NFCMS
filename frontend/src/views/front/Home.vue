<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const router = useRouter();
const articles = ref<any[]>([]);
const siteName = ref('NFCMS');
const loading = ref(true);

onMounted(async () => {
    try {
        const configRes = await axios.get('/api/systemconfig?filter={"key":"site_name"}');
        if (configRes.data?.data?.length) {
            siteName.value = configRes.data.data[0].value;
        }

        const res = await axios.get('/api/articles?filter={"status":"published"}');
        articles.value = res.data.data || [];
    } catch(e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
});

const openArticle = (slug: string) => {
    router.push(`/article/${slug}`);
};
</script>

<template>
  <div class="min-h-screen bg-[#f5f5f7] flex flex-col font-text text-apple-text-dark">
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

    <!-- Hero Area -->
    <header class="w-full bg-[#000000] text-white py-32 flex justify-center text-center px-6">
        <div class="max-w-2xl">
            <h1 class="text-[56px] font-display font-semibold leading-[1.07] tracking-[-0.28px] mb-4">{{ siteName }}</h1>
            <p class="text-[21px] font-display font-normal leading-[1.19] tracking-[0.231px] opacity-80">Minimalism as reverence for the object.</p>
        </div>
    </header>

    <!-- Content Area -->
    <main class="flex-1 w-full max-w-[980px] mx-auto py-20 px-6">
        <div v-if="loading" class="text-center opacity-50 py-10">Loading...</div>
        <div v-else-if="!articles.length" class="text-center opacity-50 py-10">No articles published yet.</div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div v-for="item in articles" :key="item.id" 
                 class="bg-white rounded-[12px] shadow-[rgba(0,0,0,0.22)_3px_5px_30px_0px] p-8 flex flex-col gap-4 cursor-pointer hover:scale-[1.01] transition-transform duration-300"
                 @click="openArticle(item.slug)">
                <h2 class="text-[28px] font-display font-normal leading-[1.14] tracking-[0.196px]">{{ item.title }}</h2>
                <p class="text-[17px] font-text font-normal leading-[1.47] opacity-80 line-clamp-3 flex-1 mb-4">{{ item.excerpt || 'No excerpt provided...' }}</p>
                <div class="flex justify-between items-end mt-auto">
                    <span class="text-[12px] opacity-50">{{ item.published_at ? new Date(item.published_at).toLocaleDateString() : '-' }}</span>
                    <button class="bg-transparent border border-[#0066cc] text-[#0066cc] rounded-full px-4 py-1 text-[14px] hover:underline" @click.stop="openArticle(item.slug)">
                        {{ $t('front.readMore') }} &gt;
                    </button>
                </div>
            </div>
        </div>
    </main>
  </div>
</template>
