<template>
    <!-- Unified Header -->
    <nav
        class="sticky top-0 z-50 w-full h-[48px] bg-[rgba(0,0,0,0.8)] backdrop-blur-[20px] backdrop-saturate-[180%] flex items-center px-4 md:px-12 justify-between text-white transition-all">
        <div class="cursor-pointer font-semibold text-[17px] tracking-tight" @click="router.push('/')">
            {{ config?.site_name || 'NFCMS Blog' }}
        </div>
        <div class="flex items-center gap-6 text-[12px] opacity-80 font-normal tracking-wide">
            <Button v-for="item in headerMenu" :key="item.id" @click="navigateTo(item.url)"
                class="hover:opacity-100 hover:underline transition-opacity">
                {{ item.label }}
            </Button>
        </div>
    </nav>

</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
const props = defineProps<{ context: any }>();
const { config, menus } = props.context || {};
const router = useRouter();

const navigateTo = (url: string) => {
    if (url.startsWith('http')) {
        window.open(url, '_blank');
    } else {
        router.push(url);
    }
};

const headerMenu = menus && menus.length ? menus[0].items : [];
</script>