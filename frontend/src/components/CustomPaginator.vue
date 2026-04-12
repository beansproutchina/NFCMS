<template>
  <Paginator 
    v-bind="$attrs"
    unstyled
    :pt="customPaginatorPt"
    :rowsPerPageOptions="[10, 20, 50]"
    template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
    currentPageReportTemplate="{first} / {last} , {totalRecords}"
    class="w-full text-left font-text"
  >
  </Paginator>
</template>

<script setup lang="ts">
import Paginator from 'primevue/paginator';
import { customPaginatorPt } from './CustomPaginator';
</script>
