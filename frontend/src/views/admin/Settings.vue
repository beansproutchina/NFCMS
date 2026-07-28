<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Button from 'primevue/button';
import { systemAPI, uploadAPI } from '../../api';
import { LucideSave, LucideRefreshCw, LucideDownload, LucidePlug, LucideCheck, LucideX, LucideLoader } from 'lucide-vue-next';
import { useToast } from 'primevue/usetoast';
import { SELECT_PT, INPUT_CLASS, BTN } from '../../ui/presets';

// ─── General Site Config ─────────────────────────────────────────────
const configsMap = ref<Record<string, string>>({
    site_name: '',
    subtitle: '',
    icp_record: '',
    mourning_mode: '0',
    home_template: 'DefaultHome'
});

const loading = ref(true);
const saving = ref(false);
const restarting = ref(false);
const exporting = ref(false);
const toast = useToast();

// ─── Storage Config ──────────────────────────────────────────────────
// Stored as a single JSON key "storage_config" in system_config:
// { "provider": "local", "local": {...}, "s3": {...}, "tencent_cos": {...} }

interface StorageConfigField {
    key: string;
    label: string;
    type: "text" | "password" | "number" | "select";
    placeholder?: string;
    default?: string;
    options?: { label: string; value: string }[];
    required?: boolean;
}

interface StorageProviderMeta {
    name: string;
    label: string;
    description: string;
    configFields: StorageConfigField[];
}

const storageProviders = ref<StorageProviderMeta[]>([]);
const activeProvider = ref('local');
// Each provider's config stored separately, merged into single JSON on save
const providerConfigs = ref<Record<string, Record<string, string>>>({});
const testing = ref(false);
const testResult = ref<{ success: boolean; error?: string } | null>(null);

const currentProviderMeta = computed(() => {
    return storageProviders.value.find(p => p.name === activeProvider.value);
});

const currentFields = computed(() => {
    return currentProviderMeta.value?.configFields || [];
});

// Reactive getter/setter for current provider's config fields
const getFieldValue = (key: string): string => {
    return providerConfigs.value[activeProvider.value]?.[key] ?? '';
};
const setFieldValue = (key: string, value: string) => {
    if (!providerConfigs.value[activeProvider.value]) {
        providerConfigs.value[activeProvider.value] = {};
    }
    providerConfigs.value[activeProvider.value][key] = value;
};

