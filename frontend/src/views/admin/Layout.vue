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
const sidebarVisible = ref(false);

// Nav visibility is driven by RBAC capabilities (from loginInfo). Content items use `can(model,action)`;
// taxonomy/menu/system-admin items are super_admin-only (they are publicly-readable or system tables
// managed exclusively by super_admin).
const rawMenuGroups = [
  {
    title: 'system.dashboard',
    items: [
      { label: 'system.dashboard', path: '/admin', icon: LucideLayoutDashboard, show: () => true }
    ]
  },
  {
    title: 'system.content',
    items: [
      { label: 'system.articles', path: '/admin/articles', icon: LucideFileText, show: () => authStore.can('articles', 'R') },
      { label: 'system.files', path: '/admin/files', icon: LucideImage, show: () => authStore.can('attachments', 'R') },
      { label: 'system.categories', path: '/admin/categories', icon: LucideServer, show: () => authStore.isSuperAdmin },
      { label: 'system.menus', path: '/admin/menus', icon: LucideMenu, show: () => authStore.isSuperAdmin }
    ]
  },
  {
    title: 'system.systemProps',
    items: [
      { label: 'system.users', path: '/admin/users', icon: LucideUsers, show: () => authStore.isSuperAdmin },
      { label: 'system.roles', path: '/admin/roles', icon: LucideShieldCheck, show: () => authStore.isSuperAdmin },
      { label: 'system.settings', path: '/admin/settings', icon: LucideSettings, show: () => authStore.isSuperAdmin },
    ]
  }
];

const menuGroups = computed(() => {
  return rawMenuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => item.show())
  })).filter(group => group.items.length > 0);
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
  <div class="h-screen w-full flex flex-col md:flex-row bg-white text-label font-text text-body">
    
    <!-- Mobile Header Bar -->
    <header class="md:hidden h-[48px] bg-chrome backdrop-blur-[20px] flex items-center justify-between px-4 shrink-0 z-30" style="-webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px);">
      <span class="font-display font-semibold text-title-item text-white flex items-center gap-2 cursor-pointer" @click="router.push('/admin')">
        <LucideSettings :size="18" /> {{ $t('system.title') }}
      </span>
      <Button unstyled @click="sidebarVisible = !sidebarVisible" class="w-10 h-10 flex items-center justify-center text-white rounded-control hover:bg-[rgba(255,255,255,0.1)] transition-colors cursor-pointer">
        <LucideMenu v-if="!sidebarVisible" :size="22" />
        <LucideX v-else :size="22" />
      </Button>
    </header>

    <!-- Mobile Backdrop -->
    <Transition name="fade">
      <div 
        v-if="sidebarVisible" 
        class="md:hidden fixed inset-0 bg-scrim z-30 top-[48px]"
        @click="sidebarVisible = false"
      ></div>
    </Transition>

    <!-- Sidebar -->
    <aside 
      class="w-[260px] bg-canvas border-r border-divider flex flex-col h-[calc(100vh-48px)] md:h-full shrink-0
             fixed md:relative top-[48px] md:top-0 left-0 z-40 md:z-auto
             transform transition-transform duration-300 ease-in-out
             -translate-x-full md:translate-x-0"
      :class="{ 'translate-x-0': sidebarVisible }"
    >
      <!-- Sidebar Header (desktop only, mobile has its own header) -->
      <div class="hidden md:flex px-6 py-6 border-b border-divider border-opacity-60 items-center justify-between">
        <span class="font-display font-semibold text-title-section flex items-center gap-2 cursor-pointer" @click="router.push('/admin')">
          <LucideSettings :size="20"/> {{ $t('system.title') }}
        </span>
      </div>
      
      <!-- Mobile sidebar header -->
      <div class="md:hidden px-6 py-5 border-b border-divider border-opacity-60">
        <span class="font-display font-semibold text-title-item flex items-center gap-2 text-label">
          {{ $t('system.title') }}
        </span>
      </div>

      <div class="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-6">
        <div v-for="(group, idx) in menuGroups" :key="idx" class="flex flex-col gap-1">
          <div class="text-small font-semibold text-label-3 uppercase tracking-wider mb-2 px-2">{{ $t(group.title) }}</div>
          <Button unstyled 
            v-for="item in group.items" :key="item.path"
            @click="navigateTo(item.path)"
            class="flex items-center gap-3 px-3 py-2 rounded-control transition-colors w-full text-left"
            :class="isCurrentPath(item.path) ? 'bg-fill-strong text-black font-semibold' : 'text-label hover:bg-fill'"
          >
            <component :is="item.icon" :size="18" :class="{'opacity-70': !isCurrentPath(item.path)}" />
            {{ $t(item.label) }}
          </Button>
        </div>
      </div>

      <div class="p-4 border-t border-divider border-opacity-60 flex flex-col gap-1">
        <Button unstyled @click="navigateTo('/')" class="flex items-center gap-3 w-full text-left px-3 py-2 text-label hover:bg-fill rounded-control transition-colors">
            <LucideGlobe :size="18" class="opacity-70" />  {{$t('system.visitSite')}}
        </Button>  
        <Button unstyled @click="logout" class="flex items-center gap-3 w-full text-left px-3 py-2 text-label hover:bg-fill rounded-control transition-colors">
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
