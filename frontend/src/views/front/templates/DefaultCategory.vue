<template>
  <div class="bg-[#f5f5f7] min-h-screen font-text">
    <div class="max-w-5xl mx-auto px-6 py-12">
      <!-- Breadcrumbs -->
      <Breadcrumb class="mb-8" v-if="breadcrumbs && breadcrumbs.length" :items="breadcrumbs" />

      <!-- Category Hero -->
      <div class="mb-12 border-b border-[rgba(0,0,0,0.05)] pb-6">
        <h1 class="text-[56px] font-display font-semibold tracking-[-0.015em] leading-[1.07] text-[#1d1d1f]">{{ category.name }}</h1>
        <p v-if="category.data && category.data.description" class="mt-4 text-[21px] text-[rgba(0,0,0,0.8)] font-light leading-[1.3]">{{ category.data.description }}</p>
      </div>

      <!-- Articles Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="article in articles" :key="article.id" class="bg-white rounded-[12px] p-6 shadow-[0px_5px_30px_rgba(0,0,0,0.06)] hover:shadow-[0px_8px_40px_rgba(0,0,0,0.12)] transition-shadow">
           <img v-if="article.thumbnail" :src="article.thumbnail" class="w-full h-48 object-cover rounded-[8px] mb-6"/>
           <h3 class="text-[21px] font-display font-semibold leading-[1.19] text-[#1d1d1f] mb-2">{{ article.title }}</h3>
           <p class="text-[14px] text-[rgba(0,0,0,0.5)] mb-4 font-mono">{{ new Date(article.created_at).toLocaleDateString() }}</p>
           
           <router-link :to="`/a/${category.slug}/${article.slug}`" class="inline-block mt-4 bg-apple-blue text-white px-4 py-2 rounded-[980px] text-[14px] hover:bg-[#0066cc] transition-colors">
              {{ $t('front.readMore') || 'Read More' }}
           </router-link>
        </div>
      </div>
      
      <div v-if="articles.length === 0" class="text-center py-20 text-[rgba(0,0,0,0.5)]">
        No articles available in this category.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Breadcrumb from '../../../components/Breadcrumb.vue';
defineProps<{
  category: any,
  articles: any[],
  children: any[],
  breadcrumbs: any[],
  config?: any,
  api?: any,
  user?: any
}>();
</script>
