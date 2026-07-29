<script setup lang="ts">
import { ref, onMounted } from 'vue';
import SmartTable from '../../components/SmartTable.vue';
import { schemaAPI } from '../../api';


const schemas = ref([]);
const loading = ref(true);

const fetchSchemas = async () => {
    loading.value = true;
    try {
        const res = await schemaAPI.getAll();
        schemas.value = res.data || [];
    } catch(e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};



onMounted(fetchSchemas);
</script>

<template>
    <div class="max-w-7xl mx-auto py-10 w-full px-6">
        <div class="flex justify-between items-end mb-8">
            <div>
                <h1 class="text-[40px] font-semibold leading-[1.1] tracking-tight mb-2">{{ $t('system.schemas') }}</h1>
            </div>
        </div>

        
        <SmartTable 
            :data="schemas" 
            :loading="loading" 
            dataKey="modelName"
            :columns="[
                { field: 'modelName', header: 'Model Name', sortable: true, style: 'width: 20%' },
                { field: 'routePath', header: 'API Path', sortable: true, style: 'width: 20%' },
                { field: 'fields', header: 'Fields Count', sortable: true, style: 'width: 15%' }
            ]"
        >
            <template #modelName="{ data }">
                <span class="font-semibold text-label text-[17px] tracking-tight">{{ data.modelName }}</span>
            </template>
            <template #routePath="{ data }">
                <span class="text-gray-500 font-mono text-[14px]">/api/{{ data.routePath }}</span>
            </template>
            <template #fields="{ data }">
                <span class="bg-[#f5f5f7] px-3 py-1 rounded-[6px] text-[13px] font-medium">{{ data.fields.length }} <span class="opacity-50">fields</span></span>
            </template>
            <template #actions="{ data }">
                <router-link :to="`/admin/crud/${data.routePath}`" class="text-accent hover:underline font-medium text-[14px]">
                    Manage Data
                </router-link>
            </template>
        </SmartTable>

    </div>
</template>
