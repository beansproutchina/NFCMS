<template>
  <div @click="onRootClick">
    <div v-if="error" class="text-center py-20 text-red-500">{{ error }}</div>
    <div v-else-if="templateComponent" class="animate-fade-in transition-opacity duration-300">
      <NestedLayouts v-if="layoutComponents.length > 0" :layouts="layoutComponents" :context="context">
        <component :is="templateComponent" :context="context" :key="renderKey" />
      </NestedLayouts>
      <component v-else :is="templateComponent" :context="context" :key="renderKey" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineComponent, h, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import * as api from '../../api';
import { useAuthStore } from '../../stores/auth';
import { resolveTemplateChain } from './templateLoader';

const NestedLayouts = defineComponent({
  props: ['layouts', 'context'],
  setup(props, { slots }) {
    return () => {
      let current = slots.default ? slots.default() : null;
      for (let i = 0; i < props.layouts.length; i++) {
          const Comp = props.layouts[i];
          const child = current;
          current = [h(Comp, { context: props.context }, { default: () => child })];
      }
      return current;
    };
  }
});

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

/**
 * Delegated link handler for the whole front site. Themes (and Markdown article bodies rendered
 * via v-html) use plain <a href> links; a bare left-click on an internal one would trigger a full
 * browser navigation — rebooting the SPA and reloading the header/logo (the "flash"). Here we
 * intercept those and route via the SPA instead, while leaving the real href intact so SEO,
 * middle-click / ⌘-click "open in new tab", and external links all keep working.
 */
function onRootClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const anchor = (e.target as HTMLElement)?.closest?.('a');
  if (!anchor) return;
  const href = anchor.getAttribute('href');
  if (!href) return;
  // Leave external / new-tab / download / protocol / hash links to the browser.
  if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
  if (/^(https?:)?\/\//i.test(href) || /^(mailto:|tel:|#)/i.test(href)) return;
  e.preventDefault();
  if (href !== route.fullPath) router.push(href);
}
const error = ref('');
/**
 * 初值**同步**取自 router 已经解析好的组件(见 templateLoader.ts)。
 *
 * 留成 null 再异步补的话,组件挂载后的第一次渲染是空的 `<div><!----></div>` —— 普通 SPA 下
 * 只是一帧空白,但预渲染页正是在这一帧上水合:空 DOM 对不上整页静态内容,Vue 判 mismatch 后
 * 整棵重渲染,肉眼看到的就是整页闪白(实测 8876 → 18 → 8876 字符)。
 */
const initial = (useRoute().meta.fetchedData as any)?.components;
const templateComponent = ref<any>(initial?.template ?? null);
const layoutComponents = ref<any[]>(initial?.layouts ?? []);
// Bumped after each successful (re)load so the page body remounts per navigation (re-reading
// context) WITHOUT nulling templateComponent first — nulling caused a blank gap + fade-in replay.
const renderKey = ref(0);

// 从 fetchedData 构建 context
const context = computed(() => {
  const fetchedData: any = route.meta.fetchedData;
  if (!fetchedData || !fetchedData.success) return {};

  const { data, config, menus, meta } = fetchedData;
  return {
    config: config || {},
    menus: menus || [],
    user: authStore.user,
    api,
    // Pagination meta per prefetch key (e.g. $meta.articles.total) — see router prefetch.
    $meta: meta || {},
    ...data, // 所有预取的数据
  };
});

// Remember the current layout chain so we only rebuild it when it actually changes.
let lastLayoutKey = ((useRoute().meta.fetchedData as any)?.layouts ?? []).join('>');

// 解析并加载模板
async function resolveTemplate() {
  const fetchedData: any = route.meta.fetchedData;
  // 导航中:数据还没写进 meta。清掉信号,免得生成器抓到上一页的 ready。
  setSsgSignal(null);
  if (!fetchedData) { error.value = ''; templateComponent.value = null; layoutComponents.value = []; lastLayoutKey = ''; return; }

  if (!fetchedData.success) {
    error.value = fetchedData.error || 'Failed to load content';
    templateComponent.value = null; layoutComponents.value = []; lastLayoutKey = '';
    setSsgSignal('error');
    return;
  }
  error.value = '';

  const viewType = route.meta.viewType as string;
  const templateName = fetchedData.templateName || 'DefaultHome';
  const layouts = fetchedData.layouts || [];

  // router 在导航完成前已经解析好了(见 templateLoader.ts);拿不到才现取,那只发生在
  // 绕过 router fetch 的场景(比如测试直接塞 fetchedData)。
  const resolved = fetchedData.components
    ?? (await resolveTemplateChain(templateName, layouts, viewType));

  // Only (re)build the layout chain when it changes between navigations. Rebuilding it every time
  // would remount the layout — and with it the header + logo <img> — causing a visible flash.
  // The page body (templateComponent) still swaps per navigation below.
  const layoutKey = layouts.join('>');
  if (layoutKey !== lastLayoutKey) {
    layoutComponents.value = resolved.layouts;
    lastLayoutKey = layoutKey;
  }

  // Swap the page body atomically: assign + bump the key in the same tick. No intermediate null
  // → no blank flash / fade-in replay; the key change still forces a remount so same-template
  // navigations re-read their (non-reactive) destructured context.
  templateComponent.value = resolved.template;
  renderKey.value++;

  // 等这一帧真的渲染出来再报就绪 —— 早一个 tick 生成器就会截到空的模板槽。
  await nextTick();
  setSsgSignal('ready');
}

/**
 * SSG 就绪信号 —— 预渲染生成器唯一认的握手。
 *
 * 生成器怎么知道页面渲染完了?三个候选:
 *   - `networkidle`:**直接判死**。neo 主题往 <head> 插了个指向 fonts.googleapis.com 的
 *     link,离线内网里那个请求永远挂着,等网络空闲就是每页必超时。
 *   - 固定 sleep:慢页截半张、快页白等,且不可证伪。
 *   - **应用自报**(本方案):确定性,与网络无关,与耗时无关。
 *
 * 三态,生成器分别对应「可以截了 / 别写文件 / 再等等」:
 *   data-ssg-ready  渲染成功
 *   data-ssg-error  这一页渲染不出来(404、后端错误)—— 生成器**不写文件**,于是这条 URL
 *                   回落 SPA,而不是被固化成一张「内容不存在」的静态页
 *   两者都无        数据还没到位(导航中),别抓半张页面
 */
function setSsgSignal(state: 'ready' | 'error' | null) {
  const html = document.documentElement;
  html.removeAttribute('data-ssg-ready');
  html.removeAttribute('data-ssg-error');
  if (state) html.setAttribute(`data-ssg-${state}`, '1');
}

// 监听数据变化
watch(() => route.meta.fetchedData, resolveTemplate, { immediate: true });
</script>
