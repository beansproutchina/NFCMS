<template>
  <div class="tdli-scope tdli-layout">
    <TdHeader :context="context" locale="en" :transparent="isHome" />
    <main class="tdli-main"><slot></slot></main>
    <TdFooter :context="context" locale="en" />
    <a v-show="showTop" class="back-top" href="#" aria-label="top" @click.prevent="toTop">
      <i class="iconfont icon-up"></i>
    </a>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import TdHeader from './components/TdHeader.vue';
import TdFooter from './components/TdFooter.vue';
import './tokens.css';
import './prose.css';

defineProps<{ context: any }>();

const route = useRoute();
/** 首页的页头压在焦点图上(透明),内页是蓝底。 */
const isHome = computed(() => route.path === '/en');

const showTop = ref(false);
const onScroll = () => { showTop.value = (window.scrollY || 0) > 400; };
const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }));
onUnmounted(() => window.removeEventListener('scroll', onScroll));
</script>

<style scoped>
.tdli-layout { display: flex; flex-direction: column; min-height: 100vh; }
.tdli-main { flex: 1; }
.back-top {
  position: fixed; right: 15px; bottom: 15px; z-index: 97;
  width: 40px; height: 40px; line-height: 40px; text-align: center; font-size: 28px;
  color: #1d1f22; opacity: .75; border-radius: 3px; background: rgba(255,255,255,.9);
}
.back-top:hover { opacity: 1; }
</style>