const fetchSettings = async () => {
    loading.value = true;
    try {
        const res = await systemAPI.getConfig();
        const data = res.data || {};

        // Populate general config
        Object.keys(configsMap.value).forEach(k => {
            if (data[k] !== undefined) {
                configsMap.value[k] = data[k] || (k === 'mourning_mode' ? '0' : '');
            }
        });

        // Parse storage_config JSON
        const rawStorage = data.storage_config;
        if (rawStorage) {
            try {
                const parsed = typeof rawStorage === 'string' ? JSON.parse(rawStorage) : rawStorage;
                activeProvider.value = parsed.provider || 'local';
                // Distribute sub-objects into providerConfigs
                providerConfigs.value = {};
                for (const [pName, pConfig] of Object.entries(parsed)) {
                    if (pName === 'provider' || typeof pConfig !== 'object' || !pConfig) continue;
                    providerConfigs.value[pName] = { ...(pConfig as Record<string, string>) };
                }
            } catch {
                activeProvider.value = 'local';
                providerConfigs.value = {};
            }
        } else {
            activeProvider.value = 'local';
            providerConfigs.value = {};
        }
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

const fetchProviders = async () => {
    try {
        const res = await uploadAPI.getProviders();
        const data = res.data;
        storageProviders.value = data.providers || [];
        if (data.activeProvider) {
            activeProvider.value = data.activeProvider;
        }
        // Also populate providerConfigs from backend response if available
        if (data.storageConfig && typeof data.storageConfig === 'object') {
            for (const [pName, pConfig] of Object.entries(data.storageConfig)) {
                if (pName === 'provider' || typeof pConfig !== 'object' || !pConfig) continue;
                if (!providerConfigs.value[pName]) {
                    providerConfigs.value[pName] = { ...(pConfig as Record<string, string>) };
                } else {
                    // Merge: backend values fill in only if frontend hasn't loaded yet
                    for (const [k, v] of Object.entries(pConfig as Record<string, string>)) {
                        if (providerConfigs.value[pName][k] === undefined) {
                            providerConfigs.value[pName][k] = v;
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
};

const saveSettings = async () => {
    saving.value = true;
    testResult.value = null;
    try {
        // Build storage_config JSON from providerConfigs
        const storageConfigObj: Record<string, any> = {
            provider: activeProvider.value,
        };
        for (const [pName, pConfig] of Object.entries(providerConfigs.value)) {
            storageConfigObj[pName] = pConfig;
        }

        const payload = {
            ...configsMap.value,
            storage_config: JSON.stringify(storageConfigObj),
        };
        await systemAPI.saveConfig(payload);
        await fetchSettings();
        toast.add({ severity: 'success', summary: 'Success', detail: '站点配置已保存', life: 3000 });
    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Error', detail: '保存失败', life: 3000 });
    } finally {
        saving.value = false;
    }
};

const restartBackend = async () => {
    if (!confirm('确定要重启后端吗？')) return;
    restarting.value = true;
    try {
        await systemAPI.restart();
        toast.add({ severity: 'success', summary: 'Success', detail: '后端正在重启，请稍后刷新页面', life: 5000 });
    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Error', detail: '重启失败', life: 3000 });
    } finally {
        restarting.value = false;
    }
};

const handleExport = async () => {
    exporting.value = true;
    try {
        const res = await systemAPI.exportData();
        const data = res.data;
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `nfcms-export-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.add({ severity: 'success', summary: 'Success', detail: '数据已导出', life: 3000 });
    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Error', detail: '导出失败', life: 3000 });
    } finally {
        exporting.value = false;
    }
};

const testStorageConnection = async () => {
    testing.value = true;
    testResult.value = null;
    try {
        const res = await uploadAPI.testStorage(activeProvider.value);
        const data = res.data;
        // The backend only returns a message on the 500 branch, which rejects into catch below;
        // a 2xx with success:false carries no detail, so fall back to a generic message here.
        const error = data.success ? undefined : '连接测试未通过';
        testResult.value = { success: data.success, error };
        toast.add({
            severity: data.success ? 'success' : 'error',
            summary: data.success ? 'Success' : 'Error',
            detail: data.success ? '连接测试成功' : `连接失败: ${error}`,
            life: 3000
        });
    } catch (e: any) {
        testResult.value = { success: false, error: e.message || 'Test failed' };
        toast.add({ severity: 'error', summary: 'Error', detail: '连接测试失败', life: 3000 });
    } finally {
        testing.value = false;
    }
};

// When switching providers, clear test result
watch(activeProvider, () => {
    testResult.value = null;
});

onMounted(() => {
    fetchSettings();
    fetchProviders();
});
</script>

<template>
    <div class="max-w-4xl mx-auto py-10 w-full px-6">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 gap-4">
            <div>
                <h1 class="text-[40px] font-semibold leading-[1.1] tracking-tight mb-2">{{ $t('system.settings') }}</h1>
            </div>
            <div class="flex gap-4 items-center">
                <Button :disabled="restarting" unstyled @click="restartBackend" :class="BTN.ghost">
                    <LucideRefreshCw :size="16" :class="{'animate-spin': restarting}" /> {{ $t('action.restart')  }}
                </Button>
                <Button :disabled="saving" unstyled @click="saveSettings" :class="BTN.primary">
                    <LucideSave :size="16" /> {{ $t('action.save') }}
                </Button>
            </div>
        </div>

        <!-- General Site Config -->
        <div class="bg-white rounded-[12px] shadow-[0px_5px_30px_rgba(0,0,0,0.06)] overflow-hidden border border-[rgba(0,0,0,0.05)] p-8 mb-6">
            <div class="flex flex-col gap-6 mb-6" v-if="!loading">

                <div class="flex flex-col gap-2 max-w-lg">
                    <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">{{ $t('form.site_name') }}</label>
                    <InputText v-model="configsMap.site_name" unstyled placeholder="..." :class="INPUT_CLASS" />
                </div>

                <div class="flex flex-col gap-2 max-w-lg">
                    <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">{{ $t('form.subtitle')}}</label>
                    <InputText v-model="configsMap.subtitle" unstyled placeholder="..." :class="INPUT_CLASS" />
                </div>

                <div class="flex flex-col gap-2 max-w-lg">
                    <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">{{ $t('form.icp_record') }}</label>
                    <InputText v-model="configsMap.icp_record" unstyled placeholder="e.g. 京ICP备xxxxxxx号" :class="INPUT_CLASS" />
                </div>

                <div class="flex flex-col gap-2 max-w-lg">
                    <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">{{ $t('form.mourning_mode')}}</label>
                    <Select v-model="configsMap.mourning_mode" :options="[{label: '关闭', value: '0'}, {label: '开启 (全站置灰)', value: '1'}]" optionLabel="label" optionValue="value" unstyled :pt="SELECT_PT" class="w-full" />
                </div>

                <div class="flex flex-col gap-2 max-w-lg">
                    <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">前台首页渲染模版</label>
                    <InputText v-model="configsMap.home_template" unstyled placeholder="DefaultHome" :class="INPUT_CLASS" />
                </div>

            </div>
            <div v-else class="text-[14px] opacity-60">Loading...</div>
        </div>

        <!-- Storage Configuration -->
        <div class="bg-white rounded-[12px] shadow-[0px_5px_30px_rgba(0,0,0,0.06)] overflow-hidden border border-[rgba(0,0,0,0.05)] p-8 mb-6" v-if="!loading">
            <div class="flex items-center gap-3 mb-2">
                <LucidePlug :size="20" class="text-indigo-500" />
                <h2 class="text-[20px] font-semibold">{{ $t('form.storageConfig')  }}</h2>
            </div>
            <p class="text-[14px] text-[rgba(0,0,0,0.5)] mb-6">{{ $t('form.storageConfigDesc') }}</p>

            <!-- Provider Selector -->
            <div class="flex flex-col gap-2 max-w-lg ">
                <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">{{ $t('form.storageProvider')  }}</label>
                <Select v-model="activeProvider" :options="storageProviders.map(p => ({ label: p.label, value: p.name }))" optionLabel="label" optionValue="value" unstyled :pt="SELECT_PT" class="w-full" />
            </div>

            <!-- Current provider description -->
            <div v-if="currentProviderMeta" class="text-[13px] text-[rgba(0,0,0,0.45)] mb-2 max-w-lg">
                {{ currentProviderMeta.description }}
            </div>

            <!-- Dynamic config fields for selected provider -->
            <div class="flex flex-col gap-5" v-if="currentFields.length > 0">
                <div v-for="field in currentFields" :key="field.key" class="flex flex-col gap-2 max-w-lg">
                    <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">
                        {{ field.label }}
                        <span v-if="field.required" class="text-red-400 ml-0.5">*</span>
                    </label>

                    <!-- Select type -->
                    <Select v-if="field.type === 'select'" :modelValue="getFieldValue(field.key)" @update:modelValue="(v: string) => setFieldValue(field.key, v)" :options="field.options" optionLabel="label" optionValue="value" unstyled :pt="SELECT_PT" class="w-full" />

                    <!-- Password type -->
                    <InputText v-else-if="field.type === 'password'" :modelValue="getFieldValue(field.key)" @update:modelValue="(v: string) => setFieldValue(field.key, v)" type="password" :placeholder="field.placeholder" unstyled :class="INPUT_CLASS" />

                    <!-- Number type -->
                    <InputText v-else-if="field.type === 'number'" :modelValue="getFieldValue(field.key)" @update:modelValue="(v: string) => setFieldValue(field.key, v)" type="number" :placeholder="field.placeholder" unstyled :class="INPUT_CLASS" />

                    <!-- Text type (default) -->
                    <InputText v-else :modelValue="getFieldValue(field.key)" @update:modelValue="(v: string) => setFieldValue(field.key, v)" :placeholder="field.placeholder" unstyled :class="INPUT_CLASS" />
                </div>
            </div>

            <!-- Test Connection Button -->
            <div class="flex items-center gap-3 mt-6">
                <Button :disabled="testing" unstyled @click="testStorageConnection" :class="BTN.ghost">
                    <LucideLoader v-if="testing" :size="16" class="animate-spin" />
                    <LucidePlug v-else :size="16" />
                    {{ testing ? ($t('form.testing') ) : ($t('form.testConnection') ) }}
                </Button>
                <div v-if="testResult" class="flex items-center gap-1.5 text-[14px]">
                    <LucideCheck v-if="testResult.success" :size="16" class="text-emerald-500" />
                    <LucideX v-else :size="16" class="text-red-500" />
                    <span :class="testResult.success ? 'text-emerald-600' : 'text-red-600'">
                        {{ testResult.success ? ($t('form.testSuccess') ) : ($t('form.testFailed') ) }}
                    </span>
                    <span v-if="testResult.error" class="text-[rgba(0,0,0,0.4)] ml-1">- {{ testResult.error }}</span>
                </div>
            </div>
        </div>

        <!-- Export Section -->
        <div class="bg-white rounded-[12px] shadow-[0px_5px_30px_rgba(0,0,0,0.06)] overflow-hidden border border-[rgba(0,0,0,0.05)] p-8">
            <h2 class="text-[20px] font-semibold mb-2">{{ $t('form.exportTitle')  }}</h2>
            <p class="text-[14px] text-[rgba(0,0,0,0.6)] mb-6">{{ $t('form.exportDesc')  }}</p>

            <div class="flex gap-4 items-start">
                <Button :disabled="exporting" unstyled @click="handleExport" :class="BTN.primary">
                    <LucideDownload :size="16" :class="{'animate-pulse': exporting}" /> {{ $t('form.exportAll')  }}
                </Button>
            </div>
        </div>
    </div>
</template>
