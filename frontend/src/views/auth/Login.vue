<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Password from 'primevue/password';

const router = useRouter();
const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

const performLogin = async () => {
  if (!username.value || !password.value) {
    error.value = "All fields are required.";
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const res = await axios.post('/api/user/login', {
      username: username.value,
      password: password.value
    });
    if (res.data.code === 200) {
      localStorage.setItem('user', JSON.stringify(res.data.data));
      router.push('/');
    } else {
      error.value = res.data.message || "Login failed";
    }
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
        <h1 class="text-[56px] leading-[1.07] font-semibold tracking-[-0.28px] mb-2">Sign In</h1>
        <p class="text-[21px] leading-[1.19] opacity-60 font-normal tracking-[0.231px]">Use your NFCMS ID.</p>
      </div>

      <div class="bg-white p-8 rounded-2xl shadow-xl flex flex-col gap-6">
        <div class="flex flex-col gap-2">
          <label class="text-[14px] text-[rgba(0,0,0,0.8)] px-1 font-medium">Username</label>
          <InputText v-model="username" class="w-full bg-[#f5f5f7] text-[#1d1d1f] border border-transparent rounded-[8px] py-4 px-4 text-[17px] focus:outline-none focus:border-apple-blue focus:bg-white focus:ring-1 focus:ring-apple-blue transition-all" placeholder="admin" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-[14px] text-[rgba(0,0,0,0.8)] px-1 font-medium">Password</label>
          <Password v-model="password" :feedback="false" toggleMask inputClass="w-full bg-[#f5f5f7] text-[#1d1d1f] border border-transparent rounded-[8px] py-4 px-4 text-[17px] focus:outline-none focus:border-apple-blue focus:bg-white focus:ring-1 focus:ring-apple-blue transition-all" placeholder="••••••••" />
        </div>

        <div v-if="error" class="text-red-500 text-[14px] text-center">{{ error }}</div>

        <Button :loading="loading" @click="performLogin" unstyled class="mt-4 bg-apple-blue hover:bg-[#0066cc] text-white text-[17px] py-[14px] rounded-[8px] w-full font-medium transition-colors cursor-pointer flex justify-center">
          Sign In
        </Button>
      </div>
    </div>
  </div>
</template>
