<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { systemAPI } from '../../api';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Password from 'primevue/password';
import { LucideUpload, LucideFileText, LucideX } from 'lucide-vue-next';

const router = useRouter();
const siteName = ref('');
const adminUsername = ref('');
const adminPassword = ref('');
const error = ref('');
const loading = ref(false);

// Import state
const importMode = ref(false);
const importFile = ref<File | null>(null);
const importFileData = ref<any>(null);
const importFileName = computed(() => importFile.value?.name || '');
// Real hidden <input> in the template (see ref). A detached createElement('input') can have its
// change event dropped by the browser (GC'd before firing) — hence "no reaction on select".
const fileInput = ref<HTMLInputElement | null>(null);

const handleFileSelect = () => {
  fileInput.value?.click();
};

const onFileChange = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  // Reset so picking the SAME file again still fires change next time.
  input.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data._meta || data._meta.generator !== 'NFCMS') {
      error.value = '无效的导入文件格式（非 NFCMS 导出文件）';
      return;
    }
    importFile.value = file;
    importFileData.value = data;
    error.value = '';
  } catch (err: any) {
    error.value = '文件解析失败：' + (err.message || '未知错误');
  }
};

const clearImportFile = () => {
  importFile.value = null;
  importFileData.value = null;
  if (fileInput.value) fileInput.value.value = '';
};

const performSetup = async () => {
  if (importMode.value) {
    if (!importFileData.value) {
      error.value = '请选择要导入的数据文件。';
      return;
    }
    loading.value = true;
    error.value = '';
    try {
      await systemAPI.setup({ importData: importFileData.value });
      router.push('/login');
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message || '导入失败';
    } finally {
      loading.value = false;
    }
    return;
  }

  if (!siteName.value || !adminUsername.value || !adminPassword.value) {
    error.value = "All fields are required.";
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    await systemAPI.setup({
      siteName: siteName.value,
      adminUsername: adminUsername.value,
      adminPassword: adminPassword.value
    });
    router.push('/login');
  } catch (err: any) {
    error.value = err.response?.data?.message || err.message;
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="h-screen w-full flex flex-col justify-center items-center bg-canvas text-label">
    <div class="max-w-md w-full px-6">
      <div class="text-center mb-10">
        <h1 class="text-[56px] leading-[1.07] font-semibold tracking-[-0.28px] mb-2">NFCMS</h1>
        <p class="text-[21px] leading-[1.19] opacity-60 font-normal tracking-[0.231px]">Configure your new site.</p>
      </div>

      <div class="bg-white p-8 rounded-2xl shadow-xl flex flex-col gap-6">
        <!-- Mode Toggle -->
        <div class="flex rounded-control overflow-hidden border border-[rgba(0,0,0,0.1)]">
          <Button
            @click="importMode = false; clearImportFile()"
            unstyled
            :class="[
              'flex-1 py-2.5 text-body font-medium transition-colors cursor-pointer',
              !importMode ? 'bg-accent text-white' : 'bg-white text-label-2 hover:bg-canvas'
            ]"
          >新建站点</Button>
          <Button
            @click="importMode = true"
            unstyled
            :class="[
              'flex-1 py-2.5 text-body font-medium transition-colors cursor-pointer',
              importMode ? 'bg-accent text-white' : 'bg-white text-label-2 hover:bg-canvas'
            ]"
          >导入数据</Button>
        </div>

        <!-- New Site Mode -->
        <template v-if="!importMode">
          <div class="flex flex-col gap-2">
            <label class="text-body text-[rgba(0,0,0,0.8)] px-1 font-medium">Site Name</label>
            <InputText v-model="siteName" unstyled
              class="w-full bg-canvas text-label border border-transparent rounded-control py-4 px-4 text-title-item focus:outline-none focus:border-accent focus:bg-white focus:ring-1 focus:ring-accent transition-all"
              placeholder="My Awesome Website" />
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-body text-[rgba(0,0,0,0.8)] px-1 font-medium">Admin Username</label>
            <InputText v-model="adminUsername" unstyled
              class="w-full bg-canvas text-label border border-transparent rounded-control py-4 px-4 text-title-item focus:outline-none focus:border-accent focus:bg-white focus:ring-1 focus:ring-accent transition-all"
              placeholder="admin" autocomplete="username" />
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-body text-[rgba(0,0,0,0.8)] px-1 font-medium">Admin Password</label>
            <Password v-model="adminPassword" unstyled :feedback="false" toggleMask fluid
              :inputProps="{ class: 'w-full bg-canvas text-label border border-transparent rounded-control py-4 px-4 text-title-item focus:outline-none focus:border-accent focus:bg-white focus:ring-1 focus:ring-accent transition-all relative', placeholder: '••••••••', autocomplete: 'new-password' }"
              :pt="{ root: 'relative w-full', maskIcon: 'absolute right-4 top-1/2 -translate-y-1/2 opacity-50 cursor-pointer w-5 h-5', unmaskIcon: 'absolute right-4 top-1/2 -translate-y-1/2 opacity-50 cursor-pointer w-5 h-5' }" />
          </div>
        </template>

        <!-- Import Mode -->
        <template v-else>
          <p class="text-body text-label-2">选择之前导出的 NFCMS 数据文件，系统将从中恢复所有数据。</p>

          <div v-if="importFileName" class="flex items-center gap-3 p-3 bg-[#f0f7ff] rounded-control border border-[#b3d4fc]">
            <LucideFileText :size="20" class="text-accent shrink-0" />
            <span class="text-body text-[rgba(0,0,0,0.8)] truncate flex-1">{{ importFileName }}</span>
            <button @click="clearImportFile" class="shrink-0 opacity-50 hover:opacity-100 cursor-pointer">
              <LucideX :size="16" />
            </button>
          </div>

          <input ref="fileInput" type="file" accept=".json,application/json" class="hidden" @change="onFileChange" />
          <button @click="handleFileSelect" type="button" unstyled
            class="w-full border-2 border-dashed border-[rgba(0,0,0,0.15)] rounded-control py-6 flex flex-col items-center justify-center gap-2 text-[rgba(0,0,0,0.5)] hover:border-accent hover:text-accent transition-colors cursor-pointer bg-transparent">
            <LucideUpload :size="24" />
            <span class="text-body font-medium">选择导出文件 (.json)</span>
          </button>
        </template>

        <div v-if="error" class="text-red-500 text-body text-center">{{ error }}</div>

        <Button :loading="loading" @click="performSetup" unstyled
          class="mt-4 bg-accent hover:bg-link text-white text-title-item py-[14px] rounded-control w-full font-medium transition-colors cursor-pointer flex justify-center items-center gap-2">
          {{ importMode ? '导入并初始化' : 'Complete Setup' }}
        </Button>
      </div>
    </div>
  </div>
</template>
