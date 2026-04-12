<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const user = ref<any>(null);
const stats = ref([
  { label: 'dashboard.totalArticles', value: '...' },
  { label: 'dashboard.schemasActive', value: '...' },
]);

onMounted(async () => {
  const storedUser = localStorage.getItem('user');
  if (storedUser) {
    user.value = JSON.parse(storedUser);
  }
  
  try {
    const schemas = await axios.get('/api/schematools/all');
    let articleCount = 0;
    try {
        const at = await axios.get('/api/articles');
        articleCount = at.data.data.length || 0;
    } catch(e) {}
    
    stats.value = [
      { label: 'dashboard.totalArticles', value: articleCount.toString() },
      { label: 'dashboard.schemasActive', value: (schemas.data?.data?.length || 0).toString() }
    ];
  } catch (err) {
    console.error(err);
  }
});
</script>

<template>
    <div class="max-w-5xl mx-auto py-10 w-full px-6">
      <h1 class="text-[40px] font-semibold leading-[1.1] tracking-tight mb-2">{{ $t('dashboard.welcome') }}, {{ user?.username || 'Admin' }}</h1>
      <p class="text-[21px] text-[rgba(0,0,0,0.8)] font-normal leading-[1.19] mb-12">{{ $t('dashboard.overviewPrefix') }}</p>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div v-for="stat in stats" :key="stat.label" class="bg-white rounded-[12px] p-6 shadow-[0px_5px_30px_rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.04)]">
          <h3 class="text-[17px] font-medium text-[rgba(0,0,0,0.8)] mb-2">{{ $t(stat.label) }}</h3>
          <p class="text-[56px] font-semibold leading-[1.07] tracking-[-0.28px]">{{ stat.value }}</p>
        </div>
      </div>
    </div>
</template>
