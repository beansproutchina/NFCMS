<script setup lang="ts">
import { getCurrentInstance, onMounted, onUnmounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import { CONFIRM_PT } from './ui/presets';


const toast = useToast();

const showError = (e: any) => {
  toast.add({
    severity: 'error',
    summary: 'Error',
    detail: e.detail,
    life: 3000
  });
};

onMounted(() => {
  window.addEventListener('app-error', showError as any);
  
});
onUnmounted(() => {
  window.removeEventListener('app-error', showError as any);
});
</script>

<template>
  <Toast />
  <!-- `unstyled` on purpose: opt out of Aura so the app's own tokens apply (see CONFIRM_PT). -->
  <ConfirmDialog unstyled :pt="CONFIRM_PT" />
  <RouterView />
</template>
