<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { BTN, BTN_LG, BTN_REMOVE, FIELD_GROUP, INPUT_CLASS_LG, LABEL_BARE, MESSAGE_PT, PASSWORD_LG, SEGMENT, TEXT } from '../../ui/presets';
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { systemAPI } from '../../api';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Password from 'primevue/password';
import Message from 'primevue/message';
import { LucideUpload, LucideFileText, LucideX, LucideTriangleAlert, LucideInfo, LucideCopy } from 'lucide-vue-next';
const { t } = useI18n();

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
      error.value = t('setup.invalidFile');
      return;
    }
    importFile.value = file;
    importFileData.value = data;
    error.value = '';
  } catch (err: any) {
    error.value = t('setup.parseFailed', { err: err.message || t('setup.unknownError') });
  }
};

const clearImportFile = () => {
  importFile.value = null;
  importFileData.value = null;
  if (fileInput.value) fileInput.value.value = '';
};

/** salt 不一致时后端重置出的一次性凭据 —— 只存在于内存,刷新即失。 */
const resetCredentials = ref<{ username: string; password: string }[]>([]);
/** 旧版导出(无指纹):哈希原样保留,但可能全体无法登录 —— 提示一下。 */
const saltUnknown = ref(false);

const copyCredentials = async () => {
  const text = resetCredentials.value.map(c => `${c.username}\t${c.password}`).join('\n');
  try { await navigator.clipboard.writeText(text); copied.value = true; } catch { /* 剪贴板不可用就算了 */ }
};
const copied = ref(false);
/**
 * 导入结果里**有问题的那些表**。后端一直如实返回 `data[table].failed`,而这里从来不看它 ——
 * 于是「四条角色一条都没进来」在屏幕上就是一句「导入完成」。三个绿灯测不到人看到什么,这就是一例。
 */
const importProblems = ref<{ table: string; failed: number; droppedColumns?: string[] }[]>([]);

