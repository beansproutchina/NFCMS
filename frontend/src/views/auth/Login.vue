<script setup lang="ts">
import { FIELD_GROUP, INPUT_CLASS_LG, LABEL_BARE, PASSWORD_LG } from '../../ui/presets';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { authAPI } from '../../api';
import { useAuthStore } from '../../stores/auth';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Password from 'primevue/password';
import { useToast } from 'primevue/usetoast';
import { useI18n } from 'vue-i18n';

const router = useRouter();
const toast = useToast();
const { t } = useI18n();
const authStore = useAuthStore();
const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

const performLogin = async () => {
  if (!username.value || !password.value) {
    error.value = t('auth.fieldsRequired');
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const res = await authAPI.login({
      username: username.value,
      password: password.value
    });
    if (res.code === 200 || res.data) {
      await authStore.fetchLoginInfo(); // load user + RBAC capabilities from the freshly-set cookie
      toast.add({ severity: 'success', summary: 'Success', detail: t('auth.loginSuccess'), life: 3000 });
      const next = router.currentRoute.value.query.redirect as string || '/admin';
      router.push( next);
    } else {
      error.value = res.message || t('auth.loginFailed');
    }
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.message || err.response?.data?.message || err.detail || t('auth.loginFailed'), life: 3000 });
    error.value = err.message || err.response?.data?.message || err.detail || t('auth.loginFailed');
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="h-screen w-full flex flex-col justify-center items-center bg-canvas text-label">
    <div class="max-w-md w-full px-6">
      <div class="text-center mb-10">
        <h1 class="text-[56px] leading-[1.07] font-semibold tracking-[-0.28px] mb-2">{{ $t('auth.signIn') }}</h1>
        <p class="text-title-section leading-[1.19] opacity-60 font-normal tracking-[0.231px]" v-if="0">{{ $t('auth.useId') }}</p>
      </div>

      <div class="bg-white p-8 rounded-card shadow-xl flex flex-col gap-6">
        <div :class="FIELD_GROUP">
          <label class="px-1" :class="LABEL_BARE">{{ $t('auth.username') }}</label>
          <InputText v-model="username" unstyled :class="INPUT_CLASS_LG" placeholder="admin" autocomplete="username" />
        </div>

        <div :class="FIELD_GROUP">
          <label class="px-1" :class="LABEL_BARE">{{ $t('auth.password') }}</label>
          <Password v-model="password" unstyled :feedback="false" toggleMask fluid :inputProps="{ class: PASSWORD_LG.inputClass, placeholder: '••••••••', autocomplete: 'current-password' }" :pt="PASSWORD_LG.pt" />
        </div>

        <div v-if="error" class="text-danger text-body text-center">{{ error }}</div>

        <Button :loading="loading" @click="performLogin" unstyled class="mt-4 bg-accent hover:bg-link text-white text-title-item py-[14px] rounded-control w-full font-medium transition-colors cursor-pointer flex justify-center items-center gap-2">
          {{ $t('auth.signIn') }}
        </Button>
      </div>
    </div>
  </div>
</template>
