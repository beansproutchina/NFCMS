import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authAPI } from '../api';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<any>(null);
  const exp = ref<number | null>(null); // token 过期时间戳
  const initialized = ref(false); // 是否已初始化（调用过 loginInfo）
  const permissions = ref<Array<{ model: string; action: string; scope: string }>>([]);

  const isAuthenticated = computed(() => !!user.value);
  const isSuperAdmin = computed(() => user.value?.role === 'super_admin' || user.value?.role === 'superadmin');

  // Capability check driven by RBAC (from loginInfo). super_admin implies all.
  function can(model: string, action: string) {
    if (isSuperAdmin.value) return true;
    return permissions.value.some(p => p.model === model && p.action === action);
  }

  function applyAuth(res: any) {
    user.value = res.data;
    exp.value = res.exp || null;
    permissions.value = res.auth?.permissions || [];
  }

  // 启动时/登录后调用 loginInfo 获取当前登录状态 + 权限
  async function fetchLoginInfo() {
    try {
      const res: any = await authAPI.loginInfo();
      if (res.code === 200 && res.data) {
        applyAuth(res);
      } else {
        clearUser();
      }
    } catch {
      clearUser();
    } finally {
      initialized.value = true;
    }
  }

  function setUser(userData: any) {
    user.value = userData;
  }

  function clearUser() {
    user.value = null;
    exp.value = null;
    permissions.value = [];
  }

  return { user, exp, initialized, permissions, isAuthenticated, isSuperAdmin, can, fetchLoginInfo, setUser, clearUser };
});
