<script setup lang="ts">
import { ref, watch } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import { uploadAPI } from '../api';
import { LucideSearch, LucideX, LucideFile, LucideCheck } from 'lucide-vue-next';
import { BTN, BTN_SMALL, DIALOG_CLOSE, EMPTY, INPUT_CLASS, SEARCH, SECTION_TITLE } from '../ui/presets';

/**
 * File-library picker overlay. Same shape as UserPicker.vue (paged search + `visible`/`select`
 * contract) — it lists rows from /api/attachments and hands the picked attachment row(s) back.
 * `accept` is a client-side soft filter only: the backend list endpoint has no mime parameter.
 */
const props = defineProps<{ visible: boolean; accept?: string; multiple?: boolean }>();
const emit = defineEmits<{
    (e: 'update:visible', v: boolean): void;
    (e: 'select', rows: any[]): void;   // always an array; length 1 unless `multiple`
}>();

const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp|svg)$/i;

const q = ref('');
const page = ref(0);          // 0-indexed (DYAPI paging)
const limit = 12;
const files = ref<any[]>([]);
const total = ref(0);
const loading = ref(false);
const picked = ref<any[]>([]);

const pages = () => Math.max(1, Math.ceil(total.value / limit));

/** `accept` tokens: 'image/*' (mime prefix), 'image/png' (exact mime), '.png' (extension). */
const matchesAccept = (row: any) => {
    const acc = (props.accept || '').trim();
    if (!acc) return true;
    const mime = String(row?.mime_type || '');
    const name = String(row?.filename || '').toLowerCase();
    return acc.split(',').map((s) => s.trim()).filter(Boolean).some((tok) => {
        if (tok.endsWith('/*')) return mime.startsWith(tok.slice(0, -1));
        if (tok.startsWith('.')) return name.endsWith(tok.toLowerCase());
        return mime === tok;
    });
};

const load = async () => {
    loading.value = true;
    try {
        const params: any = { page: page.value, limit, orderBy: 'id', orderDesc: true };
        if (q.value.trim()) params.filter = { $or: { filename: { $contains: q.value.trim() } } };
        const res = await uploadAPI.getList(params);
        files.value = (res.data || []).filter(matchesAccept);
        total.value = res.total;   // full match count for pagination (not the filtered page length)
    } catch (e) { console.error(e); files.value = []; } finally { loading.value = false; }
};

const search = () => { page.value = 0; load(); };
const prev = () => { if (page.value > 0) { page.value--; load(); } };
const next = () => { if (page.value < pages() - 1) { page.value++; load(); } };

const close = () => emit('update:visible', false);

const isPicked = (row: any) => picked.value.some((r) => r.id === row.id);

const pick = (row: any) => {
    if (props.multiple) {
        const i = picked.value.findIndex((r) => r.id === row.id);
        if (i >= 0) picked.value.splice(i, 1); else picked.value.push(row);
        return;
    }
    emit('select', [row]);
    close();
};

const confirmMulti = () => {
    if (!picked.value.length) return;
    emit('select', [...picked.value]);
    close();
};

// (Re)load whenever the overlay opens.
watch(() => props.visible, (v) => { if (v) { q.value = ''; page.value = 0; picked.value = []; load(); } });
</script>

<template>
    <div v-if="visible" class="fixed inset-0 z-60 flex items-center justify-center bg-scrim backdrop-blur-sm p-4" @click.self="close">
        <div class="bg-white rounded-card w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
            <div class="p-5 border-b border-separator-weak flex items-center justify-between">
                <h2 :class="SECTION_TITLE">{{ $t('fileUploader.pickTitle') }}</h2>
                <Button unstyled @click="close" :class="DIALOG_CLOSE"><LucideX :size="18" /></Button>
            </div>

            <div class="p-5 flex flex-col gap-3 overflow-y-auto">
                <div class="relative">
                    <LucideSearch :size="16" :class="SEARCH.icon" />
                    <InputText v-model="q" unstyled :placeholder="$t('fileUploader.search')" :class="[INPUT_CLASS, SEARCH.input]" @keyup.enter="search" @input="search" />
                </div>

                <div class="min-h-[260px]">
                    <div v-if="loading" :class="EMPTY">{{ $t('system.loading') }}</div>
                    <div v-else-if="!files.length" :class="EMPTY">{{ $t('fileUploader.empty') }}</div>
                    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        <button v-for="f in files" :key="f.id" @click="pick(f)" type="button"
                            class="relative text-left border rounded-control overflow-hidden hover:border-accent transition-colors cursor-pointer"
                            :class="isPicked(f) ? 'border-accent ring-1 ring-accent' : 'border-separator-weak'">
                            <span class="h-24 bg-canvas flex items-center justify-center overflow-hidden">
                                <img v-if="f.mime_type?.startsWith('image/') || IMAGE_RE.test(f.url || '')" :src="f.url" class="object-cover w-full h-full" />
                                <LucideFile v-else :size="28" class="text-label-4" />
                            </span>
                            <span class="block px-2 py-1.5 text-small truncate text-label-2" :title="f.filename">{{ f.filename }}</span>
                            <span v-if="isPicked(f)" class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center">
                                <LucideCheck :size="12" />
                            </span>
                        </button>
                    </div>
                </div>

                <div class="flex items-center justify-between pt-1">
                    <Button unstyled @click="prev" :disabled="page === 0" :class="BTN_SMALL.pager">{{ $t('common.prev') }}</Button>
                    <span class="text-small text-label-3">{{ page + 1 }} / {{ pages() }}</span>
                    <Button unstyled @click="next" :disabled="page >= pages() - 1" :class="BTN_SMALL.pager">{{ $t('common.next') }}</Button>
                </div>

                <div v-if="multiple" class="flex items-center justify-end gap-3 pt-2 border-t border-separator-weak">
                    <span class="text-small text-label-3">{{ $t('fileUploader.selectedN', { n: picked.length }) }}</span>
                    <Button unstyled @click="confirmMulti" :disabled="!picked.length" :class="BTN.primary">{{ $t('confirm.accept') }}</Button>
                </div>
            </div>
        </div>
    </div>
</template>
