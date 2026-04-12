<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../api';

const route = useRoute();
const siteConfig = ref<any>({});
const user = ref<any>(null);
const articles = ref<any[]>([]);
const categories = ref<any[]>([]);
const currentTemplate = shallowRef<any>(null);

const loadTemplate = async (templateName: string) => {
    try {
        const modules = import.meta.glob('./templates/*.vue');
        const path = `./templates/${templateName}.vue`;
        if (modules[path]) {
            const mod: any = await modules[path]();
            currentTemplate.value = mod.default;
        } else {
            console.warn(`Template ${templateName} not found, falling back to DefaultHome`);
            const defaultMod: any = await modules['./templates/DefaultHome.vue']();
            currentTemplate.value = defaultMod.default;
        }
    } catch (error) {
        console.error("Error loading home template:", error);
    }
};

watch(
    () => route.meta.fetchedData,
    async (newData: any) => {
        if (newData) {
            siteConfig.value = newData.config || {};
            try { user.value = JSON.parse(localStorage.getItem('user') || 'null'); } catch(e){}
            articles.value = newData.articles || [];
            categories.value = newData.categories || [];
            const templateName = siteConfig.value.home_template || 'DefaultHome';
            await loadTemplate(templateName);
        }
    },
    { immediate: true, deep: true }
);

</script>

<template>
    <component 
        :is="currentTemplate" 
        v-if="currentTemplate" 
        :context="{
            config: siteConfig,
            articles,
            categories,
            menus: route.meta.fetchedData?.menus || [],
            user,
            api
        }"
    />
</template>
