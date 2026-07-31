<template>
    <div :class="PAGE.container">
        <div :class="PAGE.header">
            <div>
                <h1 :class="PAGE.title">{{ $t('profile.title') }}</h1>
                <p :class="PAGE.subtitle">{{ $t('profile.desc') }}</p>
            </div>
        </div>

        <div :class="CARD" class="max-w-lg flex flex-col gap-5">
            <div :class="FIELD_GROUP">
                <label :class="LABEL">{{ $t('form.username') }}</label>
                <InputText v-model="form.username" unstyled :class="INPUT_CLASS" autocomplete="username" />
            </div>

            <div :class="FIELD_GROUP">
                <label :class="LABEL">{{ $t('form.nickname') }}</label>
                <InputText v-model="form.nickname" unstyled :class="INPUT_CLASS" />
            </div>

            <div :class="FIELD_GROUP">
                <label :class="LABEL">{{ $t('form.password') }}</label>
                <Password v-model="form.password" unstyled :feedback="false" toggleMask fluid
                    :inputProps="{ class: PASSWORD_PT.inputClass, placeholder: $t('form.leaveBlankToKeep'), autocomplete: 'new-password' }"
                    :pt="PASSWORD_PT.pt" />
            </div>

            <!-- 角色只读:提权必须由 super_admin 在「用户」页做,后端也会剥掉本人提交的 role。 -->
            <div :class="FIELD_GROUP">
                <label :class="LABEL">{{ $t('form.role') }}</label>
                <div class="flex flex-wrap items-center gap-2">
                    <span :class="CHIP.accent">{{ roleLabel }}</span>
                    <span :class="TEXT.caption">{{ $t('profile.roleReadonly') }}</span>
                </div>
            </div>

            <div class="flex justify-end">
                <Button unstyled @click="save" :disabled="saving || !form.username" :class="BTN.primary">
                    {{ $t('action.save') }}
                </Button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * 「我的资料」—— 任何登录用户都能改自己的用户名 / 昵称 / 密码。
 *
 * 后端早就允许这件事(UserModel 的 HTTPReadOne / HTTPUpdate 对非 super 一律把 `query.id` 锁成
 * 本人,并 `delete body.role` 防提权),但后台一直**没有入口**:`/admin/users` 只对 super_admin
 * 显示,非 super 连列表页都进不去,于是"能改"停留在接口层。这一页就是把那条已有能力露出来。
 *
 * 刻意不复用 UserEditor:那是 super_admin 管别人用的弹窗(带主/附加角色分配),而这里角色是只读的。
 */
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { getUser, updateUser } from '../../api';
import { useAuthStore } from '../../stores/auth';
import { BTN, CARD, CHIP, FIELD_GROUP, INPUT_CLASS, LABEL, PAGE, PASSWORD_PT, TEXT } from '../../ui/presets';

const { t, te } = useI18n();
const toast = useToast();
const authStore = useAuthStore();

const form = ref<any>({ username: '', nickname: '', password: '' });
const saving = ref(false);

// 角色名可能是站点自建的(roles 表任意 name),i18n 里不一定有 —— 有就翻,没有就原样显示。
const roleLabel = computed(() => {
    const r = authStore.user?.role;
    if (!r) return '—';
    return te(`role.${r}`) ? t(`role.${r}`) : r;
});

onMounted(async () => {
    const id = authStore.user?.id;
    if (!id) return;
    try {
        const res = await getUser(id);
        const row: any = res.data || {};
        form.value = { username: row.username || '', nickname: row.nickname || '', password: '' };
    } catch (e) {
        console.error(e);   // 错误提示由 api.ts 拦截器统一弹出
    }
});

const save = async () => {
    const id = authStore.user?.id;
    if (!id || saving.value) return;
    saving.value = true;
    try {
        const body: any = { username: form.value.username, nickname: form.value.nickname };
        // 空密码 = 不改。后端也有同样的判断,这里不发出去省一次哈希。
        if (form.value.password) body.password = form.value.password;
        await updateUser(id, body);
        form.value.password = '';
        // 用户名进了 JWT 载荷的显示层,改完要让侧栏/头部立刻跟上
        authStore.setUser({ ...(authStore.user as any), username: form.value.username });
        toast.add({ severity: 'success', summary: 'Success', detail: t('toast.saved'), life: 3000 });
    } catch (e) {
        console.error(e);
    } finally {
        saving.value = false;
    }
};
</script>
