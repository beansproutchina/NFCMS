<template>
  <section v-if="slides.length" class="hero">
    <div class="hero-track">
      <a v-for="(a, i) in slides" :key="a.id ?? i"
         :class="['slide', { active: i === index }]"
         :href="slideHref(a)" :target="isExternal(slideHref(a)) ? '_blank' : undefined">
        <img class="slide-bg" :src="a.thumbnail" :alt="a.title" />
        <div class="slide-mask"></div>
        <div class="td-container slide-inner">
          <div class="slide-title fnt40">{{ a.title }}</div>
        </div>
      </a>
    </div>

    <button class="arrow prev" type="button" aria-label="prev" @click="go(index - 1)"><i class="iconfont icon-left"></i></button>
    <button class="arrow next" type="button" aria-label="next" @click="go(index + 1)"><i class="iconfont icon-right"></i></button>

    <div class="dots">
      <button v-for="(_, i) in slides" :key="i" :class="['dot', { active: i === index }]"
              type="button" :aria-label="`${i + 1}`" @click="go(i)"></button>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * 首页全屏焦点图。自己写而不是引 swiper:需要的只是"淡入切换 + 箭头 + 圆点 + 自动播放"。
 *
 * 数据是 `is_top` 的文章,且**必须有 thumbnail** —— 没有封面的置顶文章会渲染成一块空白,
 * 所以在这里就滤掉。焦点图是"需要有人显式设置才亮"的位:一篇都没有就整块不渲染,
 * 而不是抓最新文章顶上(那会把不相关内容推上 banner,比空着更像事故)。
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { articleUrl, type Locale } from '../lib';

const props = withDefaults(defineProps<{ items?: any[]; locale?: Locale }>(), { locale: 'zh' });

const slides = computed<any[]>(() => (props.items ?? []).filter((a: any) => a?.thumbnail));
const index = ref(0);
let timer: any = null;

const go = (i: number) => {
    const n = slides.value.length;
    if (!n) return;
    index.value = (i % n + n) % n;
    restart();
};
const restart = () => { stop(); if (slides.value.length > 1) timer = setInterval(() => go(index.value + 1), 6000); };
const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

/** `data.external_url` 优先:原站大量焦点图直接指向公众号推文。 */
const slideHref = (a: any) => String(a?.data?.external_url || articleUrl(a, props.locale));
const isExternal = (url: string) => /^(https?:)?\/\//i.test(url);

onMounted(restart);
onUnmounted(stop);
</script>

<style scoped>
.hero { position: relative; width: 100%; height: 100vh; min-height: 420px; max-height: 1000px; overflow: hidden; background: #0D3C94; }
.hero-track { position: absolute; inset: 0; }
.slide { position: absolute; inset: 0; opacity: 0; transition: opacity .8s ease; display: block; pointer-events: none; }
.slide.active { opacity: 1; pointer-events: auto; }
.slide-bg { width: 100%; height: 100%; object-fit: cover; }
/* 底部压暗,保证白色标题在任何图上都读得清 */
.slide-mask { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,.10) 40%, rgba(0,0,0,.65) 100%); }
.slide-inner { position: absolute; left: 0; right: 0; bottom: 12vh; }
.slide-title { color: #fff; font-weight: 600; line-height: 1.35; max-width: 60%; text-shadow: 0 2px 12px rgba(0,0,0,.35); }

.arrow {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 3;
  width: 48px; height: 48px; border: 1px solid rgba(255,255,255,.6); background: rgba(0,0,0,.15);
  color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.arrow:hover { background: var(--color-primary); border-color: var(--color-primary); }
.arrow.prev { left: 3vw; }
.arrow.next { right: 3vw; }

.dots { position: absolute; left: 0; right: 0; bottom: 5vh; display: flex; justify-content: center; gap: 10px; z-index: 3; }
.dot { width: 10px; height: 10px; border-radius: 50%; border: 0; background: rgba(255,255,255,.45); cursor: pointer; padding: 0; }
.dot.active { background: #fff; width: 26px; border-radius: 5px; }

@media (max-width: 991px) {
  .hero { height: 56vh; min-height: 320px; }
  .slide-title { max-width: 100%; }
  .arrow { display: none; }
}
</style>
