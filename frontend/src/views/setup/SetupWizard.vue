<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { systemAPI } from '../../api';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Password from 'primevue/password';

const router = useRouter();
const siteName = ref('');
const adminUsername = ref('');
const adminPassword = ref('');
const error = ref('');
const loading = ref(false);

const performSetup = async () => {
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
  <div class="h-screen w-full flex flex-col justify-center items-center bg-[#f5f5f7] text-[#1d1d1f]">
    <div class="max-w-md w-full px-6">
      <div class="text-center mb-10">
        <h1 class="text-[56px] leading-[1.07] font-semibold tracking-[-0.28px] mb-2">NFCMS</h1>
        <p class="text-[21px] leading-[1.19] opacity-60 font-normal tracking-[0.231px]">Configure your new site.</p>
      </div>

      <div class="bg-white p-8 rounded-2xl shadow-xl flex flex-col gap-6">
        <div class="flex flex-col gap-2">
          <label class="text-[14px] text-[rgba(0,0,0,0.8)] px-1 font-medium">Site Name</label>
          <InputText v-model="siteName" unstyled
            class="w-full bg-[#f5f5f7] text-[#1d1d1f] border border-transparent rounded-[8px] py-4 px-4 text-[17px] focus:outline-none focus:border-apple-blue focus:bg-white focus:ring-1 focus:ring-apple-blue transition-all"
            placeholder="My Awesome Website" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-[14px] text-[rgba(0,0,0,0.8)] px-1 font-medium">Admin Username</label>
          <InputText v-model="adminUsername" unstyled
            class="w-full bg-[#f5f5f7] text-[#1d1d1f] border border-transparent rounded-[8px] py-4 px-4 text-[17px] focus:outline-none focus:border-apple-blue focus:bg-white focus:ring-1 focus:ring-apple-blue transition-all"
            placeholder="admin" autocomplete="username" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-[14px] text-[rgba(0,0,0,0.8)] px-1 font-medium">Admin Password</label>
          <Password v-model="adminPassword" unstyled :feedback="false" toggleMask fluid
            :inputProps="{ class: 'w-full bg-[#f5f5f7] text-[#1d1d1f] border border-transparent rounded-[8px] py-4 px-4 text-[17px] focus:outline-none focus:border-apple-blue focus:bg-white focus:ring-1 focus:ring-apple-blue transition-all relative', placeholder: '••••••••', autocomplete: 'new-password' }"
            :pt="{ root: 'relative w-full', maskIcon: 'absolute right-4 top-1/2 -translate-y-1/2 opacity-50 cursor-pointer w-5 h-5', unmaskIcon: 'absolute right-4 top-1/2 -translate-y-1/2 opacity-50 cursor-pointer w-5 h-5' }" />
        </div>

        <div v-if="error" class="text-red-500 text-[14px] text-center">{{ error }}</div>

        <Button :loading="loading" @click="performSetup" unstyled
          class="mt-4 bg-apple-blue hover:bg-[#0066cc] text-white text-[17px] py-[14px] rounded-[8px] w-full font-medium transition-colors cursor-pointer flex justify-center items-center gap-2">
          Complete Setup
        </Button>
      </div>
    </div>
  </div>
</template>
