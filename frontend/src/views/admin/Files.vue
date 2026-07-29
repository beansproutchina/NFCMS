<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';

import { uploadAPI } from '../../api';
import { LucideTrash, LucideFile, LucideEye, LucideSearch, LucideLink } from 'lucide-vue-next';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { useI18n } from 'vue-i18n';
import CustomPaginator from '../../components/CustomPaginator.vue';
import FileUploader from '../../components/FileUploader.vue';
import { INPUT_CLASS } from '../../ui/presets';

const files = ref<any[]>([]);
const totalRecords = ref(0);
const loading = ref(true);
const toast = useToast();
const confirm = useConfirm();
const { t } = useI18n();

const globalFilter = ref('');
const lazyParams = ref({ page: 0, rows: 20 }); // Show 20 files per page

const fetchFiles = async () => {
    loading.value = true;
    try {
        let filter: any = {};
        if (globalFilter.value) {
            filter = { 
                $or: {
                    filename: { $contains: globalFilter.value }
                }
            };
        }

        const params: any = {
            limit: lazyParams.value.rows,
            page: lazyParams.value.page,
            filter,
            orderBy: 'id',
            orderDesc: true
        };

        const res = await uploadAPI.getList(params);
        files.value = res.data || [];
        totalRecords.value = res.total || 0;
    } catch(e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

const onPage = (event: any) => {
    lazyParams.value.page = event.page;
    lazyParams.value.rows = event.rows;
    fetchFiles();
};

let filterTimeout: any;
const onFilterChange = () => {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
        lazyParams.value.page = 0;
        fetchFiles();
    }, 500);
};

watch(globalFilter, onFilterChange);

// FileUploader owns the input + FormData + error toast; we only refresh the listing.
const onUploaded = async () => {
    lazyParams.value.page = 0;
    await fetchFiles();
};

const deleteFile = (id: number) => {
    confirm.require({
        header: t('confirm.title'),
        message: t('action.confirmDelete'),
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: t('confirm.accept'),
        rejectLabel: t('confirm.reject'),
        accept: async () => {
            try {
                await uploadAPI.remove(id);
                toast.add({ severity: 'success', summary: 'Success', detail: '文件删除成功', life: 3000 });
                await fetchFiles();
            } catch(e) {
                console.error(e);
                toast.add({ severity: 'error', summary: 'Error', detail: '文件删除失败', life: 3000 });
            }
        }
    });
};

const openUrl = (url: string) => {
    window.open(url, '_blank');
};

// Copying needs a secure context (https / localhost); when it is unavailable we surface the
// URL in a read-only field so it can still be selected by hand.
const fallbackUrl = ref('');
const copyLink = async (url: string) => {
    try {
        await navigator.clipboard.writeText(url);
        fallbackUrl.value = '';
        toast.add({ severity: 'success', summary: t('fileUploader.copied'), detail: url, life: 2500 });
    } catch (e) {
        console.error(e);
        fallbackUrl.value = url;
        toast.add({ severity: 'warn', summary: t('fileUploader.copyFailed'), life: 4000 });
    }
};

onMounted(fetchFiles);
</script>

<template>
    <div class="max-w-7xl mx-auto py-10 w-full px-6">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 gap-4">
            <div>
                <h1 class="text-title-page font-semibold leading-title tracking-tight mb-2">{{ $t('system.files', '文件库') }}</h1>
            </div>
            
            <div class="flex gap-3 items-center">
                <span class="relative">
                    <LucideSearch class="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" :size="16" />
                    <InputText unstyled v-model="globalFilter" :placeholder="$t('action.search')" :class="[INPUT_CLASS, 'pl-9']" />
                </span>
                <!-- This page *is* the library, so the "choose from library" path would be circular. -->
                <FileUploader mode="button" multiple :library="false" @uploaded="onUploaded" />
            </div>
        </div>

        <div v-if="fallbackUrl" class="mb-6 flex items-center gap-3 max-w-2xl">
            <InputText unstyled readonly :model-value="fallbackUrl" :class="INPUT_CLASS" @focus="($event.target as HTMLInputElement).select()" />
        </div>

        <div v-if="loading && files.length === 0" class="text-body opacity-60">Loading...</div>
        
        <div v-else-if="files.length === 0" class="text-center py-20 text-label-3 bg-white rounded-card border border-separator-weak shadow-card">
            {{ $t('system.noEntries', 'No entries found.') }}
        </div>

        <div v-else>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-6 mb-6">
                <div v-for="file in files" :key="file.id" class="bg-white rounded-card shadow-card overflow-hidden border border-separator-weak group relative">
                    
                    <div class="h-40 bg-canvas flex items-center justify-center relative overflow-hidden">
                        <img v-if="file.mime_type?.startsWith('image/')" :src="file.url" class="object-cover w-full h-full" />
                        <LucideFile v-else :size="48" class="text-label-4" />
                        
                        <div class="absolute inset-0 bg-scrim opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            <Button unstyled @click.stop="openUrl(file.url)" class="w-10 h-10 rounded-full bg-white flex items-center justify-center text-accent hover:scale-110 transition-transform cursor-pointer" title="新窗口打开">
                                <LucideEye :size="18" />
                            </Button>
                            <Button unstyled @click.stop="copyLink(file.url)" class="w-10 h-10 rounded-full bg-white flex items-center justify-center text-accent hover:scale-110 transition-transform cursor-pointer" :title="$t('fileUploader.copyLink')">
                                <LucideLink :size="18" />
                            </Button>
                            <Button unstyled @click.stop="deleteFile(file.id)" class="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white hover:scale-110 transition-transform cursor-pointer" title="删除">
                                <LucideTrash :size="18" />
                            </Button>
                        </div>
                    </div>
                    
                    <div class="p-4 border-t border-separator-weak">
                        <div class="text-body font-medium text-label truncate" :title="file.filename">{{ file.filename }}</div>
                        <div class="text-small text-label-3 mt-1">{{ (file.size / 1024).toFixed(2) }} KB</div>
                    </div>
                </div>
            </div>
            
            <!-- Paginator -->
            <CustomPaginator 
                :first="lazyParams.page * lazyParams.rows"
                :rows="lazyParams.rows"
                :totalRecords="totalRecords"
                :rowsPerPageOptions="[10, 20, 50]"
                @page="onPage"
            />
        </div>
    </div>
</template>
