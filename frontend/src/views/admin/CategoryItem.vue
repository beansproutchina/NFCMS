<template>
  <li class="mb-1">
    <div class="flex items-center justify-between p-3 bg-canvas rounded-control hover:bg-[#ebebeb] transition-colors group">
      <div class="flex items-center gap-3">
        <span class="font-medium text-label">{{ category.name }}</span>
        <span class="text-small text-[rgba(0,0,0,0.5)] font-mono">/{{ category.slug }}</span>
      </div>
      <div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
        <Button unstyled @click="$emit('edit', category)" class="text-link text-body font-medium hover:underline cursor-pointer">{{$t("action.edit")}}</Button>
        <Button unstyled @click="$emit('delete', category.id)" class="text-red-500 text-body font-medium hover:underline ml-2 cursor-pointer">{{$t("action.delete")}}</Button>
      </div>
    </div>
    
    <ul v-if="children.length" class="ml-6 mt-1 border-l-2 border-[rgba(0,0,0,0.05)] pl-4 space-y-1">
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


import { computed } from 'vue';

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
