<script setup lang="ts">
import { ref, watch } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import { listUser } from '../api';
import { LucideSearch, LucideX, LucideUser } from 'lucide-vue-next';
import { BTN_SM, DIALOG_CLOSE, EMPTY, INPUT_CLASS, ROW, SEARCH, SECTION_TITLE, TEXT } from '../ui/presets';

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'select', user: any): void }>();

const q = ref('');
const page = ref(0);          // 0-indexed (DYAPI paging)
const limit = 8;
const users = ref<any[]>([]);
const total = ref(0);
const loading = ref(false);

const pages = () => Math.max(1, Math.ceil(total.value / limit));

const load = async () => {
    loading.value = true;
    try {
        const params: any = { page: page.value, limit, orderBy: 'id' };
        if (q.value.trim()) params.filter = { username: { $contains: q.value.trim() } };
        const res = await listUser(params);
        users.value = res.data || [];
        total.value = res.total;   // full match count for pagination (not the current page length)
    } catch (e) { console.error(e); users.value = []; } finally { loading.value = false; }
};

const search = () => { page.value = 0; load(); };
const prev = () => { if (page.value > 0) { page.value--; load(); } };
const next = () => { if (page.value < pages() - 1) { page.value++; load(); } };

const pick = (u: any) => { emit('select', u); close(); };
const close = () => emit('update:visible', false);

// (Re)load whenever the dialog opens.
watch(() => props.visible, (v) => { if (v) { q.value = ''; page.value = 0; load(); } });
</script>

<template>
    <div v-if="visible" class="fixed inset-0 z-60 flex items-center justify-center bg-scrim backdrop-blur-sm p-4" @click.self="close">
        <div class="bg-white rounded-card w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
            <div class="p-5 border-b border-separator-weak flex items-center justify-between">
                <h2 :class="SECTION_TITLE">{{ $t('userPicker.title') }}</h2>
                <Button unstyled @click="close" :class="DIALOG_CLOSE"><LucideX :size="18" /></Button>
            </div>

            <div class="p-5 flex flex-col gap-3">
                <div class="relative">
                    <LucideSearch :size="16" :class="SEARCH.icon" />
                    <InputText v-model="q" unstyled :placeholder="$t('userPicker.search')" :class="[INPUT_CLASS, SEARCH.input]" @keyup.enter="search" @input="search" />
                </div>

                <ul class="flex flex-col gap-1 min-h-[280px]">
                    <li v-if="loading" :class="EMPTY">{{ $t('system.loading') }}</li>
                    <li v-else-if="!users.length" :class="EMPTY">{{ $t('userPicker.empty') }}</li>
                    <li v-for="u in users" :key="u.id">
                        <button @click="pick(u)" :class="[ROW.base, ROW.idle]">
                            <span class="w-8 h-8 rounded-full bg-indigo-fill text-indigo flex items-center justify-center shrink-0"><LucideUser :size="16" /></span>
                            <span class="min-w-0">
                                <span class="block text-body font-medium truncate">{{ u.nickname || u.username }}</span>
                                <span class="block truncate" :class="TEXT.caption">{{ u.username }} · #{{ u.id }}</span>
                            </span>
                        </button>
                    </li>
                </ul>

                <div class="flex items-center justify-between pt-1">
                    <Button unstyled @click="prev" :disabled="page === 0" :class="BTN_SM.secondary">{{ $t('common.prev') }}</Button>
                    <span :class="TEXT.caption">{{ page + 1 }} / {{ pages() }}</span>
                    <Button unstyled @click="next" :disabled="page >= pages() - 1" :class="BTN_SM.secondary">{{ $t('common.next') }}</Button>
                </div>
            </div>
        </div>
    </div>
</template>
