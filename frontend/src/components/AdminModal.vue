<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-label-3 backdrop-blur-sm p-4">
    <div class="bg-white rounded-card w-full shadow-2xl flex flex-col max-h-[90vh] relative" :class="widthClass">
      <div class="p-6 border-b border-[rgba(0,0,0,0.05)] flex justify-between items-center">
        <h2 class="text-[21px] font-display font-semibold">{{ title }}</h2>
        <Button unstyled @click="$emit('close')" class="text-gray-400 hover:text-black focus:outline-none transition-colors">✕</Button>
      </div>

      <div class="p-6 overflow-y-auto flex-1 bg-surface">
        <slot></slot>
      </div>

      <div class="p-6 border-t border-[rgba(0,0,0,0.05)] bg-white rounded-b-card flex justify-end gap-3">
        <Button @click="$emit('close')" unstyled class="px-5 py-2 border border-[rgba(0,0,0,0.15)] text-[rgba(0,0,0,0.8)] rounded-control hover:bg-[rgba(0,0,0,0.05)] focus:outline-none transition-colors font-medium border-transparent">{{ $t('action.cancel') || 'Cancel' }}</Button>
        <Button @click="$emit('save')" unstyled class="px-5 py-2 bg-accent text-white rounded-control hover:bg-[#0077ED] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none transition-colors font-medium flex items-center justify-center gap-2" :disabled="disableSave">{{ saveText || $t('action.save') }}</Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button';

defineProps({
  title: {
    type: String,
    required: true
  },
  widthClass: {
    type: String,
    default: 'max-w-lg'
  },
  disableSave: {
    type: Boolean,
    default: false
  },
  saveText: {
    type: String,
    default: ''
  }
});

defineEmits(['close', 'save']);
</script>
