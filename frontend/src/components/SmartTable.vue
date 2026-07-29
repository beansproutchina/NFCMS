<template>
  <div class="relative" :class="CARD">
    <DataTable 
      v-bind="$attrs"
      :value="data" 
      :loading="loading" 
      :paginator="paginator" 
      :rows="rows" 
      :dataKey="dataKey"
      :globalFilterFields="globalFilterFields"
      :filters="filters"
      :lazy="lazy"
      :totalRecords="totalRecords"
      :rowsPerPageOptions="[10, 20, 50]"
      paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
      currentPageReportTemplate="{first} - {last} , {totalRecords}"
      responsiveLayout="scroll"
      unstyled
      class="w-full text-left font-text text-body"
      :pt="tablePt"
    >
      <slot name="default">
        <!-- Render columns dynamically if 'columns' prop is passed -->
        <Column v-for="col in columns" :key="col.field" 
                :field="col.field" 
                :header="col.header" 
                :sortable="col.sortable" 
                :style="col.style" 
                :pt="columnPt">
          <template #body="{ data }" v-if="$slots[col.field]">
            <slot :name="col.field" :data="data"></slot>
          </template>
        </Column>

        <!-- Generic Actions Column -->
        <Column v-if="hasActions" :header="$t('form.actions')" :exportable="false" :style="actionStyle" :pt="columnPt">
          <template #body="slotProps">
            <slot name="actions" :data="slotProps.data"></slot>
          </template>
        </Column>
      </slot>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import { CARD } from '../ui/presets';
import type { PropType } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import { customPaginatorPt } from './CustomPaginator';

defineProps({
  lazy: { type: Boolean, default: false },
  totalRecords: { type: Number, default: 0 },
  data: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  paginator: { type: Boolean, default: true },
  rows: { type: Number, default: 10 },
  dataKey: { type: String, default: 'id' },
  globalFilterFields: { type: Array as PropType<string[]>, default: () => [] },
  filters: { type: Object, default: () => ({}) },
  columns: { type: Array as PropType<{ field: string, header: string, sortable?: boolean, style?: string }[]>, default: () => [] },
  hasActions: { type: Boolean, default: true },
  actionStyle: { type: String, default: 'min-width: 8rem; width: 15%' }
});

const tablePt = {
    root: { class: 'w-full text-left relative' },
    wrapper: { class: 'relative' },
    table: { class: 'min-w-full border-collapse table-fixed' },
    thead: { class: 'bg-canvas border-b border-separator-weak' },
    headerRow: { class: 'text-body' },
    tbody: { class: 'bg-white relative' },
    bodyRow: { class: 'hover:bg-surface transition-colors text-body border-b border-separator-weak' },
    pcPaginator: customPaginatorPt as any,
    mask: { class: 'absolute top-0 left-0 right-0 bottom-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center min-h-[150px]' },
    loadingIcon: { class: 'w-10 h-10 text-accent animate-spin' }
};

const columnPt = {
    headerCell: { class: 'py-4 px-6 font-semibold text-label text-left whitespace-nowrap' },
    columnHeaderContent: { class: 'flex items-center gap-2 cursor-pointer hover:text-accent select-none' },
    sortIcon: { class: 'w-3 h-3 fill-current text-label-3' },
    bodyCell: { class: 'py-5 px-6 text-left align-middle truncate' },
};
</script>
