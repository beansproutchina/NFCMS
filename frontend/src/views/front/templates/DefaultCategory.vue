<script setup lang="ts">
import { useRouter } from 'vue-router';
import AHeader from './components/AHeader.vue';
import AFooter from './components/AFooter.vue';
import { Button } from 'primevue';

const props = defineProps<{ context: any }>();
const { category, articles, breadcrumbs } = props.context || {};

const router = useRouter();



</script>

<template>
    <div
        class="min-h-screen bg-[#f5f5f7] flex flex-col font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text',sans-serif]">
        <a-header :context="context" />

        <!-- Main Content -->
        <main class="flex-1 w-full max-w-[980px] mx-auto py-12 px-6">
            <!-- Breadcrumbs -->
            <div class="flex gap-2 text-[14px] text-[rgba(0,0,0,0.48)] mb-8 tracking-[-0.224px]">
                <span class="hover:text-[#000000] cursor-pointer transition-colors" @click="router.push('/')">首页</span>
                <template v-for="(crumb, idx) in breadcrumbs" :key="crumb.id">
                    <span>&gt;</span>
                    <span class="cursor-pointer hover:text-[#000000] transition-colors"
                        :class="{ 'text-[#1d1d1f] font-medium': idx === breadcrumbs.length - 1 }"
                        @click="idx === breadcrumbs.length - 1 ? null : router.push(`/a/${crumb.slug}`)">
                        {{ crumb.name }}
                    </span>
                </template>
            </div>

            <!-- Category Hero -->
            <div class="mb-12 pb-6 border-b border-[#d2d2d7]">
                <h1
                    class="text-[56px] font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display',sans-serif] font-semibold text-[#1d1d1f] leading-[1.07] tracking-[-0.28px]">
                    {{ category?.name || '分类' }}
                </h1>
                <p v-if="category?.data?.description"
                    class="mt-4 text-[21px] text-[rgba(0,0,0,0.6)] font-normal leading-[1.19] tracking-[0.231px]">
                    {{ category.data.description }}
                </p>
            </div>

            <!-- Articles Grid -->
            <div v-if="!articles || !articles.length"
                class="text-center py-20 text-[17px] text-[rgba(0,0,0,0.48)] tracking-[-0.374px]">
                该分类下暂无文章。
            </div>

            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div v-for="item in articles" :key="item.id"
                    class="bg-white rounded-[12px] p-6 shadow-[rgba(0,0,0,0.12)_0px_8px_30px_0px] hover:shadow-[rgba(0,0,0,0.22)_0px_12px_40px_0px] transition-all duration-300 flex flex-col group cursor-pointer hover:scale-[1.01]"
                    @click="router.push(`/a/${category?.slug}/${item.slug}`)">
                <div class="flex items-center gap-2 mb-2">
                    <span v-if="item.is_top" class="text-[10px] bg-[#f5f5f7] text-[#1d1d1f] px-2 py-0.5 border border-[#d2d2d7] rounded-full font-semibold tracking-wide">置顶</span>
                    <span v-if="item.category_id" class="text-[10px] bg-[#f5f5f7] text-[#1d1d1f] px-2 py-0.5 border border-[#d2d2d7] rounded-full tracking-wide">{{ category?.name }}</span>
                </div>
                <h2 class="text-[28px] font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display',sans-serif] font-normal leading-[1.14] tracking-[0.196px] text-[#1d1d1f] group-hover:text-[#0071e3] transition-colors">
                    {{ item.title }}
                </h2>
                

                
                <p class="text-[17px] font-normal leading-[1.47] tracking-[-0.374px] text-[rgba(0,0,0,0.8)] line-clamp-3 mb-4">
                    {{ item.description || '暂无描述...' }}
                </p>
                
                <div class="flex justify-between items-end mt-auto pt-4">
                    <span class="text-[12px] text-[rgba(0,0,0,0.48)] font-medium tracking-wide">
                        {{ item.published_at ? new Date(item.published_at).toLocaleDateString() : '-' }}
                    </span>
                    <Button unstyled class="bg-transparent text-[#0066cc] rounded-[980px] border border-[#0066cc] px-[15px] py-[8px] text-[14px] leading-[1.43] tracking-[-0.224px] cursor-pointer">
                        {{$t('front.readMore') }} &gt;
                    </Button>
                </div>
                </div>
            </div>
        </main>

        <!-- Unified Footer -->
        <a-footer :context="context" />
    </div>
</template>
