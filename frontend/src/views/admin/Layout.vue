<script setup lang="ts">

import { computed, ref, watch } from 'vue';
import Button from 'primevue/button';
import { useRouter, useRoute } from 'vue-router';
import { LucideLogOut, LucideSettings, LucideFileText, LucideLayoutDashboard, LucideServer, LucideGlobe, LucideMenu, LucideUsers, LucideImage, LucideShieldCheck, LucideX } from 'lucide-vue-next';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '../../stores/auth';
import { authAPI } from '../../api';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const authStore = useAuthStore();
const isSuperAdmin = authStore.isSuperAdmin;
const sidebarVisible = ref(false);

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
      { label: 'system.roles', path: '/admin/roles', icon: LucideShieldCheck, requiresSuperAdmin: true },
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

const logout = async () => {
  try {
    await authAPI.logout();
  } catch {}
  authStore.clearUser();
  toast.add({ severity: 'success', summary: 'Success', detail: '退出登录成功', life: 3000 });
  router.push('/login');
};

const isCurrentPath = (path: string) => {
  if (path === '/admin') return route.path === '/admin' || route.path === '/admin/';
  return route.path.startsWith(path);
};

const navigateTo = (path: string) => {
  router.push(path);
  sidebarVisible.value = false;
};

// Close sidebar on route change (for mobile)
watch(() => route.path, () => {
  sidebarVisible.value = false;
});
</script>

<template>
  <div class="h-screen w-full flex flex-col md:flex-row bg-[#ffffff] text-apple-text-dark font-text text-[14px]">
    
    <!-- Mobile Header Bar -->
    <header class="md:hidden h-[48px] bg-[rgba(0,0,0,0.8)] backdrop-blur-[20px] flex items-center justify-between px-4 shrink-0 z-30" style="-webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px);">
      <span class="font-display font-semibold text-[17px] text-white flex items-center gap-2 cursor-pointer" @click="router.push('/admin')">
        <LucideSettings :size="18" /> {{ $t('system.title') }}
      </span>
      <Button unstyled @click="sidebarVisible = !sidebarVisible" class="w-10 h-10 flex items-center justify-center text-white rounded-[8px] hover:bg-[rgba(255,255,255,0.1)] transition-colors cursor-pointer">
        <LucideMenu v-if="!sidebarVisible" :size="22" />
        <LucideX v-else :size="22" />
      </Button>
    </header>

    <!-- Mobile Backdrop -->
    <Transition name="fade">
      <div 
        v-if="sidebarVisible" 
        class="md:hidden fixed inset-0 bg-[rgba(0,0,0,0.5)] z-30 top-[48px]"
        @click="sidebarVisible = false"
      ></div>
    </Transition>

    <!-- Sidebar -->
    <aside 
      class="w-[260px] bg-[#f5f5f7] border-r border-[#e5e5e5] flex flex-col h-[calc(100vh-48px)] md:h-full shrink-0
             fixed md:relative top-[48px] md:top-0 left-0 z-40 md:z-auto
             transform transition-transform duration-300 ease-in-out
             -translate-x-full md:translate-x-0"
      :class="{ 'translate-x-0': sidebarVisible }"
    >
      <!-- Sidebar Header (desktop only, mobile has its own header) -->
      <div class="hidden md:flex px-6 py-6 border-b border-[#e5e5e5] border-opacity-60 items-center justify-between">
        <span class="font-display font-semibold text-[18px] flex items-center gap-2 cursor-pointer" @click="router.push('/admin')">
          <LucideSettings :size="20"/> {{ $t('system.title') }}
        </span>
      </div>
      
      <!-- Mobile sidebar header -->
      <div class="md:hidden px-6 py-5 border-b border-[#e5e5e5] border-opacity-60">
        <span class="font-display font-semibold text-[17px] flex items-center gap-2 text-[#1d1d1f]">
          {{ $t('system.title') }}
        </span>
      </div>

      <div class="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-6">
        <div v-for="(group, idx) in menuGroups" :key="idx" class="flex flex-col gap-1">
          <div class="text-[12px] font-semibold text-[rgba(0,0,0,0.48)] uppercase tracking-wider mb-2 px-2">{{ $t(group.title) }}</div>
          <Button unstyled 
            v-for="item in group.items" :key="item.path"
            @click="navigateTo(item.path)"
            class="flex items-center gap-3 px-3 py-2 rounded-[8px] transition-colors w-full text-left"
            :class="isCurrentPath(item.path) ? 'bg-[rgba(0,0,0,0.08)] text-black font-semibold' : 'text-[rgba(0,0,0,0.8)] hover:bg-[rgba(0,0,0,0.04)]'"
          >
            <component :is="item.icon" :size="18" :class="{'opacity-70': !isCurrentPath(item.path)}" />
            {{ $t(item.label) }}
          </Button>
        </div>
      </div>

      <div class="p-4 border-t border-[#e5e5e5] border-opacity-60 flex flex-col gap-1">
        <Button unstyled @click="navigateTo('/')" class="flex items-center gap-3 w-full text-left px-3 py-2 text-[rgba(0,0,0,0.8)] hover:bg-[rgba(0,0,0,0.04)] rounded-[8px] transition-colors">
            <LucideGlobe :size="18" class="opacity-70" />  {{$t('system.visitSite')}}
        </Button>  
        <Button unstyled @click="logout" class="flex items-center gap-3 w-full text-left px-3 py-2 text-[rgba(0,0,0,0.8)] hover:bg-[rgba(0,0,0,0.04)] rounded-[8px] transition-colors">
            <LucideLogOut :size="18" class="opacity-70" /> {{ $t('auth.logout') }}
        </Button>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="flex-1 h-full overflow-y-auto bg-white md:h-screen h-[calc(100vh-48px)]">
      <router-view></router-view>
    </main>
    
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
