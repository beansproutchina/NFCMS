<script setup lang="ts">
import { useRouter } from 'vue-router';

const props = defineProps<{
    config: any;
    categories: any[];
    articles: any[];
    api: any;
    user?: any;
}>();

const router = useRouter();

const getCategorySlug = (categoryId: number) => {
    const cat = props.categories.find(c => c.id === categoryId);
    return cat ? cat.slug : 'default';
};

const openArticle = (article: any) => {
    const catSlug = getCategorySlug(article.category_id);
    router.push(`/a/${catSlug}/${article.slug}`);
};
</script>

<template>
  <div class="min-h-screen bg-[#f5f5f7] flex flex-col font-text text-apple-text-dark">
    <!-- Navbar -->
    <nav class="sticky top-0 z-50 w-full h-[48px] bg-[rgba(0,0,0,0.8)] backdrop-blur-[20px] backdrop-saturate-[180%] flex items-center px-4 md:px-12 justify-between text-white transition-all">
        <div class="cursor-pointer font-semibold text-[16px] tracking-wide" @click="router.push('/')">
           {{ config.site_name || 'NFCMS' }}
        </div>
        <div class="flex items-center gap-6 text-[12px] opacity-80">
            <button @click="router.push('/')" class="hover:opacity-100 hover:underline">{{ $t('front.home') }}</button>
            <button @click="router.push('/admin')" class="hover:opacity-100 hover:underline">Admin</button>
        </div>
    </nav>

    <!-- Hero Area -->
    <header class="w-full bg-[#000000] text-white py-32 flex justify-center text-center px-6">
        <div class="max-w-2xl">
            <h1 class="text-[56px] font-display font-semibold leading-[1.07] tracking-[-0.28px] mb-4">{{ config.site_name || 'NFCMS' }}</h1>
            <p class="text-[21px] font-display font-normal leading-[1.19] tracking-[0.231px] opacity-80">{{ config.subtitle || 'Welcome to our site!' }}</p>
        </div>
    </header>

    <!-- Content Area -->
    <main class="flex-1 w-full max-w-[980px] mx-auto py-20 px-6 min-h-[400px]">
        <div>
            <div v-if="!articles.length" class="text-center opacity-50 py-10">No articles published yet.</div>

            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div v-for="item in articles" :key="item.id" 
                     class="bg-white rounded-[12px] shadow-[rgba(0,0,0,0.22)_3px_5px_30px_0px] p-8 flex flex-col gap-4 cursor-pointer hover:scale-[1.01] transition-transform duration-300"
                     @click="openArticle(item)">
                    <h2 class="text-[28px] font-display font-normal leading-[1.14] tracking-[0.196px]">{{ item.title }}</h2>
                    <div class="flex items-center gap-2 mb-2"><span v-if="item.is_top" class="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{{ $t('form.is_top') || 'TOP' }}</span><span v-if="item.category_id" class="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{{ getCategorySlug(item.category_id) }}</span></div>
         <p class="text-[17px] font-text font-normal leading-[1.47] opacity-80 line-clamp-3 flex-1 mb-4">{{ item.description || 'No description provided...' }}</p>
                    <div class="flex justify-between items-end mt-auto">
                        <span class="text-[12px] opacity-50">{{ item.published_at ? new Date(item.published_at).toLocaleDateString() : '-' }}</span>
                        <button class="bg-transparent border border-[#0066cc] text-[#0066cc] rounded-full px-4 py-1 text-[14px] hover:underline" @click.stop="openArticle(item)">
                            {{ $t('front.readMore') }} &gt;
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </main>
  </div>
</template>
