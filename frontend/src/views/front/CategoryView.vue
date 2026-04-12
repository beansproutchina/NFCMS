<template>
  <div>
    <div v-if="error" class="text-center py-20 text-red-500">{{ error }}</div>
    <div v-else-if="templateComponent" class="animate-fade-in transition-opacity duration-300">
      <component 
         :is="templateComponent" 
         :category="data.category" 
         :articles="data.articles" 
         :children="data.children" 
         :breadcrumbs="data.breadcrumbs"
         :user="user" 
         :config="configData"
         :api="api"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watchEffect, markRaw } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../api';
import DefaultCategory from './templates/DefaultCategory.vue';

const route = useRoute();
const error = ref('');
const data = ref<any>(null);
const configData = ref<any>({});
const user = ref<any>(null);
const templateComponent = ref<any>(null);

const resolveTemplate = async () => {
    error.value = '';
    const fetchedData: any = route.meta.fetchedData;
    
    if (!fetchedData) return;

    if (!fetchedData.success) {
        error.value = fetchedData.error || 'Failed to load category';
        return;
    }

    data.value = fetchedData.data;
    configData.value = fetchedData.config || {};
    try { user.value = JSON.parse(localStorage.getItem('user') || 'null'); } catch(e){}
    const templateName = data.value.template;

    if (templateName === 'DefaultCategory') {
        templateComponent.value = markRaw(DefaultCategory);
    } else {
        try {
            const comps = import.meta.glob('./templates/*.vue');
            const path = `./templates/${templateName}.vue`;
            if(comps[path]) {
                const comp = await comps[path]();
                templateComponent.value = markRaw((comp as any).default);
            } else {
                console.warn(`Template ${templateName} not found, using DefaultCategory`);
                templateComponent.value = markRaw(DefaultCategory);
            }
        } catch(e) {
            console.error(e);
            templateComponent.value = markRaw(DefaultCategory);
        }
    }
};

watchEffect(resolveTemplate);
</script>
