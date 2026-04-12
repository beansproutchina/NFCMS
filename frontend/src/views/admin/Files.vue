<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';

import { uploadAPI } from '../../api';
import { LucideUpload, LucideTrash, LucideFile, LucideEye, LucideSearch } from 'lucide-vue-next';
import { useToast } from 'primevue/usetoast';
import CustomPaginator from '../../components/CustomPaginator.vue';

const files = ref<any[]>([]);
const totalRecords = ref(0);
const loading = ref(true);
const uploading = ref(false);
const toast = useToast();
const fileInput = ref<HTMLInputElement | null>(null);

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

        const res: any = await uploadAPI.getList(params);
        files.value = res.data || res || [];
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

const handleUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    
    uploading.value = true;
    const formData = new FormData();
    for(let i=0; i<target.files.length; i++) {
        formData.append('file', target.files[i]);
    }

    try {
        await uploadAPI.upload(formData);
        toast.add({ severity: 'success', summary: 'Success', detail: '文件上传成功', life: 3000 });
        lazyParams.value.page = 0;
        await fetchFiles();
    } catch(e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Error', detail: '文件上传失败', life: 3000 });
    } finally {
        uploading.value = false;
        if(fileInput.value) fileInput.value.value = '';
    }
};

const deleteFile = async (id: number) => {
    if(!confirm('确定要彻底删除该文件吗？')) return;
    try {
        await uploadAPI.remove(id);
        toast.add({ severity: 'success', summary: 'Success', detail: '文件删除成功', life: 3000 });
        await fetchFiles();
    } catch(e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Error', detail: '文件删除失败', life: 3000 });
    }
};

const triggerUpload = () => {
    fileInput.value?.click();
};

const openUrl = (url: string) => {
    window.open(url, '_blank');
};

onMounted(fetchFiles);
</script>

<template>
    <div class="max-w-7xl mx-auto py-10 w-full px-6">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 gap-4">
            <div>
                <h1 class="text-[40px] font-semibold leading-[1.1] tracking-tight mb-2">{{ $t('system.files', '文件库') }}</h1>
            </div>
            
            <div class="flex gap-3 items-center">
                <span class="relative">
                    <LucideSearch class="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" :size="16" />
                    <InputText unstyled v-model="globalFilter" :placeholder="$t('action.search')" class="pl-9 border border-[rgba(0,0,0,0.04)] py-2 px-4 rounded-[11px] text-[17px] text-[rgba(0,0,0,0.8)] focus:outline-none focus:border-apple-blue" />
                </span>
                <input type="file" ref="fileInput" @change="handleUpload" class="hidden" multiple />
                <Button unstyled @click="triggerUpload" :disabled="uploading" class="bg-[#0071e3] hover:bg-[#0077ED] text-white flex items-center justify-center gap-2 px-4 py-2 rounded-[8px] text-[15px] font-medium transition-colors border border-transparent focus:outline-none cursor-pointer disabled:opacity-50 min-w-max">
                    <LucideUpload :size="16" /> {{ uploading ? '...' : $t('action.upload', '上传文件') }}
                </Button>
            </div>
        </div>

        <div v-if="loading && files.length === 0" class="text-[14px] opacity-60">Loading...</div>
        
        <div v-else-if="files.length === 0" class="text-center py-20 text-[rgba(0,0,0,0.5)] bg-white rounded-[12px] border border-[rgba(0,0,0,0.05)] shadow-[0px_5px_30px_rgba(0,0,0,0.06)]">
            {{ $t('system.noEntries', 'No entries found.') }}
        </div>

        <div v-else>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-6 mb-6">
                <div v-for="file in files" :key="file.id" class="bg-white rounded-[12px] shadow-[0px_5px_30px_rgba(0,0,0,0.06)] overflow-hidden border border-[rgba(0,0,0,0.05)] group relative">
                    
                    <div class="h-40 bg-[#f5f5f7] flex items-center justify-center relative overflow-hidden">
                        <img v-if="file.mime_type?.startsWith('image/')" :src="file.url" class="object-cover w-full h-full" />
                        <LucideFile v-else :size="48" class="text-[rgba(0,0,0,0.2)]" />
                        
                        <div class="absolute inset-0 bg-[rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            <button @click.stop="openUrl(file.url)" class="w-10 h-10 rounded-full bg-white flex items-center justify-center text-apple-blue hover:scale-110 transition-transform" title="新窗口打开">
                                <LucideEye :size="18" />
                            </button>
                            <button @click.stop="deleteFile(file.id)" class="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white hover:scale-110 transition-transform" title="删除">
                                <LucideTrash :size="18" />
                            </button>
                        </div>
                    </div>
                    
                    <div class="p-4 border-t border-[rgba(0,0,0,0.05)]">
                        <div class="text-[14px] font-medium text-[rgba(0,0,0,0.8)] truncate" :title="file.filename">{{ file.filename }}</div>
                        <div class="text-[12px] text-[rgba(0,0,0,0.5)] mt-1">{{ (file.size / 1024).toFixed(2) }} KB</div>
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
