<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { marked } from 'marked';
import AHeader from './components/AHeader.vue';
import AFooter from './components/AFooter.vue';

const props = defineProps<{ context: any }>();
const { config, article, breadcrumbs } = props.context || {};
const router = useRouter();

// 模拟产品额外数据（实际可从 article.data 中获取）
const productMeta = computed(() => ({
  price: article?.data?.price || '$99',
  originalPrice: article?.data?.originalPrice || null,
  inStock: article?.data?.inStock ?? true,
  sku: article?.data?.sku || 'SKU-001'
}));

// 从 Markdown 内容中提取结构化信息
const parsedProduct = computed(() => {
  if (!article?.content) return { title: '', description: '', features: [], bodyHtml: '' };
  
  const html = marked.parse(article.content) as string;
  
  // 简单提取：第一个 H1 作为产品名（若文章标题已存在则跳过）
  // 第一个段落作为简短描述
  // 第一个无序列表作为特性
  // 其余部分为详细描述
  
  // 这里直接使用 article.title，并从内容中提取其他部分
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const firstParagraph = tempDiv.querySelector('p');
  const description = firstParagraph?.textContent || '';
  
  const firstList = tempDiv.querySelector('ul');
  const features: string[] = [];
  if (firstList) {
    firstList.querySelectorAll('li').forEach(li => features.push(li.textContent || ''));
    firstList.remove(); // 从正文中移除，避免重复
  }
  
  // 移除已提取的元素，剩余为详细描述
  if (firstParagraph) firstParagraph.remove();
  
  const bodyHtml = tempDiv.innerHTML;
  
  return {
    title: article.title,
    description,
    features,
    bodyHtml
  };
});

// 主图：优先使用 article.thumbnail，否则尝试从内容中提取第一张图片
const mainImage = computed(() => {
  if (article?.thumbnail) return article.thumbnail;
  const match = article?.content?.match(/!\[.*?\]\((.*?)\)/);
  return match ? match[1] : '';
});
</script>

<template>
  <div class="product-root">
    <AHeader :context="context" />
    
    <main class="product-main">
      <!-- 面包屑 -->
      <div class="breadcrumbs">
        <span @click="router.push('/')">首页</span>
        <span class="sep">/</span>
        <span v-for="crumb in breadcrumbs" :key="crumb.id" @click="router.push(`/a/${crumb.slug}`)">
          {{ crumb.name }}
        </span>
        <span class="sep">/</span>
        <span class="current">{{ article?.title }}</span>
      </div>

      <!-- 产品主体：左右分栏 -->
      <div class="product-layout">
        <!-- 左侧：图片与详情 -->
        <div class="product-left">
          <div class="product-gallery">
            <img v-if="mainImage" :src="mainImage" :alt="article?.title" class="main-image" />
            <div v-else class="image-placeholder">✦ 产品主图 ✦</div>
          </div>

          <div class="product-description">
            <h2>产品详情</h2>
            <div class="rich-content" v-html="parsedProduct.bodyHtml"></div>
          </div>
        </div>

        <!-- 右侧：购买信息卡 (sticky) -->
        <aside class="product-right">
          <div class="purchase-card">
            <h1 class="product-title">{{ parsedProduct.title }}</h1>
            <p class="product-short-desc">{{ parsedProduct.description }}</p>
            
            <div class="product-price">
              <span class="current-price">{{ productMeta.price }}</span>
              <span v-if="productMeta.originalPrice" class="original-price">{{ productMeta.originalPrice }}</span>
            </div>

            <div v-if="parsedProduct.features.length" class="feature-list">
              <h3>主要特性</h3>
              <ul>
                <li v-for="(feat, idx) in parsedProduct.features" :key="idx">
                  <span class="feature-marker">◆</span> {{ feat }}
                </li>
              </ul>
            </div>

            <div class="stock-info" :class="{ 'out-of-stock': !productMeta.inStock }">
              {{ productMeta.inStock ? '✦ 有货' : '✕ 暂时缺货' }}
            </div>

            <button class="buy-button" :disabled="!productMeta.inStock">
              {{ productMeta.inStock ? '立即购买' : '到货通知' }}
            </button>

            <p class="sku-info">SKU: {{ productMeta.sku }}</p>
          </div>
        </aside>
      </div>
    </main>

    <AFooter :context="context" />
  </div>
</template>

