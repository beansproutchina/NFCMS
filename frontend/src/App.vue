<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import { CONFIRM_PT } from './ui/presets';
import { attachErrorSink } from './errorToast';

const toast = useToast();

const showError = (detail: string) => {
  toast.add({ severity: 'error', summary: 'Error', detail, life: 3000 });
};

/**
 * 监听 `app-error` 的**不是这里**,是 errorToast.ts 在模块加载时就挂好的 —— 预渲染页要等
 * `router.isReady()` 才挂载,初次导航的全部请求都在挂载之前跑完,直接在 onMounted 里监听
 * 会把那一整段时间里的错误全部丢掉。这里只是把真正的 toast 接上去,并领走缓冲的消息。
 */
let detach: (() => void) | null = null;
onMounted(() => { detach = attachErrorSink(showError); });
onUnmounted(() => { detach?.(); });
</script>

<template>
  <Toast />
  <!-- `unstyled` on purpose: opt out of Aura so the app's own tokens apply (see CONFIRM_PT). -->
  <ConfirmDialog unstyled :pt="CONFIRM_PT" />
  <RouterView />
</template>
