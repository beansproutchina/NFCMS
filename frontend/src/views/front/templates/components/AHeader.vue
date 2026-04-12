<template>
    <header class="uni-header">
        <div class="header-top">
            <div class="container">
                <div class="logo">{{ config?.site_name || '中国大学网络系统' }}</div>
                <div class="top-links">
                    <div class="search-box">
                        <input type="text" placeholder="请输入关键词..." />
                        <button>搜索</button>
                    </div>
                </div>
            </div>
        </div>
        <nav class="uni-nav">
            <div class="container">
                <ul class="nav-list">
                    <!-- 动态读取上下文中的 menus 下 location为header或默认的菜单 -->
                    <li v-for="(item, index) in filteredMenus" :key="index" class="nav-item">
                        <a :href="item.url">{{ item.label }}</a>
                        <ul class="sub-nav" v-if="item.children && item.children.length > 0">
                            <li v-for="(child, cIndex) in item.children" :key="cIndex">
                                <a :href="child.url">{{ child.label }}</a>
                            </li>
                        </ul>
                    </li>
                </ul>

            </div>
        </nav>
    </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ context: any }>();
const { config, menus } = props.context || {};

// 提取头部导航菜单，如果没有特定 location，则兜底使用整个 menus 数组
const filteredMenus = computed(() => {
    if (!menus) return [];
    const headerMenu = menus.find((m: any) => m.location === 'header');
    return headerMenu ? headerMenu.items : menus;
});
</script>

<style scoped>
.uni-header {
    background: #fff;
}

.header-top {
    padding: 24px 0;
    background-color: #f8f9fa;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.logo {
    font-size: 32px;
    font-weight: 600;
    color: var(--uni-primary, #8B0000);
    letter-spacing: 2px;
    font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
}

.top-links a {
    font-size: 14px;
    color: #666;
    text-decoration: none;
    margin: 0 10px;
}

.top-links a:hover {
    color: var(--uni-primary, #8B0000);
}

.uni-nav {
    background-color: var(--uni-primary, #8B0000);
}

.uni-nav .container {
    justify-content: space-between;
}

.nav-list {
    display: flex;
    flex: 1;
    justify-content: center;
    /* 居中显示菜单项 */
    list-style: none;
    margin: 0;
    padding: 0;
}

.nav-item {
    position: relative;
    width: 120px;
    text-align: center;
}

.nav-list li a {
    display: block;
    padding: 16px 24px;
    color: #fff;
    text-decoration: none;
    font-size: 16px;
    transition: background 0.3s;
}

.nav-list>li>a:hover {
    background-color: var(--uni-primary-dark, #5C0000);
}

/* 二级下拉菜单 */
.sub-nav {
    visibility: hidden;
    opacity: 0;
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%) translateY(10px);
    transition: all 0.3s ease;
    background-color: var(--uni-primary-dark, #5C0000);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    list-style: none;
    padding: 0;
    margin: 0;
    min-width: 140px;
    z-index: 100;
}

.nav-item:hover .sub-nav {
    visibility: visible;
    opacity: 1;
    transform: translateX(-50%) translateY(0);
}

.sub-nav li a {
    padding: 12px 20px;
    font-size: 14px;
    text-align: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    white-space: nowrap;
}

.sub-nav li:last-child a {
    border-bottom: none;
}

.sub-nav li a:hover {
    background-color: rgba(255, 255, 255, 0.1);
}

.search-box {
    display: flex;
    align-items: center;
}

.search-box input {
    padding: 6px 12px;
    border: 1px solid #ccc;
    outline: none;
    border-radius: 2px 0 0 2px;
    font-size: 14px;
}

.search-box button {
    padding: 6px 16px;
    border: none;
    background: var(--uni-primary-dark, #5C0000);
    color: #fff;
    cursor: pointer;
    border-radius: 0 2px 2px 0;
}
</style>
