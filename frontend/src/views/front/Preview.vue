<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { marked } from 'marked';
import { contentAPI } from '../../api';

const route = useRoute();
const { t } = useI18n();
const article = ref<any>(null);
const error = ref('');
const loading = ref(true);

const rendered = computed(() => (article.value?.content ? marked.parse(article.value.content) : ''));

onMounted(async () => {
    const id = route.query.id as string;
    const pt = route.query.pt as string;
    if (!id || !pt) { error.value = t('preview.missing'); loading.value = false; return; }
    try {
        const res = await contentAPI.preview(id, pt);
        article.value = res.data?.article || null;
        if (!article.value) error.value = t('preview.notFound');
    } catch (e) {
        error.value = t('preview.failed');
    } finally {
        loading.value = false;
    }
});
</script>

<template>
    <div class="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
        <div class="sticky top-0 z-10 bg-[#c2410c] text-white text-center text-[13px] py-2 font-medium tracking-wide">
            {{ $t('preview.banner') }}
        </div>
        <div class="max-w-[800px] mx-auto px-6 py-12">
            <div v-if="loading" class="text-[rgba(0,0,0,0.5)]">{{ $t('preview.loading') }}</div>
            <div v-else-if="error" class="text-red-600">{{ error }}</div>
            <template v-else>
                <h1 class="text-[40px] font-semibold leading-[1.1] tracking-tight mb-3">{{ article.title }}</h1>
                <p v-if="article.description" class="text-[17px] text-[rgba(0,0,0,0.6)] mb-8">{{ article.description }}</p>
                <div class="prose max-w-none" v-html="rendered"></div>
            </template>
        </div>
    </div>
</template>
