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
import { ref, computed, watch, markRaw, defineComponent, h } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import * as api from '../../api';
import { useAuthStore } from '../../stores/auth';
import DefaultHome from './templates/DefaultHome.vue';
import DefaultCategory from './templates/DefaultCategory.vue';
import DefaultArticle from './templates/DefaultArticle.vue';
// 框架兜底的 gate 页。刻意放在 templates/ 之外 —— 那个目录会被主题整体覆盖(Dockerfile.single)。
import BuiltinAccessGate from './AccessGate.vue';
import { info as themeInfo } from './templates/theme.config';

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
const templateComponent = ref<any>(null);
const layoutComponents = ref<any[]>([]);
// Bumped after each successful (re)load so the page body remounts per navigation (re-reading
// context) WITHOUT nulling templateComponent first — nulling caused a blank gap + fade-in replay.
const renderKey = ref(0);

// 默认模板映射
const defaultTemplates: Record<string, any> = {
  home: DefaultHome,
  category: DefaultCategory,
  article: DefaultArticle,
};

/** 受众轴的 gate 页模板名(主题可用 `info.accessGate` 换名)。 */
const isAccessGate = (name: string) => name === ((themeInfo as any)?.accessGate || 'AccessGate');

// 从 fetchedData 构建 context
const context = computed(() => {
  const fetchedData: any = route.meta.fetchedData;
  if (!fetchedData || !fetchedData.success) return {};

  const { data, config, menus, meta } = fetchedData;
  // 获取当前用户
  const user = authStore.user;

  // 合并通用数据到 context 中
  return {
    config: config || {},
    menus: menus || [],
    user,
    api,
    // Pagination meta per prefetch key (e.g. $meta.articles.total) — see router prefetch.
    $meta: meta || {},
    ...data, // 所有预取的数据
  };
});

// 动态加载模板或布局组件
async function loadComponent(name: string, fallbackTemplate?: any): Promise<any> {
  console.log('Loading component:', name);
    try {
        if (fallbackTemplate && name === fallbackTemplate.name) {
            return markRaw(fallbackTemplate);
        }
        const modules = import.meta.glob('./templates/*.vue');
        const path = `./templates/${name}.vue`;
        if (modules[path]) {
            const mod: any = await modules[path]();
            return markRaw(mod.default);
        } else {
            console.warn(`Component ${name} not found`);
            return fallbackTemplate ? markRaw(fallbackTemplate) : null;
        }
    } catch (e) {
        console.error('Error loading component:', e);
        return fallbackTemplate ? markRaw(fallbackTemplate) : null;
    }
}

// Remember the current layout chain so we only rebuild it when it actually changes.
let lastLayoutKey = '';

// 解析并加载模板
async function resolveTemplate() {
  const fetchedData: any = route.meta.fetchedData;
  if (!fetchedData) { error.value = ''; templateComponent.value = null; layoutComponents.value = []; lastLayoutKey = ''; return; }

  if (!fetchedData.success) {
    error.value = fetchedData.error || 'Failed to load content';
    templateComponent.value = null; layoutComponents.value = []; lastLayoutKey = '';
    return;
  }
  error.value = '';

  const viewType = route.meta.viewType as string;
  const templateName = fetchedData.templateName || 'DefaultHome';
  const layouts = fetchedData.layouts || [];
  // 受众轴的 gate 页有专属兜底:回落到 DefaultArticle 会渲染一个没有正文的空文章页,而这里
  // 需要的是登录引导。主题在自己目录里放 AccessGate.vue 即可覆盖(loadComponent 优先用主题的)。
  const defaultTemplate = isAccessGate(templateName)
    ? BuiltinAccessGate
    : (defaultTemplates[viewType] || DefaultHome);

  // Only (re)build the layout chain when it changes between navigations. Rebuilding it every time
  // would remount the layout — and with it the header + logo <img> — causing a visible flash.
  // The page body (templateComponent) still swaps per navigation below.
  const layoutKey = layouts.join('>');
  if (layoutKey !== lastLayoutKey) {
    const comps: any[] = [];
    for (const l of layouts) {
      const comp = await loadComponent(l);
      if (comp) comps.push(comp);
    }
    layoutComponents.value = comps;
    lastLayoutKey = layoutKey;
  }

  // Swap the page body atomically: load the new component, then assign + bump the key in the same
  // tick. No intermediate null → no blank flash / fade-in replay; the key change still forces a
  // remount so same-template navigations re-read their (non-reactive) destructured context.
  const next = await loadComponent(templateName, defaultTemplate);
  templateComponent.value = next;
  renderKey.value++;
}

// 监听数据变化
watch(() => route.meta.fetchedData, resolveTemplate, { immediate: true });
</script>
