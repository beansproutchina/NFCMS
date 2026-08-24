<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-scrim backdrop-blur-sm p-4">
    <div class="bg-white rounded-card w-full shadow-2xl flex flex-col max-h-[90vh] relative" :class="widthClass">
      <div class="p-6 border-b border-separator-weak flex justify-between items-center">
        <h2 :class="SECTION_TITLE">{{ title }}</h2>
        <Button unstyled @click="$emit('close')" :class="DIALOG_CLOSE">✕</Button>
      </div>

      <div class="p-6 overflow-y-auto flex-1 bg-surface">
        <slot></slot>
      </div>

      <!-- Buttons come from BTN, never hand-written: this footer having its own padding and its own
           borderless cancel is exactly why the two dialogs stopped matching. -->
      <div class="p-6 border-t border-separator-weak bg-white rounded-b-card flex justify-end gap-3">
        <Button @click="$emit('close')" unstyled :class="BTN.secondary">{{ cancelText || $t('action.cancel') || 'Cancel' }}</Button>
        <!-- `hideSave` 给那些**动作不止一个**的对话框用(如定时发布:立即/更新/取消),它们把动作
             放在正文里,footer 只留一个关闭。 -->
        <Button v-if="!hideSave" @click="$emit('save')" unstyled :class="BTN.primary" :disabled="disableSave">{{ saveText || $t('action.save') }}</Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button';
import { BTN, DIALOG_CLOSE, SECTION_TITLE } from '../ui/presets';

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
  },
  /** 隐藏 footer 的主按钮 —— 正文里自带多个动作时用。 */
  hideSave: {
    type: Boolean,
    default: false
  },
  /** 覆盖 footer 取消按钮的文字(如改成「关闭」,免得和「取消定时」撞车)。 */
  cancelText: {
    type: String,
    default: ''
  }
});

defineEmits(['close', 'save']);
</script>
