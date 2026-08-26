<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { renderMarkdown } from '@/lib/prose';

const props = defineProps<{ context: any }>();
const { config, article, breadcrumbs } = props.context || {};

const router = useRouter();

const renderedContent = computed(() => {
    if (!article?.content) return '';
    return renderMarkdown(article.content);
});
</script>

<template>
    <!-- Main Content -->
    <main class="flex-1 w-full max-w-[980px] mx-auto py-12 px-6">
        <!-- Breadcrumbs -->
        <div class="flex flex-wrap gap-2 text-[14px] text-[rgba(0,0,0,0.48)] mb-12 tracking-[-0.224px]">
            <span class="hover:text-[#000000] cursor-pointer transition-colors" @click="router.push('/')">首页</span>
            <template v-for="crumb in breadcrumbs" :key="crumb.id">
                <span>&gt;</span>
                <span 
                    class="cursor-pointer hover:text-[#000000] transition-colors" 
                    @click="router.push(`/a/${crumb.slug}`)"
                >
                    {{ crumb.name }}
                </span>
            </template>
            <template v-if="article">
                <span>&gt;</span>
                <span class="text-[#1d1d1f] font-medium truncate max-w-[200px]">{{ article.title }}</span>
            </template>
        </div>

        <!-- Article Header -->
        <header class="mb-14 text-center max-w-[800px] mx-auto">
            <h1 class="text-[40px] md:text-[56px] font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display',sans-serif] font-semibold tracking-[-0.28px] leading-[1.07] text-[#1d1d1f] mb-6">
                {{ article?.title }}
            </h1>
            <div class="flex items-center justify-center gap-4 text-[17px] text-[rgba(0,0,0,0.48)] tracking-[-0.374px]">
                <span class="font-medium text-[rgba(0,0,0,0.8)]">
                    By {{ article?.author?.nickname || article?.author?.username || 'Author' }}
                </span>
                <span>|</span>
                <span>{{ article?.published_at ? new Date(article.published_at).toLocaleDateString() : '-' }}</span>
            </div>
        </header>

        <!-- Hero Image -->
        <div v-if="article?.thumbnail" class="mb-16 w-full max-w-[980px] mx-auto">
            <img :src="article.thumbnail" class="w-full h-auto object-cover rounded-[12px] shadow-[rgba(0,0,0,0.22)_3px_5px_30px_0px]"/>
        </div>

        <!-- Article Content -->
        <div class="max-w-[700px] mx-auto">
            <div 
                class="apple-md-content prose prose-lg !max-w-none pb-20"
                v-html="renderedContent"
            ></div>
        </div>
    </main>
</template>

<style scoped>
/* Apple Typography customized for markdown */
.apple-md-content {
    color: #1d1d1f;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
    font-size: 17px;
    line-height: 1.47;
    letter-spacing: -0.374px;
}
.apple-md-content h1, 
.apple-md-content h2, 
.apple-md-content h3, 
.apple-md-content h4 {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
    color: #1d1d1f;
    font-weight: 600;
    margin-top: 2em;
    margin-bottom: 0.8em;
}
.apple-md-content h1 { font-size: 40px; leading: 1.1; letter-spacing: -0.2px; }
.apple-md-content h2 { font-size: 28px; leading: 1.14; letter-spacing: 0.196px; }
.apple-md-content h3 { font-size: 21px; leading: 1.19; letter-spacing: 0.231px; }

.apple-md-content p {
    color: rgba(0,0,0,0.8);
    margin-bottom: 1.5em;
}

.apple-md-content a {
    color: var(--color-link);
    text-decoration: none;
}
.apple-md-content a:hover {
    text-decoration: underline;
}

.apple-md-content blockquote {
    border-left: 4px solid #d2d2d7;
    padding-left: 1rem;
    color: rgba(0,0,0,0.5);
    font-style: italic;
    background: #f5f5f7;
    padding: 1rem;
    border-radius: 4px;
}

.apple-md-content img {
    border-radius: 8px;
    margin: 2em auto;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
</style>
