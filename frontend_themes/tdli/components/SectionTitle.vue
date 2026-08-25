<template>
  <div class="index-title">
    <Reveal from="left" class="title-wrap">
      <h2 class="fnt45"><span>{{ title }}</span></h2>
    </Reveal>
    <Reveal v-if="more" from="right">
      <a class="single-link fnt16" :href="more">
        <span class="text"><span>{{ moreLabel }}</span></span>
        <i class="iconfont icon-add fnt18"></i>
      </a>
    </Reveal>
  </div>
</template>

<script setup lang="ts">
import Reveal from './Reveal.vue';
defineProps<{ title: string; more?: string; moreLabel?: string }>();
</script>

<style scoped>
.index-title { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 2.34275vw; line-height: 1.4; }
.title-wrap { flex: 1; min-width: 0; }
h2 { position: relative; display: inline-block; color: var(--color-primary); font-weight: 600; }
/* 标题下那条与文字等宽的主色横杠 —— 跟着 span 走,所以中英文长度不同也贴合 */
h2 span { position: relative; display: inline-block; }
h2 span::before {
  content: ""; position: absolute; left: 0; bottom: -10px; width: 100%; height: var(--size-4);
  background-color: var(--color-primary);
}

.single-link { display: flex; align-items: center; height: 2.51667vw; min-height: 35px; flex: none; }
.single-link .text {
  display: flex; align-items: center; padding: 0 .625vw 0 1.09375vw; height: 100%;
  position: relative; transition: color .3s ease-in-out; white-space: nowrap;
  isolation: isolate;              /* 自建层叠上下文,底色不会被外层背景吃掉 */
}
/* hover 时主色从左铺满文字区,图标块保持不动 —— 与原站一致 */
.single-link .text::before {
  content: ""; position: absolute; inset: 0 auto 0 0; width: 0;
  background: var(--color-primary); transition: width .3s ease-in-out; z-index: 0;
}
/* 文字必须自己抬到底色之上:`z-index:-1` 会把底色推到**父元素背景**之后,于是
   hover 时只看得到字变白、看不到那块蓝底。 */
.single-link .text > span { position: relative; z-index: 1; }
.single-link:hover .text { color: #fff; }
.single-link:hover .text::before { width: 100%; }
.single-link .iconfont {
  width: 2.51667vw; min-width: 35px; height: 100%; display: flex; align-items: center; justify-content: center;
  color: var(--color-primary); background-color: var(--bg-grey); font-weight: bold;
}
.td-main-grey .single-link .iconfont { background-color: #FFEEEF; }

@media (max-width: 1199px) {
  .index-title { margin-bottom: 35px; }
  .single-link .text { padding: 0 8px 0 14px; }
}
@media (max-width: 767px) { .index-title { margin-bottom: 24px; } }
</style>
