<script setup lang="ts">
import { LINK, PAGE, TEXT } from '../../ui/presets';
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
    <div :class="PAGE.container">
        <div :class="PAGE.header">
            <div>
                <h1 :class="PAGE.title">{{ $t('system.schemas') }}</h1>
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
                <span class="font-semibold text-label text-title-item tracking-tight">{{ data.modelName }}</span>
            </template>
            <template #routePath="{ data }">
                <span class="font-mono" :class="TEXT.muted">/api/{{ data.routePath }}</span>
            </template>
            <template #fields="{ data }">
                <span class="bg-canvas px-3 py-1 rounded-control text-small font-medium">{{ data.fields.length }} <span class="opacity-50">fields</span></span>
            </template>
            <template #actions="{ data }">
                <router-link :to="`/admin/crud/${data.routePath}`" class="font-medium" :class="LINK.action">
                    Manage Data
                </router-link>
            </template>
        </SmartTable>

    </div>
</template>
