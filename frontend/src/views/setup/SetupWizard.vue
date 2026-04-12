<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
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
    const res = await axios.post('/api/system/setup', {
      siteName: siteName.value,
      adminUsername: adminUsername.value,
      adminPassword: adminPassword.value
    });
    if (res.data.code === 200) {
      router.push('/login');
    } else {
      error.value = res.data.message || "Setup failed";
    }
  } catch (err: any) {
    error.value = err.response?.data?.message || err.message;
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="h-screen w-full flex flex-col justify-center items-center bg-black text-white">
    <div class="max-w-md w-full px-6">
      <div class="text-center mb-10">
        <h1 class="text-[56px] leading-[1.07] font-semibold tracking-[-0.28px] mb-2">NFCMS</h1>
        <p class="text-[21px] leading-[1.19] opacity-80 font-normal tracking-[0.231px]">Configure your new site.</p>
      </div>

      <div class="bg-[#1d1d1f] p-8 rounded-2xl shadow-2xl flex flex-col gap-6">
        <div class="flex flex-col gap-2">
          <label class="text-[14px] text-[rgba(255,255,255,0.8)] px-1">Site Name</label>
          <InputText v-model="siteName" class="w-full bg-[#272729] text-white border border-transparent rounded-[8px] py-4 px-4 text-[17px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue transition-all" placeholder="My Awesome Website" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-[14px] text-[rgba(255,255,255,0.8)] px-1">Admin Username</label>
          <InputText v-model="adminUsername" class="w-full bg-[#272729] text-white border border-transparent rounded-[8px] py-4 px-4 text-[17px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue transition-all" placeholder="admin" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-[14px] text-[rgba(255,255,255,0.8)] px-1">Admin Password</label>
          <Password v-model="adminPassword" :feedback="false" toggleMask inputClass="w-full bg-[#272729] text-white border border-transparent rounded-[8px] py-4 px-4 text-[17px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue transition-all" placeholder="••••••••" />
        </div>

        <div v-if="error" class="text-red-400 text-[14px] text-center">{{ error }}</div>

        <Button :loading="loading" @click="performSetup" unstyled class="mt-4 bg-apple-blue hover:bg-[#2997ff] text-white text-[17px] py-[14px] rounded-[8px] w-full font-medium transition-colors cursor-pointer flex justify-center">
          Complete Setup
        </Button>
      </div>
    </div>
  </div>
</template>
