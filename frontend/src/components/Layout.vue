<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { LucideLogOut, LucideSettings, LucideFileText, LucideLayoutDashboard, LucideServer, LucideGlobe } from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();

const menuGroups = [
  {
    title: 'system.dashboard',
    items: [
      { label: 'system.dashboard', path: '/admin', icon: LucideLayoutDashboard }
    ]
  },
  {
    title: 'system.content',
    items: [
      { label: 'system.articles', path: '/admin/articles', icon: LucideFileText }
    ]
  },
  {
    title: 'system.systemProps',
    items: [
      { label: 'system.schemas', path: '/admin/schemas', icon: LucideServer },
      { label: 'system.settings', path: '/admin/settings', icon: LucideSettings },
    ]
  }
];

const logout = () => {
  localStorage.removeItem('user');
  router.push('/login');
};

const isCurrentPath = (path: string) => {
  if (path === '/admin') return route.path === '/admin' || route.path === '/admin/';
  return route.path.startsWith(path);
};
</script>

<template>
  <div class="h-screen w-full flex bg-[#ffffff] text-apple-text-dark font-text text-[14px]">
    
    <!-- Sidebar WordPress / Apple style -->
    <aside class="w-[260px] bg-[#f5f5f7] border-r border-[#e5e5e5] flex flex-col h-full shrink-0">
      <div class="px-6 py-6 border-b border-[#e5e5e5] border-opacity-60 flex items-center justify-between">
        <span class="font-display font-semibold text-[18px] flex items-center gap-2 cursor-pointer" @click="router.push('/admin')">
          <LucideSettings :size="20"/> {{ $t('system.title') }}
        </span>
      </div>
      
      <div class="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-6">
        <div v-for="(group, idx) in menuGroups" :key="idx" class="flex flex-col gap-1">
          <div class="text-[12px] font-semibold text-[rgba(0,0,0,0.48)] uppercase tracking-wider mb-2 px-2">{{ $t(group.title) }}</div>
          <button 
            v-for="item in group.items" :key="item.path"
            @click="router.push(item.path)"
            class="flex items-center gap-3 px-3 py-2 rounded-[8px] transition-colors w-full text-left"
            :class="isCurrentPath(item.path) ? 'bg-[rgba(0,0,0,0.08)] text-black font-semibold' : 'text-[rgba(0,0,0,0.8)] hover:bg-[rgba(0,0,0,0.04)]'"
          >
            <component :is="item.icon" :size="18" :class="{'opacity-70': !isCurrentPath(item.path)}" />
            {{ $t(item.label) }}
          </button>
        </div>
      </div>

      <div class="p-4 border-t border-[#e5e5e5] border-opacity-60 flex flex-col gap-1">
        <button @click="router.push('/')" class="flex items-center gap-3 w-full text-left px-3 py-2 text-[rgba(0,0,0,0.8)] hover:bg-[rgba(0,0,0,0.04)] rounded-[8px] transition-colors">
            <LucideGlobe :size="18" class="opacity-70" /> Visit Site
        </button>  
        <button @click="logout" class="flex items-center gap-3 w-full text-left px-3 py-2 text-[rgba(0,0,0,0.8)] hover:bg-[rgba(0,0,0,0.04)] rounded-[8px] transition-colors">
            <LucideLogOut :size="18" class="opacity-70" /> {{ $t('auth.logout') }}
        </button>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="flex-1 h-full overflow-y-auto bg-white">
      <router-view></router-view>
    </main>
    
  </div>
</template>
