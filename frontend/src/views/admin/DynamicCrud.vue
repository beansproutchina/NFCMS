<template>
  <div class="max-w-7xl mx-auto py-10 w-full px-6">
    <div class="flex justify-between items-end mb-8">
      <div>
        <h1 class="text-[40px] font-semibold leading-[1.1] tracking-tight mb-2">{{ schemaName }} Management</h1>
        <p class="text-[rgba(0,0,0,0.5)]">Managing records dynamically.</p>
      </div>
      <Button unstyled @click="openForm()" class="bg-apple-blue hover:bg-[#0066cc] text-white px-5 py-2.5 rounded-[980px] font-medium transition-colors">
        New Record
      </Button>
    </div>

    <!-- Data Table -->
    
    <!-- Data Table -->
    <SmartTable 
      :data="dataList" 
      :loading="loading"
      :columns="displayFields.map((f: any) => ({ field: f.name, header: f.name, sortable: true }))"
      dataKey="id"
    >
      <!-- Dynamic rendering based on field arrays -->
      <template v-for="f in displayFields" :key="f.name" #[f.name]="{ data }">
          <span class="truncate max-w-[200px] block" v-if="f.type !== 'boolean'">{{ data[f.name] }}</span>
          <span v-else class="px-2 py-1 rounded text-[12px] uppercase font-medium bg-gray-100">{{ data[f.name] ? 'Yes' : 'No' }}</span>
      </template>

      <template #actions="{ data }">
        <div class="flex justify-end gap-3 text-[14px]">
          <Button unstyled @click="openForm(data)" class="text-apple-blue hover:underline">Edit</Button>
          <Button unstyled @click="deleteRecord(data)" class="text-red-500 hover:underline">Delete</Button>
        </div>
      </template>
    </SmartTable>


    <!-- Modal Form -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(0,0,0,0.4)] backdrop-blur-sm overflow-y-auto pt-20 pb-20">
      <div class="bg-white rounded-[12px] w-full max-w-2xl shadow-2xl p-8 relative">
        <h2 class="text-[28px] font-display font-semibold mb-6 tracking-tight">{{ isEditing ? 'Edit Record' : 'New Record' }}</h2>
        
        <form @submit.prevent="saveRecord" class="space-y-5">
          <div v-for="field in currentSchema?.fields || []" :key="field.name">
            <label class="block text-[15px] font-medium text-[rgba(0,0,0,0.8)] mb-2">{{ field.name }} <span v-if="field.type" class="text-[12px] text-gray-400">({{ field.type }})</span></label>
            
            <InputText unstyled v-if="field.type === 'string' || field.type === 'date'"
                   v-model="formData[field.name]" 
                   class="w-full h-11 px-4 border border-[#d2d2d7] rounded-[8px] focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue transition-all hover:bg-white focus:bg-white" />
            
            <InputText unstyled v-else-if="field.type === 'int' || field.type === 'float'"
                   v-model.number="formData[field.name]" 
                   class="w-full h-11 px-4 border border-[#d2d2d7] rounded-[8px] focus:outline-none focus:border-apple-blue transition-all" />
                   
            <label v-else-if="field.type === 'boolean'" class="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" v-model="formData[field.name]" class="w-5 h-5 accent-apple-blue text-apple-blue border-gray-300 rounded focus:ring-2 focus:ring-apple-blue">
              <span class="text-[15px] text-[#1d1d1f]">Enabled/True</span>
            </label>

            <Textarea unstyled v-else-if="field.type === 'object'" 
                      v-model="formData[field.name]" 
                      class="w-full min-h-[120px] p-4 border border-[#d2d2d7] rounded-[8px] focus:border-apple-blue focus:ring-1 font-mono text-[13px]"
                      placeholder="{}"></Textarea>
          </div>
          
          <div class="flex justify-end gap-3 pt-6 mt-8 border-t border-[rgba(0,0,0,0.05)]">
            <Button unstyled type="button" @click="showModal = false" class="px-6 py-2.5 rounded-[980px] hover:bg-[#f5f5f7] text-[#1d1d1f] transition-colors font-medium">Cancel</Button>
            <Button unstyled type="submit" class="bg-apple-blue hover:bg-[#0066cc] text-white px-6 py-2.5 rounded-[980px] transition-colors font-medium">Save Record</Button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { schemaAPI, crudAPI } from '../../api';

const route = useRoute();
const schemaName = computed(() => route.params.modelName as string);

const currentSchema = ref<any>(null);
const dataList = ref<any[]>([]);
const loading = ref(true);

const displayFields = computed(() => {
  if (!currentSchema.value) return [];
  // return up to 5 simple fields to display in list view
  return currentSchema.value.fields.filter((f: any) => f.name !== 'content' && f.name !== 'data').slice(0, 6);
});

const fetchSchemaAndData = async () => {
  loading.value = true;
  try {
    const res: any = await schemaAPI.getAll();
    currentSchema.value = (res.data || res || []).find((s: any) => s.tableName === schemaName.value || s.routePath === schemaName.value);
    
    if (currentSchema.value) {
      const dataRes: any = await crudAPI.getList(currentSchema.value.routePath);
      dataList.value = dataRes.data || dataRes || [];
    }
  } catch(e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

watch(() => route.params.modelName, fetchSchemaAndData);
onMounted(fetchSchemaAndData);

const showModal = ref(false);
const isEditing = ref(false);
const formData = ref<any>({});

const openForm = (row?: any) => {
  if (row) {
    isEditing.value = true;
    formData.value = { ...row };
    // Process JSON fields
    currentSchema.value.fields.forEach((f: any) => {
      if (f.type === 'object' && typeof formData.value[f.name] !== 'string') {
         formData.value[f.name] = JSON.stringify(formData.value[f.name], null, 2);
      }
    });
  } else {
    isEditing.value = false;
    formData.value = {};
    currentSchema.value.fields.forEach((f: any) => {
      if (f.defaultValue !== undefined) formData.value[f.name] = f.defaultValue;
    });
  }
  showModal.value = true;
};

const saveRecord = async () => {
    const payload = { ...formData.value };
    currentSchema.value.fields.forEach((f: any) => {
        if (f.type === 'object' && typeof payload[f.name] === 'string') {
            try { payload[f.name] = JSON.parse(payload[f.name] || '{}'); } catch(e) { /* ignore */ }
        }
    });

    try {
        const id = payload.uid || payload.id;
        if (isEditing.value && id) {
            await crudAPI.update(currentSchema.value.routePath, id, payload);
        } else {
            await crudAPI.create(currentSchema.value.routePath, payload);
        }
        showModal.value = false;
        fetchSchemaAndData();
    } catch (e) {
        alert('Save failed');
        console.error(e);
    }
};

const deleteRecord = async (id: string|number) => {
    if (!confirm('Delete this record forever?')) return;
    try {
        await crudAPI.remove(currentSchema.value.routePath, id);
        fetchSchemaAndData();
    } catch (e) {
        alert('Delete failed');
    }
};
</script>
