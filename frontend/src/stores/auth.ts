import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authAPI } from '../api';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<any>(null);
  const exp = ref<number | null>(null); // token 过期时间戳
  const initialized = ref(false); // 是否已初始化（调用过 loginInfo）

  const isAuthenticated = computed(() => !!user.value);
  const isSuperAdmin = computed(() => user.value?.role === 'super_admin' || user.value?.role === 'superadmin');

  // 启动时调用 loginInfo 获取当前登录状态
  async function fetchLoginInfo() {
    try {
      const res: any = await authAPI.loginInfo();
      if (res.code === 200 && res.data) {
        user.value = res.data;
        exp.value = res.exp || null;
      } else {
        user.value = null;
        exp.value = null;
      }
    } catch {
      user.value = null;
      exp.value = null;
    } finally {
      initialized.value = true;
    }
  }

  // 登录成功后设置用户
  function setUser(userData: any) {
    user.value = userData;
  }

  // 登出
  function clearUser() {
    user.value = null;
    exp.value = null;
  }

  return { user, exp, initialized, isAuthenticated, isSuperAdmin, fetchLoginInfo, setUser, clearUser };
});