<style>
/* 复用全局变量，与主题一致 */
.product-root {
  --bg-page: #F4F1EA;
  --surface: #FFFFFF;
  --ink: #1C1C1C;
  --accent: #D64933;
  --border-light: #D1CCC5;
  --shadow-hard: 8px 8px 0 #1C1C1C;
  --shadow-soft: 4px 4px 0 #1C1C1C;
  
  background: var(--bg-page);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: 'Manrope', sans-serif;
  color: var(--ink);
}

.product-main {
  flex: 1;
  max-width: 1440px;
  margin: 0 auto;
  padding: 3rem 2rem 5rem;
  width: 100%;
}

/* 面包屑 */
.breadcrumbs {
  font-family: 'Space Mono', monospace;
  font-size: 0.9rem;
  margin-bottom: 3rem;
  color: var(--ink);
}
.breadcrumbs span {
  cursor: pointer;
  text-decoration: underline wavy var(--accent) 1px;
  text-underline-offset: 4px;
}
.breadcrumbs .sep {
  margin: 0 8px;
  text-decoration: none;
  cursor: default;
}
.breadcrumbs .current {
  text-decoration: none;
  font-weight: 600;
  cursor: default;
}

/* 左右布局 */
.product-layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 3rem;
  align-items: start;
}

/* 左侧 */
.product-gallery {
  border: 3px solid var(--ink);
  box-shadow: var(--shadow-hard);
  background: var(--surface);
  padding: 0.5rem;
  margin-bottom: 3rem;
}
.main-image {
  width: 100%;
  height: auto;
  display: block;
  border: 1px solid var(--border-light);
}
.image-placeholder {
  aspect-ratio: 4/3;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  font-family: 'Space Mono', monospace;
  font-size: 1.5rem;
  border: 1px dashed var(--ink);
}

.product-description h2 {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 2.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 3px solid var(--ink);
  display: inline-block;
}
.rich-content {
  font-size: 1.1rem;
  line-height: 1.6;
}
.rich-content :deep(h3) {
  font-family: 'Bricolage Grotesque', sans-serif;
  margin-top: 2rem;
}
.rich-content :deep(blockquote) {
  border-left: 8px solid var(--accent);
  background: var(--surface);
  padding: 1rem 1.5rem;
  box-shadow: var(--shadow-soft);
}

/* 右侧购买卡 */
.product-right {
  position: sticky;
  top: 100px;
}
.purchase-card {
  background: var(--surface);
  border: 3px solid var(--ink);
  box-shadow: var(--shadow-hard);
  padding: 2rem;
}

.product-title {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 2.8rem;
  line-height: 1.1;
  margin-bottom: 1rem;
}

.product-short-desc {
  font-size: 1.1rem;
  color: rgba(28,28,28,0.8);
  margin-bottom: 1.5rem;
  border-left: 6px solid var(--accent);
  padding-left: 1rem;
}

.product-price {
  margin: 1.5rem 0;
  display: flex;
  align-items: baseline;
  gap: 1rem;
}
.current-price {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 2.5rem;
  font-weight: 700;
}
.original-price {
  font-size: 1.3rem;
  text-decoration: line-through;
  color: var(--border-light);
}

.feature-list h3 {
  font-family: 'Space Mono', monospace;
  text-transform: uppercase;
  font-size: 1rem;
  margin-bottom: 1rem;
  letter-spacing: 1px;
}
.feature-list ul {
  list-style: none;
  padding: 0;
}
.feature-list li {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  font-size: 1rem;
}
.feature-marker {
  color: var(--accent);
  font-size: 1.2rem;
}

.stock-info {
  font-family: 'Space Mono', monospace;
  margin: 1.5rem 0;
  font-size: 1rem;
}
.stock-info.out-of-stock {
  color: var(--accent);
}

.buy-button {
  width: 100%;
  background: var(--ink);
  color: var(--surface);
  border: 3px solid var(--ink);
  padding: 1rem;
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 1.5rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  cursor: pointer;
  box-shadow: var(--shadow-soft);
  transition: all 0.15s;
}
.buy-button:hover:not(:disabled) {
  background: var(--accent);
  border-color: var(--accent);
  box-shadow: 6px 6px 0 var(--ink);
  transform: translate(-2px, -2px);
}
.buy-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sku-info {
  margin-top: 1rem;
  font-family: 'Space Mono', monospace;
  font-size: 0.8rem;
  text-align: right;
  color: var(--border-light);
}

/* 响应式 */
@media (max-width: 900px) {
  .product-layout {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  .product-right {
    position: static;
  }
}

@media (max-width: 600px) {
  .product-main { padding: 2rem 1rem; }
  .product-title { font-size: 2rem; }
  .current-price { font-size: 2rem; }
}
</style>