<script setup lang="ts">
import { ref, onMounted } from 'vue';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Button from 'primevue/button';
import { systemAPI } from '../../api';
import { LucideSave, LucideRefreshCw } from 'lucide-vue-next';
import { useToast } from 'primevue/usetoast';

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
const toast = useToast();

const fetchSettings = async () => {
    loading.value = true;
    try {
        const res: any = await systemAPI.getConfig();
        const data = res.data || res || {};
        
        // Populate the map
        Object.keys(configsMap.value).forEach(k => {
            if (data[k] !== undefined) {
                configsMap.value[k] = data[k] || (k === 'mourning_mode' ? '0' : '');
            }
        });
    } catch(e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

const saveSettings = async () => {
    saving.value = true;
    try {
        await systemAPI.saveConfig(configsMap.value);
        await fetchSettings();
        toast.add({ severity: 'success', summary: 'Success', detail: '站点配置已保存', life: 3000 });
    } catch(e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Error', detail: '保存失败', life: 3000 });
    } finally {
        saving.value = false;
    }
}

const restartBackend = async () => {
    if(!confirm('确定要重启后端吗？')) return;
    restarting.value = true;
    try {
        await systemAPI.restart();
        toast.add({ severity: 'success', summary: 'Success', detail: '后端正在重启，请稍后刷新页面', life: 5000 });
    } catch(e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Error', detail: '重启失败', life: 3000 });
    } finally {
        restarting.value = false;
    }
}

onMounted(fetchSettings);
</script>

<template>
    <div class="max-w-4xl mx-auto py-10 w-full px-6">
        <div class="flex justify-between items-end mb-8">
            <div>
                <h1 class="text-[40px] font-semibold leading-[1.1] tracking-tight mb-2">{{ $t('system.settings') || '网站设置' }}</h1>
            </div>
            <div class="flex gap-4 items-center">
                <Button :disabled="restarting" unstyled @click="restartBackend" class="bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[rgba(0,0,0,0.8)] flex items-center justify-center gap-2 px-4 py-2 rounded-[8px] text-[15px] font-medium transition-colors border border-[rgba(0,0,0,0.05)] focus:outline-none cursor-pointer">
                    <LucideRefreshCw :size="16" :class="{'animate-spin': restarting}" /> {{ $t('action.restart') || '重启后端' }}
                </Button>
                <Button :disabled="saving" unstyled @click="saveSettings" class="bg-[#0071e3] hover:bg-[#0077ED] text-white flex items-center justify-center gap-2 px-4 py-2 rounded-[8px] text-[15px] font-medium transition-colors border border-transparent focus:outline-none cursor-pointer">
                    <LucideSave :size="16" /> {{ $t('action.save') || '保存' }}
                </Button>
            </div>
        </div>

        <div class="bg-white rounded-[12px] shadow-[0px_5px_30px_rgba(0,0,0,0.06)] overflow-hidden border border-[rgba(0,0,0,0.05)] p-8">
            <div class="flex flex-col gap-6" v-if="!loading">
                
                <div class="flex flex-col gap-2 max-w-lg">
                    <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">{{ $t('form.site_name') || '网站名称' }}</label>
                    <InputText v-model="configsMap.site_name" unstyled placeholder="..." class="w-full h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue bg-white transition-shadow" />
                </div>
                
                <div class="flex flex-col gap-2 max-w-lg">
                    <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">{{ $t('form.subtitle') || '副标题' }}</label>
                    <InputText v-model="configsMap.subtitle" unstyled placeholder="..." class="w-full h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue bg-white transition-shadow" />
                </div>
                
                <div class="flex flex-col gap-2 max-w-lg">
                    <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">{{ $t('form.icp_record') || '备案号' }}</label>
                    <InputText v-model="configsMap.icp_record" unstyled placeholder="e.g. 京ICP备xxxxxxx号" class="w-full h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue bg-white transition-shadow" />
                </div>
                
                <div class="flex flex-col gap-2 max-w-lg mb-6">
                    <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">{{ $t('form.mourning_mode') || '哀悼模式' }}</label>
                    <Select v-model="configsMap.mourning_mode" :options="[{label: '关闭', value: '0'}, {label: '开启 (全站置灰)', value: '1'}]" optionLabel="label" optionValue="value" unstyled
                        :pt="{ root: 'w-full h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:ring-1 focus:ring-apple-blue bg-white transition-shadow flex items-center justify-between cursor-pointer relative', label: 'text-[14px] text-[rgba(0,0,0,0.8)] truncate', dropdown: 'w-4 h-4 opacity-50 absolute right-3 top-1/2 -translate-y-1/2', overlay: 'bg-white border border-[rgba(0,0,0,0.15)] rounded-[8px] shadow-lg mt-1 py-1 z-[9999]', option: ({ context }: any) => ({ class: ['px-3 py-2 text-[14px] cursor-pointer hover:bg-[#f5f5f7]', context.selected ? 'bg-[#0071e3] text-white hover:bg-[#0071e3]' : 'text-[rgba(0,0,0,0.8)]'] }) }" />
                </div>
                
                <div class="flex flex-col gap-2 max-w-lg">
                    <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">前台首页渲染模版</label>
                    <InputText v-model="configsMap.home_template" unstyled placeholder="DefaultHome" class="w-full h-10 px-3 border border-[rgba(0,0,0,0.15)] rounded-[8px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue bg-white transition-shadow" />
                </div>
                
            </div>
            <div v-else class="text-[14px] opacity-60">Loading...</div>
        </div>
    </div>
</template>
