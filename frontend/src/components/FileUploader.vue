<script setup lang="ts">
import { computed, ref } from 'vue';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { useI18n } from 'vue-i18n';
import { LucideUpload, LucideImage, LucideFile, LucideFolderOpen } from 'lucide-vue-next';
import { uploadAPI } from '../api';
import { BTN } from '../ui/presets';
import FilePicker from './FilePicker.vue';

/**
 * Generic file field. Owns its own <input type="file"> — callers never hold a DOM ref and
 * never build a FormData; they just bind a URL with v-model (or listen to `uploaded` in
 * `mode="button"`). Two ways in: upload a new file, or pick one from the library (FilePicker).
 */
const props = withDefaults(defineProps<{
    /** Bound URL(s). string when multiple=false, string[] when multiple=true. Unused in mode='button'. */
    modelValue?: string | string[];
    /** 'field' = preview box + actions (default). 'button' = bare upload button, no preview, no v-model write. */
    mode?: 'field' | 'button';
    multiple?: boolean;
    /** e.g. 'image/*'; '' = any type. */
    accept?: string;
    /** Offer the "choose from library" path. */
    library?: boolean;
    /** Preview size. 'lg' = 16:9 dropzone (thumbnail), 'md' = 96px square, 'sm' = one-line row. */
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    /** Override the button label; defaults to $t('action.upload'). */
    label?: string;
}>(), { mode: 'field', multiple: false, accept: '', library: true, size: 'md', disabled: false });

const emit = defineEmits<{
    (e: 'update:modelValue', v: string | string[]): void;
    /** Raw attachment rows just uploaded or picked — for callers needing id/filename. */
    (e: 'uploaded', rows: any[]): void;
}>();

const toast = useToast();
const confirm = useConfirm();
const { t } = useI18n();

const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp|svg)$/i;

const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const pickerVisible = ref(false);

/** Bound value normalised to a list, so one template covers single and multiple. */
const urls = computed<string[]>(() => {
    const v = props.modelValue;
    if (Array.isArray(v)) return v.filter(Boolean);
    return v ? [v] : [];
});

const isImage = (url: string) => IMAGE_RE.test(url);
const nameOf = (url: string) => url.split('/').pop() || url;

/** Dropzone stays available while multiple can still accept more files. */
const showDropzone = computed(() => props.mode === 'field' && (props.multiple || !urls.value.length));

const openFileDialog = () => { if (!props.disabled && !uploading.value) fileInput.value?.click(); };
const openLibrary = () => { if (!props.disabled && !uploading.value) pickerVisible.value = true; };

/** Write freshly uploaded/picked attachment rows back out. */
const apply = (rows: any[]) => {
    if (!rows?.length) return;
    emit('uploaded', rows);
    if (props.mode === 'button') return;                       // button mode never touches modelValue
    if (props.multiple) {
        emit('update:modelValue', [...urls.value, ...rows.map((r: any) => r.url)]);
    } else {
        emit('update:modelValue', rows[0].url);
    }
};

const onFilesSelected = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    uploading.value = true;
    try {
        const res = await uploadAPI.uploadFiles(input.files);
        apply(res?.data || []);
    } catch (e: any) {
        console.error(e);
        toast.add({ severity: 'error', summary: t('fileUploader.uploadFailed'), detail: e?.message || '', life: 4000 });
    } finally {
        uploading.value = false;
        input.value = '';   // otherwise re-picking the same file fires no `change`
    }
};

/** Clears the binding only — the file itself stays in the library. */
const removeAt = (i: number) => {
    confirm.require({
        header: t('confirm.title'),
        message: t('fileUploader.removeConfirm'),
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: t('confirm.accept'),
        rejectLabel: t('confirm.reject'),
        accept: () => {
            if (props.multiple) emit('update:modelValue', urls.value.filter((_, idx) => idx !== i));
            else emit('update:modelValue', '');
        },
    });
};

const BOX_CLASS = computed(() => (props.size === 'lg' ? 'w-full aspect-video' : 'w-24 h-24'));
</script>

