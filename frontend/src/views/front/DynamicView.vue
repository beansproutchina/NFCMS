<template>
  <div>
    <div v-if="error" class="text-center py-20 text-red-500">{{ error }}</div>
    <div v-else-if="templateComponent" class="animate-fade-in transition-opacity duration-300">
      <NestedLayouts v-if="layoutComponents.length > 0" :layouts="layoutComponents" :context="context">
        <component :is="templateComponent" :context="context" />
      </NestedLayouts>
      <component v-else :is="templateComponent" :context="context" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, markRaw, defineComponent, h } from 'vue';
import { useRoute } from 'vue-router';
import * as api from '../../api';
import { useAuthStore } from '../../stores/auth';
import DefaultHome from './templates/DefaultHome.vue';
import DefaultCategory from './templates/DefaultCategory.vue';
import DefaultArticle from './templates/DefaultArticle.vue';

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
const authStore = useAuthStore();
const error = ref('');
const templateComponent = ref<any>(null);
const layoutComponents = ref<any[]>([]);

// 默认模板映射
const defaultTemplates: Record<string, any> = {
  home: DefaultHome,
  category: DefaultCategory,
  article: DefaultArticle,
};

// 从 fetchedData 构建 context
const context = computed(() => {
  const fetchedData: any = route.meta.fetchedData;
  if (!fetchedData || !fetchedData.success) return {};

  const { data, config, menus } = fetchedData;
  // 获取当前用户
  const user = authStore.user;

  // 合并通用数据到 context 中
  return {
    config: config || {},
    menus: menus || [],
    user,
    api,
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

// 解析并加载模板
async function resolveTemplate() {
  error.value = '';
  templateComponent.value = null;
  layoutComponents.value = [];

  const fetchedData: any = route.meta.fetchedData;
  if (!fetchedData) return;

  if (!fetchedData.success) {
    error.value = fetchedData.error || 'Failed to load content';
    return;
  }

  const viewType = route.meta.viewType as string;
  const templateName = fetchedData.templateName || 'DefaultHome';
  const layouts = fetchedData.layouts || [];

  const defaultTemplate = defaultTemplates[viewType] || DefaultHome;
  
  // 先加载布局 (支持多层)
  for (const l of layouts) {
      const comp = await loadComponent(l);
      if (comp) layoutComponents.value.push(comp);
  }

  // 再加载实际模板
  templateComponent.value = await loadComponent(templateName, defaultTemplate);
}

// 监听数据变化
watch(() => route.meta.fetchedData, resolveTemplate, { immediate: true });
</script>
