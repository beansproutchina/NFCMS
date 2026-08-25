<template>
  <aside v-if="items.length" class="secondary-menu">
    <div class="menu-head">
      <div class="title fnt40">{{ rootName }}</div>
      <div v-if="rootNameEn" class="title-en">{{ rootNameEn }}</div>
    </div>
    <nav class="menu-body fnt22">
      <a v-for="(m, i) in items" :key="i" :class="['item', { active: isActive(m.url) }]" :href="m.url">
        <span>{{ m.label }}</span>
        <i class="iconfont icon-left"></i>
      </a>
    </nav>
  </aside>
</template>

<script setup lang="ts">
/**
 * 目录页左侧的栏目菜单:显示**当前所在一级栏目**及其下的全部二级栏目。
 *
 * 数据源是 Layout 预取的**全量分类树**,不是 `context.children` —— 后者只给当前分类的直接
 * 子级,在二级栏目页上是空的。也不是 `menus`:像「新闻动态」这种不进主导航的根栏目,菜单
 * 里压根没有它,而它恰恰是有左侧菜单的。
 */
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { categoryUrl, catNameEn, type Locale } from '../lib';

const props = withDefaults(defineProps<{ context: any; locale?: Locale }>(), { locale: 'zh' });
const route = useRoute();

const crumbs = computed<any[]>(() => props.context?.breadcrumbs ?? []);
/** 面包屑第一段就是一级栏目;没有面包屑时(一级栏目自己)退回当前分类。 */
const rootCrumb = computed(() => crumbs.value[0] ?? props.context?.category ?? null);

const all = computed<any[]>(() => props.context?.categories ?? []);
/** 面包屑给的是精简对象(只有 id/name/slug),要拿 `data.name_en` 得回分类树里取整条。 */
const root = computed(() => all.value.find((c: any) => Number(c.id) === Number(rootCrumb.value?.id)) ?? rootCrumb.value);

const items = computed(() =>
    all.value
        .filter((c: any) => Number(c.parent_id) === Number(root.value?.id))
        .sort((a: any, b: any) => Number(a.weight ?? 50) - Number(b.weight ?? 50))
        .map((c: any) => ({ label: c.name, url: categoryUrl(c.slug, props.locale) })));

const rootName = computed(() => String(root.value?.name ?? ''));
const rootNameEn = computed(() => catNameEn(root.value));

const isActive = (url: string) => {
    const u = String(url || '').replace(/\/$/, '');
    return !!u && route.path.replace(/\/$/, '') === u;
};
</script>

<style scoped>
.secondary-menu {
  position: sticky; top: 20px; margin-top: -40px;
  box-shadow: 0 2px 30px rgba(0,0,0,.1); background: #fff;
  /* 右上切角 —— 原站的标志性形状 */
  clip-path: polygon(85% 0%, 100% var(--size-54), 100% 100%, 0% 100%, 0% 0);
}
.menu-head {
  background: var(--color-primary) url('https://tdli.sjtu.edu.cn/assets/images/header_bg.png') center/cover no-repeat;
  color: #fff; padding: var(--size-30) var(--size-36);
}
.menu-head .title { font-weight: 600; }
/* 英文副标题前面那道短横线 */
.menu-head .title-en {
  font-size: 13px; opacity: .85; padding-left: 34px; position: relative; text-transform: uppercase; margin-top: 6px;
}
.menu-head .title-en::before {
  content: ""; position: absolute; left: 0; top: 50%; height: 1px; width: 28px; background: #fff;
}

.menu-body { padding: var(--size-24) var(--size-40) 150px; background: #fff; }
.item {
  position: relative; display: flex; align-items: center; justify-content: space-between;
  padding: var(--size-20) 0; color: var(--color-text-primary); transition: color .3s;
}
.item::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--border-color); }
/* hover / 当前项:底部主色线从左展开 */
.item::before {
  content: ""; position: absolute; left: 0; bottom: 0; height: 1px; width: 0;
  background: var(--color-primary); z-index: 2; transition: width .3s;
}
.item:hover::before, .item.active::before { width: 100%; }
.item:hover, .item.active { color: var(--color-primary); }
.item .iconfont { opacity: 0; font-weight: 800; font-size: var(--size-18); color: var(--color-primary); transform: rotate(180deg); transition: opacity .3s; }
.item.active .iconfont { opacity: 1; }

@media (max-width: 991px) {
  .secondary-menu { position: static; margin-top: 0; clip-path: none; margin-bottom: 24px; }
  .menu-body { padding: 8px 20px; }
}
</style>