<template>
    <div class="flex flex-col gap-2">
        <!-- The one and only file input: owned here, never exposed to callers. -->
        <input ref="fileInput" type="file" class="hidden" :accept="accept || undefined" :multiple="multiple" @change="onFilesSelected" />

        <!-- button mode: bare actions, no preview, no v-model write -->
        <div v-if="mode === 'button'" class="flex gap-3 items-center">
            <Button unstyled @click="openFileDialog" :disabled="disabled || uploading" :class="[BTN.primary, 'min-w-max']">
                <LucideUpload :size="16" /> {{ uploading ? $t('fileUploader.uploading') : (label || $t('action.upload')) }}
            </Button>
            <Button v-if="library" unstyled @click="openLibrary" :disabled="disabled || uploading" :class="[BTN.ghost, 'min-w-max']">
                <LucideFolderOpen :size="16" /> {{ $t('fileUploader.chooseFromLibrary') }}
            </Button>
        </div>

        <template v-else>
            <!-- one-line rows (size='sm') -->
            <template v-if="size === 'sm'">
                <div v-for="(u, i) in urls" :key="u + i" class="flex items-center gap-2 bg-[#f5f5f7] rounded-[8px] px-3 py-2">
                    <img v-if="isImage(u)" :src="u" class="h-10 w-10 object-cover rounded" />
                    <LucideFile v-else :size="18" class="text-[rgba(0,0,0,0.35)] shrink-0" />
                    <a :href="u" target="_blank" class="text-[13px] text-accent hover:underline truncate flex-1">{{ nameOf(u) }}</a>
                    <span v-if="!disabled && !multiple" @click="openFileDialog" class="text-[12px] text-accent cursor-pointer hover:underline shrink-0">{{ $t('fileUploader.replace') }}</span>
                    <span v-if="!disabled" @click="removeAt(Number(i))" class="text-[12px] text-red-500 cursor-pointer hover:underline shrink-0">{{ $t('action.remove') }}</span>
                </div>
            </template>

            <!-- preview boxes (size='md' | 'lg') -->
            <div v-else-if="urls.length" class="flex flex-wrap gap-3">
                <div v-for="(u, i) in urls" :key="u + i" class="flex flex-col gap-1">
                    <div :class="BOX_CLASS" class="relative border border-[rgba(0,0,0,0.1)] rounded-[12px] overflow-hidden bg-[#fafafa] flex items-center justify-center">
                        <img v-if="isImage(u)" :src="u" class="w-full h-full object-contain" />
                        <a v-else :href="u" target="_blank" class="flex flex-col items-center gap-1 p-2 text-[rgba(0,0,0,0.45)] hover:text-accent">
                            <LucideFile :size="22" />
                            <span class="text-[11px] max-w-full truncate">{{ nameOf(u) }}</span>
                        </a>
                    </div>
                    <div v-if="!disabled" class="flex gap-3 justify-end">
                        <span @click="openFileDialog" class="text-[12px] text-accent cursor-pointer hover:underline">{{ $t('fileUploader.replace') }}</span>
                        <span @click="removeAt(Number(i))" class="text-[12px] text-red-500 cursor-pointer hover:underline">{{ $t('action.remove') }}</span>
                    </div>
                </div>
            </div>

            <!-- empty dropzone (also the "add more" affordance when multiple) -->
            <div v-if="showDropzone"
                :class="[size === 'sm' ? 'w-full h-10' : BOX_CLASS, disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-accent']"
                class="relative border-2 border-dashed border-[rgba(0,0,0,0.15)] rounded-[12px] flex items-center justify-center overflow-hidden transition-colors group"
                @click="openFileDialog">
                <div class="text-center text-[rgba(0,0,0,0.4)] group-hover:text-accent transition-colors flex flex-col items-center">
                    <LucideImage v-if="size !== 'sm'" :size="24" class="mb-2 opacity-50 group-hover:opacity-100" />
                    <span class="text-[13px] font-medium">{{ uploading ? $t('fileUploader.uploading') : $t('fileUploader.dropHint') }}</span>
                </div>
            </div>

            <div v-if="library && !disabled" class="flex justify-start">
                <span @click.stop="openLibrary" class="text-[12px] text-accent cursor-pointer hover:underline inline-flex items-center gap-1">
                    <LucideFolderOpen :size="13" /> {{ $t('fileUploader.chooseFromLibrary') }}
                </span>
            </div>
        </template>

        <FilePicker v-model:visible="pickerVisible" :accept="accept" :multiple="multiple" @select="apply" />
    </div>
</template>
