<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { schemaAPI, listArticle, listCategory, listUser, uploadAPI, systemAPI } from '../../api';
import { useAuthStore } from '../../stores/auth';
import { 
  LucideFileText, LucideFolder, LucideBox, LucideImage, 
  LucideUsers, LucideActivity, LucideShieldCheck, 
  LucideChevronRight, LucidePlusCircle 
} from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();
const user = computed(() => authStore.user);
const loading = ref(true);

const stats = ref([
  { label: 'dashboard.totalArticles', value: '...', icon: LucideFileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { label: 'dashboard.totalCategories', value: '...', icon: LucideFolder, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { label: 'dashboard.totalFiles', value: '...', icon: LucideImage, color: 'text-pink-500', bg: 'bg-pink-500/10' },
  { label: 'dashboard.totalUsers', value: '...', icon: LucideUsers, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { label: 'dashboard.schemasActive', value: '...', icon: LucideBox, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
]);

const recentArticles = ref<any[]>([]);
const systemInfo = ref<any>({});

const canArticles = authStore.can('articles', 'R');
const canFiles = authStore.can('attachments', 'R');
const isSuper = computed(() => authStore.isSuperAdmin);

onMounted(async () => {
  try {
    // Only fetch what the current user is allowed to read (avoids 403 toast spam).
    const skip = Promise.resolve(null);
    const [schemasRes, articlesRes, categoriesRes, filesRes, usersRes, statusRes] = await Promise.allSettled([
      isSuper.value ? schemaAPI.getAll() : skip,
      canArticles ? listArticle({ orderBy: 'id', orderDesc: true, limit: 5 }) : skip,
      listCategory(),
      canFiles ? uploadAPI.getList() : skip,
      isSuper.value ? listUser() : skip,
      systemAPI.getStatus()
    ]);
    
    // Counts come from the paginated envelope's `total` (the full row count), NOT data.length —
    // data.length is capped by the page limit (articles fetch limit:5; the rest default to maxLimit=100),
    // so reading .length would under-report. schemas is a non-paginated array, so it uses data.length.
    const val = <T>(r: PromiseSettledResult<T | null>): T | null => (r.status === 'fulfilled' ? r.value : null);

    const articles = val(articlesRes);
    const aCount = articles?.total ?? 0;
    recentArticles.value = (articles?.data ?? []).slice(0, 5);

    const cCount = val(categoriesRes)?.total ?? 0;
    const fCount = val(filesRes)?.total ?? 0;
    const uCount = val(usersRes)?.total ?? 0;
    const sCount = val(schemasRes)?.data?.length ?? 0;

    systemInfo.value = val(statusRes)?.data ?? null;

    stats.value[0].value = aCount.toString();
    stats.value[1].value = cCount.toString();
    stats.value[2].value = fCount.toString();
    stats.value[3].value = uCount.toString();
    stats.value[4].value = sCount.toString();

  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
});

const formatDate = (dateString: string) => {
    if(!dateString) return '-';
    const d = new Date(dateString);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
</script>

<template>
    <div class="max-w-7xl mx-auto py-10 w-full px-6">
      <h1 class="text-[40px] font-semibold leading-[1.1] tracking-tight mb-2">{{ $t('dashboard.welcome') }}, {{ user?.username || 'Admin' }}</h1>
      <p class="text-[21px] text-[rgba(0,0,0,0.8)] font-normal leading-[1.19] mb-12">{{ $t('dashboard.overviewPrefix') }}</p>
      
      <div v-if="loading" class="opacity-50 flex items-center gap-2 mb-10"><LucideActivity class="animate-spin" :size="20" /> {{ $t('system.loading') }}</div>
      
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-10">
        <div v-for="stat in stats" :key="stat.label" class="bg-white rounded-[16px] p-6 shadow-[0px_5px_30px_rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.04)] flex flex-col hover:-translate-y-1 transition-transform duration-300">
          <div class="flex items-center justify-between mb-4">
              <div :class="['w-10 h-10 rounded-full flex items-center justify-center', stat.bg, stat.color]">
                  <component :is="stat.icon" :size="20" />
              </div>
          </div>
          <p class="text-[32px] font-semibold leading-[1.1] tracking-[-0.01em] mb-1">{{ stat.value }}</p>
          <h3 class="text-[14px] font-medium text-[rgba(0,0,0,0.5)]">{{ $t(stat.label) }}</h3>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div class="lg:col-span-2 bg-white rounded-[16px] shadow-[0px_5px_30px_rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
              <div class="p-6 border-b border-[rgba(0,0,0,0.05)] flex justify-between items-center bg-[#fbfbfd]">
                  <h2 class="text-[19px] font-semibold flex items-center gap-2 text-[rgba(0,0,0,0.9)]"><LucideFileText :size="20" class="text-apple-blue" /> {{ $t('dashboard.recentArticles') }}</h2>
                  <button @click="router.push('/admin/articles/new')" class="text-[14px] text-apple-blue hover:underline flex items-center gap-1 bg-transparent border-0 cursor-pointer"><LucidePlusCircle :size="16"/> {{ $t('action.new') }}</button>
              </div>
              <div class="flex-1 p-0">
                  <div v-if="!recentArticles.length" class="p-8 text-center text-[14px] text-[rgba(0,0,0,0.4)]">
                      {{ $t('system.noEntries') }}
                  </div>
                  <div v-for="article in recentArticles" :key="article.id" class="px-6 py-4 flex items-center justify-between hover:bg-[#f5f5f7] transition-colors cursor-pointer border-b border-[rgba(0,0,0,0.03)] last:border-0" @click="router.push('/admin/articles/edit/'+article.id)">
                      <div class="flex-1 min-w-0 pr-4">
                          <h4 class="text-[16px] font-medium text-[rgba(0,0,0,0.9)] truncate mb-1">{{ article.title }}</h4>
                          <div class="text-[12px] text-[rgba(0,0,0,0.5)] truncate max-w-full">
                              <span v-if="article.is_top" class="text-red-500 font-semibold mr-2 border border-red-500/20 bg-red-500/10 px-1 rounded">{{ $t('form.is_top') }}</span>
                              {{ article.description || article.slug }}
                          </div>
                      </div>
                      <div class="flex flex-col items-end gap-1 flex-shrink-0">
                           <span class="text-[12px] text-[rgba(0,0,0,0.4)]">{{ formatDate(article.created_at) }}</span>
                           <span :class="['text-[11px] px-2 py-0.5 rounded-full font-medium', article.status === 'visible' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600']">{{ $t('contentStatus.' + (article.status || 'hidden')) }}</span>
                      </div>
                  </div>
              </div>
              <div class="p-3 bg-[#fbfbfd] border-t border-[rgba(0,0,0,0.05)] text-center">
                  <button @click="router.push('/admin/articles')" class="text-[14px] text-apple-blue hover:underline flex items-center justify-center gap-1 w-full py-1 bg-transparent border-0 cursor-pointer">View All <LucideChevronRight :size="16"/></button>
              </div>
          </div>

          <div class="flex flex-col gap-6">
              <!-- System Status -->
              <div class="bg-white rounded-[16px] shadow-[0px_5px_30px_rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.04)] p-6 flex flex-col gap-5">
                  <h2 class="text-[19px] font-semibold flex items-center gap-2 text-[rgba(0,0,0,0.9)]"><LucideShieldCheck :size="20" class="text-emerald-500" /> {{ $t('dashboard.systemStatus') }}</h2>
                  <div class="flex flex-col gap-4 mt-2">
                      <div class="flex justify-between items-center text-[14px]">
                          <span class="text-[rgba(0,0,0,0.6)]">Platform Core</span>
                          <span class="font-medium text-[rgba(0,0,0,0.9)] bg-[#f5f5f7] px-2 py-0.5 rounded">NFCMS Engine</span>
                      </div>
                      <div class="flex justify-between items-center text-[14px]">
                          <span class="text-[rgba(0,0,0,0.6)]">Active DB Node</span>
                          <span class="flex items-center gap-1.5 font-medium text-[rgba(0,0,0,0.9)] text-[13px]"><div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Connected</span>
                      </div>
                      <div class="flex justify-between items-center text-[14px]">
                          <span class="text-[rgba(0,0,0,0.6)]">Sys Config</span>
                          <span class="flex items-center gap-1.5 font-medium text-[rgba(0,0,0,0.9)] text-[13px]"><div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Complete</span>
                      </div>
                  </div>
              </div>

              <!-- Quick Actions -->
              <div class="bg-white rounded-[16px] shadow-[0px_5px_30px_rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.04)] p-6 flex-1">
                  <h2 class="text-[19px] font-semibold flex items-center gap-2 mb-6 text-[rgba(0,0,0,0.9)]"><LucideActivity :size="20" class="text-indigo-500" /> {{ $t('dashboard.quickActions') }}</h2>
                  <div class="grid grid-cols-2 gap-3">
                      <button v-if="isSuper" @click="router.push('/admin/categories')" class="flex flex-col items-center justify-center gap-2 p-4 rounded-[12px] bg-[#f5f5f7] hover:bg-[#e8e8ed] transition-colors text-[rgba(0,0,0,0.8)] border-0 cursor-pointer">
                          <LucideFolder :size="24" class="text-amber-500"/>
                          <span class="text-[13px] font-medium">{{ $t('system.categories') }}</span>
                      </button>
                      <button v-if="isSuper" @click="router.push('/admin/menus')" class="flex flex-col items-center justify-center gap-2 p-4 rounded-[12px] bg-[#f5f5f7] hover:bg-[#e8e8ed] transition-colors text-[rgba(0,0,0,0.8)] border-0 cursor-pointer">
                          <LucideBox :size="24" class="text-purple-500"/>
                          <span class="text-[13px] font-medium">{{ $t('system.menus') }}</span>
                      </button>
                      <button v-if="canFiles" @click="router.push('/admin/files')" class="flex flex-col items-center justify-center gap-2 p-4 rounded-[12px] bg-[#f5f5f7] hover:bg-[#e8e8ed] transition-colors text-[rgba(0,0,0,0.8)] border-0 cursor-pointer">
                          <LucideImage :size="24" class="text-pink-500"/>
                          <span class="text-[13px] font-medium">{{ $t('system.files') }}</span>
                      </button>
                      <button v-if="isSuper" @click="router.push('/admin/settings')" class="flex flex-col items-center justify-center gap-2 p-4 rounded-[12px] bg-[#f5f5f7] hover:bg-[#e8e8ed] transition-colors text-[rgba(0,0,0,0.8)] border-0 cursor-pointer">
                          <LucideShieldCheck :size="24" class="text-slate-500"/>
                          <span class="text-[13px] font-medium">{{ $t('system.settings') }}</span>
                      </button>
                  </div>
              </div>

          </div>
      </div>
    </div>
</template>
