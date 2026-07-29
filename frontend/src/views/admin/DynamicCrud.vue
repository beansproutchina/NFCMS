<template>
  <div class="max-w-7xl mx-auto py-10 w-full px-6">
    <div class="flex justify-between items-end mb-8">
      <div>
        <h1 class="text-title-page font-semibold leading-title tracking-tight mb-2">{{ schemaName }} Management</h1>
        <p class="text-label-3">Managing records dynamically.</p>
      </div>
      <Button unstyled @click="openForm()" class="bg-accent hover:bg-link text-white px-5 py-2.5 rounded-full font-medium transition-colors">
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
          <span v-else class="px-2 py-1 rounded text-small uppercase font-medium bg-gray-100">{{ data[f.name] ? 'Yes' : 'No' }}</span>
      </template>

      <template #actions="{ data }">
        <div class="flex justify-end gap-3 text-body">
          <Button unstyled @click="openForm(data)" class="text-accent hover:underline">Edit</Button>
          <Button unstyled @click="deleteRecord(data)" class="text-red-500 hover:underline">Delete</Button>
        </div>
      </template>
    </SmartTable>


    <!-- Modal Form -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim backdrop-blur-sm overflow-y-auto pt-20 pb-20">
      <div class="bg-white rounded-card w-full max-w-2xl shadow-2xl p-8 relative">
        <h2 class="text-[28px] font-display font-semibold mb-6 tracking-tight">{{ isEditing ? 'Edit Record' : 'New Record' }}</h2>
        
        <form @submit.prevent="saveRecord" class="space-y-5">
          <div v-for="field in currentSchema?.fields || []" :key="field.name">
            <label class="block text-body font-medium text-label mb-2">{{ field.name }} <span v-if="field.type" class="text-small text-gray-400">({{ field.type }})</span></label>
            
            <InputText unstyled v-if="field.type === 'string' || field.type === 'date'"
                   v-model="formData[field.name]"
                   :class="INPUT_CLASS" />
            
            <InputText unstyled v-else-if="field.type === 'int' || field.type === 'float'"
                   v-model.number="formData[field.name]"
                   :class="INPUT_CLASS" />
                   
            <label v-else-if="field.type === 'boolean'" class="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" v-model="formData[field.name]" class="w-5 h-5 accent-accent text-accent border-gray-300 rounded focus:ring-2 focus:ring-accent">
              <span class="text-body text-label">Enabled/True</span>
            </label>

            <Textarea unstyled v-else-if="field.type === 'object'" 
                      v-model="formData[field.name]" 
                      class="w-full min-h-[120px] p-4 border border-divider rounded-control focus:border-accent focus:ring-1 font-mono text-small"
                      placeholder="{}"></Textarea>
          </div>
          
          <div class="flex justify-end gap-3 pt-6 mt-8 border-t border-separator-weak">
            <Button unstyled type="button" @click="showModal = false" class="px-6 py-2.5 rounded-full hover:bg-canvas text-label transition-colors font-medium">Cancel</Button>
            <Button unstyled type="submit" class="bg-accent hover:bg-link text-white px-6 py-2.5 rounded-full transition-colors font-medium">Save Record</Button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { schemaAPI, crud } from '../../api';
import { INPUT_CLASS } from '../../ui/presets';

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
    const res = await schemaAPI.getAll();
    currentSchema.value = (res.data || []).find((s: any) => s.tableName === schemaName.value || s.routePath === schemaName.value);
    
    if (currentSchema.value) {
      const dataRes = await crud(currentSchema.value.routePath).list();
      dataList.value = dataRes.data || [];
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
            await crud(currentSchema.value.routePath).update(id, payload);
        } else {
            await crud(currentSchema.value.routePath).create(payload);
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
        await crud(currentSchema.value.routePath).remove(id);
        fetchSchemaAndData();
    } catch (e) {
        alert('Delete failed');
    }
};
</script>
