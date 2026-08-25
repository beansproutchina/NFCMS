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
 * 目录页左侧的栏目菜单:当前**一级栏目**及其下的全部子栏目。
 *
 * 数据来自 `rootCat` —— theme.config 按 `breadcrumbs[0].slug` 单独取的那一次分类查询,
 * 它返回的 `children` 正好是菜单项。
 *
 * 为什么不是 `context.children`:那只是当前分类的直接子级,在二级栏目页上是空的。
 * 为什么不是 `menus`:像「新闻动态」这种不进主导航的根栏目,菜单里压根没有它。
 * 为什么不拉全量分类树:公开站每页多传上百条分类,只为从中挑出一个分支。
 */
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { categoryUrl, catNameEn, t, type Locale } from '../lib';

const props = withDefaults(defineProps<{ context: any; locale?: Locale }>(), { locale: 'zh' });
const route = useRoute();

/** 英文侧走自定义路由,面包屑挂在 prefetch 出来的 category 上。 */
const root = computed(() => props.context?.rootCat ?? null);

/**
 * 菜单项 = 「总入口」+ 各子栏目。
 *
 * 总入口指向**父栏目自己** —— 父栏目页按 `data.section` 聚合整棵子树,本来就是"全部"。
 * 名字取分类的 `data.index_label`(原站 people 叫「人员名录」、events 叫「全部」),没配就
 * 退回通用的"全部"。以前是给它单建一个空分类,点进去自然是空页。
 */
const items = computed(() => {
    const kids = (root.value?.children ?? [])
        .slice()
        .sort((a: any, b: any) => Number(a.weight ?? 50) - Number(b.weight ?? 50))
        .map((c: any) => ({ label: c.name, url: categoryUrl(c.slug, props.locale) }));
    if (!kids.length) return kids;
    const label = String(root.value?.data?.index_label ?? '').trim() || t('all', props.locale);
    return [{ label, url: categoryUrl(root.value.slug, props.locale) }, ...kids];
});

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
