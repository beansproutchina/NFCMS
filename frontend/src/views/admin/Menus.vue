<template>
  <div :class="PAGE.container">
    <div :class="PAGE.header">
      <div>
        <h1 :class="PAGE.title">{{ $t('system.menus') }}</h1>
      </div>
      <div>
        <Button unstyled @click="openEditor()" :class="BTN.primary">
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
            <Button unstyled @click="openEditor(data)" :class="LINK.action">
                {{ $t('action.edit') }}
            </Button>
            <Button unstyled @click="deleteMenu(data.id)" :class="LINK.danger">
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
import { listMenu, createMenu, updateMenu, removeMenu } from '../../api';
import MenuEditor from './MenuEditor.vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { BTN, LINK, PAGE } from '../../ui/presets';

const { t } = useI18n();
const toast = useToast();
const confirm = useConfirm();

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
        const res = await listMenu();
        menus.value = res.data || [];
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
    confirm.require({
        header: t('confirm.title'), message: t('action.confirmDelete'),
        accept: async () => {
        try {
            await removeMenu(id);
            toast.add({ severity: 'success', summary: 'Success', detail: t('toast.menuDeleted'), life: 3000 });
            fetchMenus();
        } catch (e) {
            console.error('Delete failed', e);
        }
        },
    });
};

const handleSave = async (formData: any) => {
    try {
        if (formData.id) {
            await updateMenu(formData.id, formData);
            toast.add({ severity: 'success', summary: 'Success', detail: t('toast.menuUpdated'), life: 3000 });
        } else {
            await createMenu(formData);
            toast.add({ severity: 'success', summary: 'Success', detail: t('toast.menuCreated'), life: 3000 });
        }
        showModal.value = false;
        fetchMenus(); // Refresh table instead of reloading page
    } catch (e) {
        console.error('Save failed', e);
    }
};
</script>
