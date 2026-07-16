<script setup lang="ts">
import { useRouter } from 'vue-router';

const props = defineProps<{ context: any }>();
const { config, articles, categories } = props.context || {};

const router = useRouter();

const getCategorySlug = (categoryId: number) => {
    const cat = categories?.find((c: any) => c.id === categoryId);
    return cat ? cat.slug : 'default';
};
const getCategoryName = (categoryId: number) => {
    const cat = categories?.find((c: any) => c.id === categoryId);
    return cat ? cat.name : 'default';
};
const openArticle = (article: any) => {
    const catSlug = getCategorySlug(article.category_id);
    router.push(`/a/${catSlug}/${article.slug}`);
};
</script>

<template>
    <!-- Hero Area (Apple Classic Black) -->
    <header class="w-full bg-[#000000] text-white py-32 flex justify-center text-center px-6">
        <div class="max-w-3xl">
            <h1
                class="text-[56px] font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display',sans-serif] font-semibold leading-[1.07] tracking-[-0.28px] mb-4">
                {{ config?.site_name || 'NFCMS Blog' }}
            </h1>
            <p
                class="text-[21px] font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display',sans-serif] font-normal leading-[1.19] tracking-[0.231px] text-[#86868b]">
                {{ config?.subtitle || '记录生活，分享知识' }}
            </p>
        </div>
    </header>

    <!-- Content Area -->
    <main class="flex-1 w-full max-w-[980px] mx-auto py-20 px-6 min-h-[400px]">
        <div v-if="!articles || !articles.length" class="text-center opacity-50 py-10 text-[17px]">
            暂无文章发布。
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div v-for="item in articles" :key="item.id"
                class="bg-white rounded-[12px] shadow-[rgba(0,0,0,0.22)_3px_5px_30px_0px] p-8 flex flex-col gap-4 cursor-pointer hover:scale-[1.01] transition-transform duration-300 group"
                @click="openArticle(item)">
                <div class="flex items-center gap-2 mb-2">
                    <span v-if="item.is_top"
                        class="text-[10px] bg-[#f5f5f7] text-[#1d1d1f] px-2 py-0.5 border border-[#d2d2d7] rounded-full font-semibold tracking-wide">置顶</span>
                    <span v-if="item.category_id"
                        class="text-[10px] bg-[#f5f5f7] text-[#1d1d1f] px-2 py-0.5 border border-[#d2d2d7] rounded-full tracking-wide">{{
                        getCategoryName(item.category_id) }}</span>
                </div>
                <h2
                    class="text-[28px] font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display',sans-serif] font-normal leading-[1.14] tracking-[0.196px] text-[#1d1d1f] group-hover:text-[#0071e3] transition-colors">
                    {{ item.title }}
                </h2>

                <p
                    class="text-[17px] font-normal leading-[1.47] tracking-[-0.374px] text-[rgba(0,0,0,0.8)] line-clamp-3 mb-4">
                    {{ item.description || '暂无描述...' }}
                </p>

                <div class="flex justify-between items-end mt-auto pt-4">
                    <span class="text-[12px] text-[rgba(0,0,0,0.48)] font-medium tracking-wide">
                        {{ item.published_at ? new Date(item.published_at).toLocaleDateString() : '-' }}
                    </span>
                    <button
                        class="bg-transparent text-apple-link rounded-[980px] border border-apple-link px-[15px] py-[8px] text-[14px] leading-[1.43] tracking-[-0.224px] cursor-pointer "
                        @click.stop="openArticle(item)">
                        {{ $t('front.readMore') }} &gt;
                    </button>
                </div>
            </div>
        </div>
    </main>
</template>
