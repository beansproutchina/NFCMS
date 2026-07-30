<template>
  <li class="mb-1">
    <div class="flex items-center justify-between p-3 bg-canvas rounded-control hover:bg-surface-hover transition-colors group">
      <div class="flex items-center gap-3">
        <span class="font-medium text-label">{{ category.name }}</span>
        <span class="font-mono" :class="TEXT.caption">/{{ category.slug }}</span>
      </div>
      <div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
        <Button unstyled @click="$emit('edit', category)" :class="LINK.action">{{$t("action.edit")}}</Button>
        <Button unstyled @click="$emit('delete', category.id)" :class="LINK.danger" class="ml-2">{{$t("action.delete")}}</Button>
      </div>
    </div>
    
    <ul v-if="children.length" class="ml-6 mt-1 border-l-2 border-separator-weak pl-4 space-y-1">
      <CategoryItem 
        v-for="child in children" 
        :key="child.id" 
        :category="child" 
        :allCategories="allCategories"
        @edit="$emit('edit', $event)"
        @delete="$emit('delete', $event)"
      />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { LINK, TEXT } from '../../ui/presets';


import { computed } from 'vue';
import Button from 'primevue/button';

const props = defineProps<{
  category: any;
  allCategories: any[];
}>();

defineEmits(['edit', 'delete']);

const children = computed(() => {
  return props.allCategories
    .filter(c => c.parent_id === props.category.id)
    .sort((a, b) => (a.weight) - (b.weight));
});
</script>
