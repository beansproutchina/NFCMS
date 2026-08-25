<template>
  <div class="td-main-grey">
    <Breadcrumb :items="context.breadcrumbs" :locale="locale" />
    <div class="td-block td-block--big">
      <div class="td-container cat-row">
        <SideMenu :context="context" :locale="locale" />
        <div class="cat-body">
          <div class="teacher-top">
            <div class="teacher-search">
              <input v-model="keyword" class="fnt16" :placeholder="t('namePlaceholder', locale)" />
              <span class="btn"><i class="iconfont icon-search-o"></i></span>
            </div>
            <select v-if="divisions.length" v-model="division" class="fnt16">
              <option value="">{{ t('allDivisions', locale) }}</option>
              <option v-for="dv in divisions" :key="dv" :value="dv">{{ dv }}</option>
            </select>
          </div>

          <div v-if="shown.length" class="teacher-list">
            <Reveal v-for="p in shown" :key="p.id">
              <a class="teacher-item" :href="href(p)">
                <div class="left-img">
                  <div class="td-img-box avatar"><img :src="avatar(p)" :alt="p.title" loading="lazy" /></div>
                </div>
                <div class="text-box">
                  <div class="top">
                    <div class="name fnt24">{{ p.title }}</div>
                    <div v-if="p.data?.job" class="title fnt16">{{ p.data.job }}</div>
                  </div>
                  <div class="info fnt16">
                    <span v-if="p.data?.office_phone"><i class="iconfont icon-mobile-o"></i>{{ p.data.office_phone }}</span>
                    <span v-if="p.data?.postal_address"><i class="iconfont icon-location-o"></i>{{ p.data.postal_address }}</span>
                    <span v-if="p.data?.email"><i class="iconfont icon-mail-o"></i>{{ p.data.email }}</span>
                  </div>
                </div>
              </a>
            </Reveal>
          </div>
          <p v-else class="empty fnt18">{{ t('empty', locale) }}</p>
          <Pager v-if="!filtering" :page="page" :total-pages="totalPages" :locale="locale" @go="goPage" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 人员名录。姓名搜索与研究部筛选都在**当前页已取到的数据上**做,不再发请求 ——
 * 分页由服务端负责,筛选是即时的辅助手段;两者一旦混在一起,"第 3 页里筛出 2 条"这种
 * 结果会比没有筛选更让人困惑。筛选生效时隐藏分页器,避免暗示还有别的页。
 */
import { ref, computed } from 'vue';
import Breadcrumb from './components/Breadcrumb.vue';
import SideMenu from './components/SideMenu.vue';
import Pager from './components/Pager.vue';
import Reveal from './components/Reveal.vue';
import { useCategoryList, articleUrl, t, type Locale } from './lib';

const props = withDefaults(defineProps<{ context: any; locale?: Locale }>(), { locale: 'zh' });
const locale = computed<Locale>(() => props.locale ?? 'zh');
const { items, page, totalPages, goPage } = useCategoryList(props.context, 12);

const keyword = ref('');
const division = ref('');
const filtering = computed(() => !!keyword.value.trim() || !!division.value);

const divisions = computed(() => {
    const set = new Set<string>();
    for (const p of items.value) { const d = p?.data?.organize_desc; if (d) set.add(String(d)); }
    return [...set];
});

const shown = computed(() => {
    const kw = keyword.value.trim().toLowerCase();
    return items.value.filter((p: any) => {
        if (division.value && p?.data?.organize_desc !== division.value) return false;
        if (!kw) return true;
        const hay = `${p.title ?? ''} ${p.data?.name_en ?? ''}`.toLowerCase();
        return hay.includes(kw);
    });
});

const PLACEHOLDER = 'https://mockimg.dev/260x330/CCCCCC/66CCFF.png';
const avatar = (p: any) => String(p?.data?.avatar || p?.thumbnail || PLACEHOLDER);
const href = (p: any) => articleUrl(p, locale.value);
</script>

<style scoped>
.cat-row { display: flex; gap: 2.8vw; align-items: flex-start; }
.cat-row > :deep(.secondary-menu) { width: 25%; flex: none; }
.cat-body { flex: 1; min-width: 0; }

.teacher-top { display: flex; gap: var(--size-24); margin-bottom: var(--size-36); flex-wrap: wrap; }
.teacher-search { display: flex; align-items: center; flex: 1; min-width: 220px; background: var(--bg-primary); }
.teacher-search input { flex: 1; min-width: 0; height: 3.47vw; min-height: 44px; padding: 0 var(--size-12); border: 0; background: none; }
.teacher-search .btn {
  width: 3.47vw; min-width: 44px; height: 3.47vw; min-height: 44px; display: flex; align-items: center;
  justify-content: center; background: var(--color-primary); color: #fff;
}
.teacher-top select { height: 3.47vw; min-height: 44px; padding: 0 var(--size-12); border: 0; background: var(--bg-primary); color: var(--color-text-secondary); min-width: 200px; }

.teacher-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--size-20); }
.teacher-item { display: flex; background: var(--bg-third); transition: all .3s ease-in-out; height: 100%; }
.teacher-item:hover { background: #fff; box-shadow: 0 10px 20px rgba(0,0,0,.1); }
.left-img { width: 10.83vw; min-width: 150px; flex: none; }
.avatar { padding-bottom: 126.92%; }
.text-box {
  padding: var(--size-30); flex: 1; min-width: 0; display: flex; flex-direction: column;
  justify-content: space-between; border: 1px solid #E3E3E3; border-left: none;
}
.text-box .name { color: var(--color-text-primary); margin-bottom: var(--size-9); }
.teacher-item:hover .name { color: var(--color-primary); }
.text-box .title { color: var(--color-text-regular); }
.text-box .info { color: var(--color-text-secondary); margin-top: var(--size-12); }
.text-box .info span { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: var(--size-6); }
.text-box .info .iconfont { margin-right: var(--size-9); }
.empty { color: var(--color-text-regular); padding: 60px 0; text-align: center; }

@media (max-width: 991px) {
  .cat-row { flex-direction: column; gap: 0; }
  .cat-row > :deep(.secondary-menu) { width: 100%; }
}
@media (max-width: 767px) { .teacher-list { grid-template-columns: 1fr; } }
</style>
