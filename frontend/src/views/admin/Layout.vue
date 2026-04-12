<script setup lang="ts">

import { computed } from 'vue';
import Button from 'primevue/button';
import { useRouter, useRoute } from 'vue-router';
import { LucideLogOut, LucideSettings, LucideFileText, LucideLayoutDashboard, LucideServer, LucideGlobe, LucideMenu, LucideUsers, LucideImage } from 'lucide-vue-next';
import { useToast } from 'primevue/usetoast';

const router = useRouter();
const route = useRoute();
const toast = useToast();

const userRaw = localStorage.getItem('user');
const user = userRaw ? JSON.parse(userRaw) : { role: 'admin' };
const isSuperAdmin = user.role === 'super_admin' || user.role === 'superadmin';

const rawMenuGroups = [
  {
    title: 'system.dashboard',
    items: [
      { label: 'system.dashboard', path: '/admin', icon: LucideLayoutDashboard, requiresSuperAdmin: false }
    ]
  },
  {
    title: 'system.content',
    items: [
      { label: 'system.articles', path: '/admin/articles', icon: LucideFileText, requiresSuperAdmin: false },
      { label: 'system.files', path: '/admin/files', icon: LucideImage, requiresSuperAdmin: false },
      { label: 'system.categories', path: '/admin/categories', icon: LucideServer, requiresSuperAdmin: true },
      { label: 'system.menus', path: '/admin/menus', icon: LucideMenu, requiresSuperAdmin: true }
    ]
  },
  {
    title: 'system.systemProps',
    items: [
      { label: 'system.users', path: '/admin/users', icon: LucideUsers, requiresSuperAdmin: true },
      //{ label: 'system.schemas', path: '/admin/schemas', icon: LucideServer, requiresSuperAdmin: true },
      { label: 'system.settings', path: '/admin/settings', icon: LucideSettings, requiresSuperAdmin: true },
    ]
  }
];

const menuGroups = computed(() => {
  return rawMenuGroups.map(group => {
    return {
      ...group,
      items: group.items.filter(item => !item.requiresSuperAdmin || isSuperAdmin)
    };
  }).filter(group => group.items.length > 0);
});

const logout = () => {
  localStorage.removeItem('user');
  toast.add({ severity: 'success', summary: 'Success', detail: '退出登录成功', life: 3000 });
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
          <Button unstyled 
            v-for="item in group.items" :key="item.path"
            @click="router.push(item.path)"
            class="flex items-center gap-3 px-3 py-2 rounded-[8px] transition-colors w-full text-left"
            :class="isCurrentPath(item.path) ? 'bg-[rgba(0,0,0,0.08)] text-black font-semibold' : 'text-[rgba(0,0,0,0.8)] hover:bg-[rgba(0,0,0,0.04)]'"
          >
            <component :is="item.icon" :size="18" :class="{'opacity-70': !isCurrentPath(item.path)}" />
            {{ $t(item.label) }}
          </Button>
        </div>
      </div>

      <div class="p-4 border-t border-[#e5e5e5] border-opacity-60 flex flex-col gap-1">
        <Button unstyled @click="router.push('/')" class="flex items-center gap-3 w-full text-left px-3 py-2 text-[rgba(0,0,0,0.8)] hover:bg-[rgba(0,0,0,0.04)] rounded-[8px] transition-colors">
            <LucideGlobe :size="18" class="opacity-70" />  {{$t('system.visitSite')}}
        </Button>  
        <Button unstyled @click="logout" class="flex items-center gap-3 w-full text-left px-3 py-2 text-[rgba(0,0,0,0.8)] hover:bg-[rgba(0,0,0,0.04)] rounded-[8px] transition-colors">
            <LucideLogOut :size="18" class="opacity-70" /> {{ $t('auth.logout') }}
        </Button>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="flex-1 h-full overflow-y-auto bg-white">
      <router-view></router-view>
    </main>
    
  </div>
</template>
