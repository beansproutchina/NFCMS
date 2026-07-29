<script setup lang="ts">
import { ref } from 'vue';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import { LucideImage } from 'lucide-vue-next';
import { SELECT_PT, INPUT_CLASS } from '../../ui/presets';

/**
 * Article property panel — the single definition of the article's content fields, mounted
 * twice by Editor.vue (desktop sidebar + mobile drawer). `form` is the parent's reactive
 * object, so field edits land straight on it.
 * Lifecycle (status / publish_at) is NOT here: it goes through ContentLifecycleController.
 */
defineProps<{
    form: any;
    categoryOptions: { label: string; value: any }[];
    articleDataFields: { key: string; title: string; type: string }[];
}>();

const emit = defineEmits<{
    (e: 'upload-thumbnail', event: Event): void;
    (e: 'upload-attachment', fieldKey: string, event: Event): void;
}>();

// The input lives in this component's template, so the ref belongs here too.
const thumbnailInput = ref<HTMLInputElement | null>(null);
</script>

<template>
    <div class="mt-4">
        <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-2">{{ $t('form.category_id')
            || 'Category ID' }} <span class="text-red-500">*</span></label>
        <Select v-model.number="form.category_id" :options="categoryOptions" optionLabel="label"
            optionValue="value" unstyled :pt="SELECT_PT" class="w-full" />
    </div>

    <div class="mt-4">
        <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)] mb-2">{{
            $t('form.content_template') || 'Local Template' }}</label>
        <InputText unstyled v-model="form.content_template" placeholder="e.g. DefaultArticle"
            :class="INPUT_CLASS" />
    </div>

    <div class="mt-4 flex items-center justify-between">
        <label class="block text-[14px] font-medium text-[rgba(0,0,0,0.8)]">{{ $t('form.is_top') || 'Is Top'
        }}</label>
        <input v-model="form.is_top" type="checkbox" :true-value="1" :false-value="0"
            class="h-5 w-5 rounded border-[rgba(0,0,0,0.15)]" />
    </div>

    <div class="mt-4 flex flex-col gap-6">
        <div class="flex flex-col gap-2">
            <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">{{ $t('form.thumbnail') ||
                'Thumbnail' }}</label>
            <div class="relative w-full aspect-video border-2 border-dashed border-[rgba(0,0,0,0.15)] rounded-[12px] flex items-center justify-center overflow-hidden hover:border-apple-blue transition-colors cursor-pointer group"
                @click="thumbnailInput?.click()">
                <input type="file" ref="thumbnailInput" class="hidden" accept="image/*"
                    @change="emit('upload-thumbnail', $event)" />
                <img v-if="form.thumbnail" :src="form.thumbnail" class="w-full h-full object-cover" />
                <div v-else
                    class="text-center text-[rgba(0,0,0,0.4)] group-hover:text-apple-blue transition-colors flex flex-col items-center">
                    <LucideImage :size="24" class="mb-2 opacity-50 group-hover:opacity-100" />
                    <span class="text-[13px] font-medium">{{ $t('action.upload') || 'Click to Upload'
                    }}</span>
                </div>
            </div>
            <div v-if="form.thumbnail" class="text-right">
                <span @click.stop="form.thumbnail = ''"
                    class="text-[12px] text-red-500 cursor-pointer hover:underline">{{ $t('action.remove')
                        || 'Remove' }}</span>
            </div>
        </div>

        <div class="flex flex-col gap-2">
            <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">{{ $t('form.urlSlug') }}</label>
            <InputText unstyled v-model="form.slug" placeholder="my-awesome-post"
                :class="INPUT_CLASS" />
        </div>

        <div class="flex flex-col gap-2">
            <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">{{ $t('form.description') ||
                'Description' }}</label>
            <Textarea unstyled v-model="form.description" rows="4" placeholder="..."
                class="w-full border border-[rgba(0,0,0,0.04)] py-2 px-3 rounded-[11px] text-[14px] focus:outline-none focus:border-apple-blue transition-colors resize-none"></Textarea>
        </div>

        <!-- Dynamic article data fields from category definition -->
        <template v-if="articleDataFields.length > 0">
            <div v-for="field in articleDataFields" :key="field.key" class="flex flex-col gap-2">
                <label class="text-[14px] text-[rgba(0,0,0,0.8)] font-medium">{{ field.title }}</label>

                <!-- text -->
                <InputText v-if="field.type === 'text'" unstyled v-model="form.data[field.key]"
                    :placeholder="field.title" :class="INPUT_CLASS" />

                <!-- textarea -->
                <Textarea v-else-if="field.type === 'textarea'" unstyled v-model="form.data[field.key]"
                    :placeholder="field.title" rows="3"
                    class="w-full border border-[rgba(0,0,0,0.04)] py-2 px-3 rounded-[11px] text-[14px] focus:outline-none focus:border-apple-blue transition-colors resize-none" />

                <!-- number -->
                <InputText v-else-if="field.type === 'number'" unstyled v-model="form.data[field.key]"
                    type="number" :placeholder="field.title" :class="INPUT_CLASS" />

                <!-- attachment -->
                <div v-else-if="field.type === 'attachment'" class="flex flex-col gap-2">
                    <div v-if="form.data[field.key]"
                        class="flex items-center gap-2 bg-[#f5f5f7] rounded-[8px] px-3 py-2">
                        <img v-if="/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(form.data[field.key])"
                            :src="form.data[field.key]" class="h-10 w-10 object-cover rounded" />
                        <a :href="form.data[field.key]" target="_blank"
                            class="text-[13px] text-apple-blue hover:underline truncate flex-1">{{ form.data[field.key].split('/').pop() }}</a>
                        <span @click="form.data[field.key] = ''"
                            class="text-[12px] text-red-500 cursor-pointer hover:underline">{{ $t('action.remove') || 'Remove' }}</span>
                    </div>
                    <label v-else
                        class="relative w-full h-10 border-2 border-dashed border-[rgba(0,0,0,0.15)] rounded-[8px] flex items-center justify-center hover:border-apple-blue transition-colors cursor-pointer text-[13px] text-[rgba(0,0,0,0.5)]">
                        <input type="file" class="hidden" @change="emit('upload-attachment', field.key, $event)" />
                        {{ $t('action.upload') || 'Upload' }}
                    </label>
                </div>
            </div>
        </template>
    </div>
</template>
