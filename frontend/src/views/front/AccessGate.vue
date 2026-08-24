<script setup lang="ts">
/**
 * 受众轴的**框架兜底** gate 页。受限内容被判定为 `locked` 时(后端返回 200 + 摘要 + locked:true),
 * router 把模板换成 `AccessGate`,走的还是同一条渲染通路。
 *
 * 为什么放在 `views/front/` 而不是 `views/front/templates/`:Dockerfile.single 会把
 * `frontend_themes/<THEME>/` 整个 COPY 覆盖 templates/,放进去会被主题清掉。
 * 主题想自定义就在自己目录里放一个 `AccessGate.vue`,DynamicView 的 loadComponent 会优先用它,
 * 找不到才回落到这里。见 docs/public-access.md §6。
 *
 * 刻意保持朴素:它是"能看、能登录"的最低保障,不假设任何主题令牌。主题要好看就自己提供一份。
 */
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ context?: any }>();
const route = useRoute();
const { t } = useI18n();

const article = computed(() => props.context?.data?.article ?? {});
const siteName = computed(() => props.context?.data?.config?.site_name ?? '');
// 登录后回到当前公开页 —— redirect 由这里带上,不是拦截器的事(公开站不产生 401)。
const loginLink = computed(() => `/login?redirect=${encodeURIComponent(route.fullPath)}`);
</script>

<template>
  <main class="gate">
    <p class="gate__eyebrow">{{ siteName }}</p>
    <h1 class="gate__title">{{ article.title || t('gate.title') }}</h1>
    <p v-if="article.description" class="gate__excerpt">{{ article.description }}</p>

    <div class="gate__notice">
      <p class="gate__msg">{{ t('gate.message') }}</p>
      <a :href="loginLink" class="gate__btn">{{ t('gate.login') }}</a>
    </div>

    <a href="/" class="gate__back">{{ t('gate.backHome') }}</a>
  </main>
</template>

<style scoped>
.gate {
  max-width: 40rem;
  margin: 0 auto;
  padding: 4rem 1.5rem;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #1a1a1a;
}
.gate__eyebrow {
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8a8a8a;
}
.gate__title {
  margin: 0 0 1rem;
  font-size: 1.875rem;
  line-height: 1.25;
  font-weight: 700;
}
.gate__excerpt {
  margin: 0 0 2rem;
  font-size: 1.0625rem;
  line-height: 1.7;
  color: #4a4a4a;
}
.gate__notice {
  padding: 1.5rem;
  border: 1px solid #e2e2e2;
  border-radius: 0.75rem;
  background: #fafafa;
}
.gate__msg {
  margin: 0 0 1rem;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: #4a4a4a;
}
.gate__btn {
  display: inline-block;
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  background: #1a1a1a;
  color: #fff;
  font-size: 0.9375rem;
  font-weight: 500;
  text-decoration: none;
}
.gate__btn:hover { background: #333; }
.gate__back {
  display: inline-block;
  margin-top: 2rem;
  font-size: 0.875rem;
  color: #6a6a6a;
}

@media (prefers-color-scheme: dark) {
  .gate { color: #ededed; }
  .gate__eyebrow { color: #8a8a8a; }
  .gate__excerpt, .gate__msg { color: #b4b4b4; }
  .gate__notice { border-color: #2e2e2e; background: #161616; }
  .gate__btn { background: #ededed; color: #111; }
  .gate__btn:hover { background: #fff; }
  .gate__back { color: #9a9a9a; }
}
</style>