const performSetup = async () => {
  if (importMode.value) {
    if (!importFileData.value) {
      error.value = t('setup.pickFile');
      return;
    }
    loading.value = true;
    error.value = '';
    try {
      const res: any = await systemAPI.setup({ importData: importFileData.value });
      /**
       * salt 与导出方不一致时,后端把所有账号的密码重置成随机值,并**仅此一次**把明文带回来。
       * 必须在这里显示出来:导入模式不会创建向导里的管理员,用户全部来自数据文件 ——
       * 直接跳转就等于把唯一的登录凭据丢掉,站点当场变成没人能进。
       */
      if (res?.resetCredentials?.length) {
        resetCredentials.value = res.resetCredentials;
        return;   // 不跳转,停在凭据页等管理员确认
      }
      if (res?.saltState === 'unknown') saltUnknown.value = true;

      const problems = Object.entries(res?.data ?? {})
        .map(([table, r]: [string, any]) => ({ table, failed: r?.failed ?? 0, droppedColumns: r?.droppedColumns }))
        .filter(p => p.failed > 0 || p.droppedColumns?.length);
      if (problems.length) {
        importProblems.value = problems;
        return;   // 停下来让人看见,不直接跳走
      }

      router.push('/login');
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message || t('setup.importFailed');
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
        <p class="text-title-section leading-[1.19] opacity-60 font-normal tracking-[0.231px]">Configure your new site.</p>
      </div>

      <!-- salt 不一致 → 后端已重置全部密码,凭据只在这一次响应里。不显示就等于把站点锁死。 -->
      <div v-if="resetCredentials.length" class="bg-white p-8 rounded-card shadow-xl flex flex-col gap-5">
        <Message severity="warn" :closable="false" unstyled :pt="MESSAGE_PT">
          <template #icon><LucideTriangleAlert :size="15" /></template>
          {{ $t('setup.saltMismatch') }}
        </Message>

        <div class="border border-separator rounded-control divide-y divide-separator-weak max-h-64 overflow-y-auto">
          <div v-for="c in resetCredentials" :key="c.username"
            class="flex items-center justify-between gap-3 px-3 py-2">
            <span class="text-body text-label min-w-0 truncate">{{ c.username }}</span>
            <code class="text-small font-mono text-label shrink-0">{{ c.password }}</code>
          </div>
        </div>

        <p :class="TEXT.caption">{{ $t('setup.saltMismatchHint') }}</p>

        <div class="flex gap-2">
          <Button unstyled @click="copyCredentials" :class="BTN.secondary" class="flex-1">
            <LucideCopy :size="16" /> {{ copied ? $t('setup.copied') : $t('setup.copyAll') }}
          </Button>
          <Button unstyled @click="router.push('/login')" :class="BTN.primary" class="flex-1">
            {{ $t('setup.savedThemGoOn') }}
          </Button>
        </div>
      </div>

      <!-- 导入有失败/丢列 → 必须让人看见。后端返回了,前端不显示等于没返回。 -->
      <div v-else-if="importProblems.length" class="bg-white p-8 rounded-card shadow-xl flex flex-col gap-5">
        <Message severity="warn" :closable="false" unstyled :pt="MESSAGE_PT">
          <template #icon><LucideTriangleAlert :size="15" /></template>
          {{ $t('setup.importReportTitle') }}
        </Message>

        <div class="border border-separator rounded-control divide-y divide-separator-weak max-h-64 overflow-y-auto">
          <div v-for="p in importProblems" :key="p.table" class="flex flex-col gap-1 px-3 py-2">
            <span class="text-body text-label font-mono">{{ p.table }}</span>
            <span v-if="p.failed" class="text-small text-danger">{{ $t('setup.importRowsFailed', { n: p.failed }) }}</span>
            <span v-if="p.droppedColumns?.length" :class="TEXT.caption">
              {{ $t('setup.importColsDropped', { cols: p.droppedColumns.join(', ') }) }}
            </span>
          </div>
        </div>

        <p :class="TEXT.caption">{{ $t('setup.importReportHint') }}</p>

        <Button unstyled @click="router.push('/login')" :class="BTN.secondary">
          {{ $t('setup.importGoOn') }}
        </Button>
      </div>

      <div v-else class="bg-white p-8 rounded-card shadow-xl flex flex-col gap-6">
        <!-- Mode Toggle -->
        <div :class="SEGMENT.wrap">
          <Button
            @click="importMode = false; clearImportFile()"
            unstyled
            :class="[SEGMENT.item, !importMode ? SEGMENT.active : SEGMENT.idle]"
          >{{ $t('setup.tabNew') }}</Button>
          <Button
            @click="importMode = true"
            unstyled
            :class="[SEGMENT.item, importMode ? SEGMENT.active : SEGMENT.idle]"
          >{{ $t('setup.tabImport') }}</Button>
        </div>

        <!-- New Site Mode -->
        <template v-if="!importMode">
          <div :class="FIELD_GROUP">
            <label class="px-1" :class="LABEL_BARE">Site Name</label>
            <InputText v-model="siteName" unstyled
              :class="INPUT_CLASS_LG"
              placeholder="My Awesome Website" />
          </div>

          <div :class="FIELD_GROUP">
            <label class="px-1" :class="LABEL_BARE">Admin Username</label>
            <InputText v-model="adminUsername" unstyled
              :class="INPUT_CLASS_LG"
              placeholder="admin" autocomplete="username" />
          </div>

          <div :class="FIELD_GROUP">
            <label class="px-1" :class="LABEL_BARE">Admin Password</label>
            <Password v-model="adminPassword" unstyled :feedback="false" toggleMask fluid
              :inputProps="{ class: PASSWORD_LG.inputClass, placeholder: '••••••••', autocomplete: 'new-password' }"
              :pt="PASSWORD_LG.pt" />
          </div>
        </template>

        <!-- Import Mode -->
        <template v-else>
          <p :class="TEXT.muted">{{ $t('setup.importHint') }}</p>

          <div v-if="importFileName" class="flex items-center gap-3 p-3 bg-info-fill rounded-control border border-info">
            <LucideFileText :size="20" class="text-accent shrink-0" />
            <span class="text-body text-label truncate flex-1">{{ importFileName }}</span>
            <button @click="clearImportFile" :class="BTN_REMOVE">
              <LucideX :size="16" />
            </button>
          </div>

          <input ref="fileInput" type="file" accept=".json,application/json" class="hidden" @change="onFileChange" />
          <button @click="handleFileSelect" type="button" unstyled
            class="w-full border-2 border-dashed border-separator rounded-control py-6 flex flex-col items-center justify-center gap-2 text-label-3 hover:border-accent hover:text-accent transition-colors cursor-pointer bg-transparent">
            <LucideUpload :size="24" />
            <span class="text-body font-medium">{{ $t('setup.pickExportFile') }}</span>
          </button>
        </template>

        <Message v-if="saltUnknown" severity="info" :closable="false" unstyled :pt="MESSAGE_PT">
          <template #icon><LucideInfo :size="15" /></template>
          {{ $t('setup.saltUnknown') }}
        </Message>

        <div v-if="error" class="text-danger text-body text-center">{{ error }}</div>

        <Button :loading="loading" @click="performSetup" unstyled
          :class="BTN_LG.primary" class="mt-4 w-full">
          {{ importMode ? $t('setup.importAndInit') : $t('setup.completeSetup') }}
        </Button>
      </div>
    </div>
  </div>
</template>
