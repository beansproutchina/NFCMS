<template>
  <div class="max-w-7xl mx-auto py-10 w-full px-6">
    <div class="mb-8 flex justify-between items-end">
      <div>
        <h1 class="text-[40px] font-semibold leading-[1.1] tracking-tight mb-2">{{ $t('system.menus') }}</h1>
      </div>
      <div>
        <Button unstyled @click="openEditor()" class="bg-apple-blue hover:bg-[#0077ED] text-white flex items-center justify-center gap-2 px-4 py-2 rounded-[8px] text-[15px] font-medium transition-colors border border-transparent focus:outline-none cursor-pointer">
          <LucidePlus :size="16" /> {{ $t('action.new') }}
        </Button>
      </div>
    </div>

    <SmartTable
      :data="menus"
      :loading="loading"
      :paginator="false"
      :columns="columns"
    >
      <template #actions="{ data }">
        <div class="flex gap-2">
            <Button unstyled @click="openEditor(data)" class="text-apple-link hover:underline text-[14px] flex items-center cursor-pointer">
                {{ $t('action.edit') }}
            </Button>
            <Button unstyled @click="deleteMenu(data.id)" class="text-red-500 hover:underline text-[14px] flex items-center cursor-pointer">
                {{ $t('action.delete') }}
            </Button>
        </div>
      </template>
    </SmartTable>

    <MenuEditor
        v-if="showModal"
        :initial-data="editingItem"
        :is-editing="!!editingItem?.id"
        @close="showModal = false"
        @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { LucidePlus } from 'lucide-vue-next';

import { ref, onMounted } from 'vue';
import Button from 'primevue/button';
import { useI18n } from 'vue-i18n';
import SmartTable from '../../components/SmartTable.vue';
import { crudAPI } from '../../api';
import MenuEditor from './MenuEditor.vue';
import { useToast } from 'primevue/usetoast';

const { t } = useI18n();
const toast = useToast();

const columns = [
  { field: 'name', header: t('form.name') },
  { field: 'location', header: t('form.locationKey') || 'Location' },
];

const menus = ref([]);
const loading = ref(true);
const showModal = ref(false);
const editingItem = ref<any>(null);

const fetchMenus = async () => {
    loading.value = true;
    try {
        const res: any = await crudAPI.getList('menus');
        menus.value = res.data || res || [];
    } catch(e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

onMounted(fetchMenus);

const openEditor = (item?: any) => {
    editingItem.value = item ? { ...item } : { name: '', location: '', items: [] };
    showModal.value = true;
};

const deleteMenu = async (id: number) => {
    if (confirm(t('action.confirmDelete'))) {
        try {
            await crudAPI.remove('menus', id);
            toast.add({ severity: 'success', summary: 'Success', detail: '菜单删除成功', life: 3000 });
            fetchMenus();
        } catch (e) {
            console.error('Delete failed', e);
        }
    }
};

const handleSave = async (formData: any) => {
    try {
        if (formData.id) {
            await crudAPI.update('menus', formData.id, formData);
            toast.add({ severity: 'success', summary: 'Success', detail: '菜单更新成功', life: 3000 });
        } else {
            await crudAPI.create('menus', formData);
            toast.add({ severity: 'success', summary: 'Success', detail: '菜单创建成功', life: 3000 });
        }
        showModal.value = false;
        fetchMenus(); // Refresh table instead of reloading page
    } catch (e) {
        console.error('Save failed', e);
    }
};
</script>
