<script setup lang="ts">
import { ref, onMounted } from 'vue';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import axios from 'axios';
import { LucideSave } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const settings = ref<any[]>([]);
const configsMap = ref<Record<string, { id?: number, value: string }>>({
    site_name: { value: '' }
});
const loading = ref(true);
const saving = ref(false);

const parseSettings = (list: any[]) => {
    const defaultKeys = ['site_name'];
    defaultKeys.forEach(k => {
        if(!configsMap.value[k]) configsMap.value[k] = { value: '' };
    });
    
    list.forEach(item => {
        if(item.key !== 'is_initialized') {
            configsMap.value[item.key] = { id: item.id, value: item.value };
        }
    });
}

const fetchSettings = async () => {
    loading.value = true;
    try {
        const res = await axios.get('/api/systemconfig');
        settings.value = res.data.data || [];
        parseSettings(settings.value);
    } catch(e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

const saveSettings = async () => {
    saving.value = true;
    try {
        for(const [key, obj] of Object.entries(configsMap.value)) {
            if(obj.id) {
                await axios.put(`/api/systemconfig?id=${obj.id}`, { value: obj.value });
            } else {
                await axios.post('/api/systemconfig', { key, value: obj.value });
            }
        }
        await fetchSettings();
    } catch(e) {
        console.error(e);
    } finally {
        saving.value = false;
    }
}

onMounted(fetchSettings);
</script>

<template>
    <div class="max-w-4xl mx-auto py-10 w-full px-6">
        <div class="flex justify-between items-end mb-8">
            <div>
                <h1 class="text-[40px] font-semibold leading-[1.1] tracking-tight mb-2">{{ $t('system.settings') }}</h1>
            </div>
            <div class="flex gap-4 items-center">
                <Button :disabled="saving" unstyled @click="saveSettings" class="bg-apple-blue hover:bg-[#2997ff] text-white flex items-center gap-2 px-[15px] py-[8px] rounded-[8px] font-text text-[17px] cursor-pointer">
                    <LucideSave :size="16" /> {{ $t('action.save') }}
                </Button>
            </div>
        </div>

        <div class="bg-white rounded-[12px] shadow-[0px_5px_30px_rgba(0,0,0,0.06)] overflow-hidden border border-[rgba(0,0,0,0.05)] p-8">
            <div class="flex flex-col gap-6" v-if="!loading">
                <div class="flex flex-col gap-2 max-w-lg">
                    <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">Site Name</label>
                    <InputText v-model="configsMap.site_name.value" placeholder="..." class="w-full bg-[#fafafc] border-[3px] border-[rgba(0,0,0,0.04)] py-2 px-3 rounded-[11px] text-[14px] focus:outline-none focus:border-apple-blue transition-colors" />
                </div>
            </div>
            <div v-else class="text-[14px] opacity-60">Loading...</div>
        </div>
    </div>
</template>
