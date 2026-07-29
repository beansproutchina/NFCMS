<script setup lang="ts">
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import { FIELD_GROUP, INPUT_CLASS, LABEL, LABEL_BARE, SELECT_PT } from '../../ui/presets';
import FileUploader from '../../components/FileUploader.vue';

/**
 * Article property panel — the single definition of the article's content fields, mounted
 * twice by Editor.vue (desktop sidebar + mobile drawer). `form` is the parent's reactive
 * object, so field edits land straight on it.
 * Lifecycle (status / publish_at) is NOT here: it goes through ContentLifecycleController.
 * File fields are self-contained (FileUploader owns its input + upload), so this component
 * emits nothing.
 */
defineProps<{
    form: any;
    categoryOptions: { label: string; value: any }[];
    articleDataFields: { key: string; title: string; type: string }[];
}>();
</script>

<template>
    <div class="mt-4">
        <label :class="LABEL">{{ $t('form.category_id')
            || 'Category ID' }} <span class="text-danger">*</span></label>
        <Select v-model.number="form.category_id" :options="categoryOptions" optionLabel="label"
            optionValue="value" unstyled :pt="SELECT_PT" class="w-full" />
    </div>

    <div class="mt-4">
        <label :class="LABEL">{{
            $t('form.content_template') || 'Local Template' }}</label>
        <InputText unstyled v-model="form.content_template" placeholder="e.g. DefaultArticle"
            :class="INPUT_CLASS" />
    </div>

    <div class="mt-4 flex items-center justify-between">
        <label :class="LABEL_BARE">{{ $t('form.is_top') || 'Is Top'
        }}</label>
        <input v-model="form.is_top" type="checkbox" :true-value="1" :false-value="0"
            class="h-5 w-5 rounded border-separator" />
    </div>

    <div class="mt-4 flex flex-col gap-6">
        <div :class="FIELD_GROUP">
            <label :class="LABEL_BARE">{{ $t('form.thumbnail') ||
                'Thumbnail' }}</label>
            <FileUploader v-model="form.thumbnail" accept="image/*" size="lg" />
        </div>

        <div :class="FIELD_GROUP">
            <label :class="LABEL_BARE">{{ $t('form.urlSlug') }}</label>
            <InputText unstyled v-model="form.slug" placeholder="my-awesome-post"
                :class="INPUT_CLASS" />
        </div>

        <div :class="FIELD_GROUP">
            <label :class="LABEL_BARE">{{ $t('form.description') ||
                'Description' }}</label>
            <Textarea unstyled v-model="form.description" rows="4" placeholder="..."
                class="resize-none" :class="INPUT_CLASS"></Textarea>
        </div>

        <!-- Dynamic article data fields from category definition -->
        <template v-if="articleDataFields.length > 0">
            <div v-for="field in articleDataFields" :key="field.key" :class="FIELD_GROUP">
                <label :class="LABEL_BARE">{{ field.title }}</label>

                <!-- text -->
                <InputText v-if="field.type === 'text'" unstyled v-model="form.data[field.key]"
                    :placeholder="field.title" :class="INPUT_CLASS" />

                <!-- textarea -->
                <Textarea v-else-if="field.type === 'textarea'" unstyled v-model="form.data[field.key]"
                    :placeholder="field.title" rows="3"
                    class="resize-none" :class="INPUT_CLASS" />

                <!-- number -->
                <InputText v-else-if="field.type === 'number'" unstyled v-model="form.data[field.key]"
                    type="number" :placeholder="field.title" :class="INPUT_CLASS" />

                <!-- attachment (any file type) -->
                <FileUploader v-else-if="field.type === 'attachment'" v-model="form.data[field.key]" size="sm" />
            </div>
        </template>
    </div>
</template>
