<template>
  <div class="music-uploader-overlay" v-if="visible" >
    <div class="music-uploader">
      <div class="uploader-header">
        <h2>♪ 上传音乐</h2>
        <button class="close-btn" @click="close">✕</button>
      </div>

      <div class="uploader-body">
        <div class="field">
          <label>歌曲名称</label>
          <input v-model="form.title" type="text" placeholder="给这首歌起个名字..." class="input-field" />
        </div>

        <div class="field">
          <label>选择音频文件</label>
          <div class="upload-area" @click="triggerUpload" @dragover.prevent @drop.prevent="onDrop">
            <div v-if="!form.file" class="upload-placeholder">
              <span class="upload-icon">🎵</span>
              <span>点击或拖拽音频文件到这里</span>
              <span class="upload-hint">支持 MP3, WAV, OGG, M4A</span>
            </div>
            <div v-else class="upload-ready">
              <span class="file-icon">♪</span>
              <span class="file-name">{{ form.file.name }}</span>
              <button class="remove-file" @click.stop="form.file = null">✕</button>
            </div>
          </div>
          <input ref="fileInput" type="file" accept="audio/*" style="display: none" @change="onFileSelect" />
        </div>

        <div class="field-row">
          <div class="field">
            <label>描述（可选）</label>
            <textarea v-model="form.description" placeholder="这首歌的故事..." class="desc-field" rows="3"></textarea>
          </div>
          <div class="field">
            <label>发布日期</label>
            <input v-model="form.publishedAt" type="datetime-local" class="input-field" />
          </div>
        </div>
      </div>

      <div class="uploader-footer">
        <button class="btn-cancel" @click="close">取消</button>
        <button class="btn-save" @click="upload" :disabled="uploading || !form.file || !form.title">
          {{ uploading ? '上传中...' : '上传 ♪' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { markRaw, ref, toRaw } from 'vue';
import * as api from "../../../../api.ts";
const props = defineProps<{
  visible: boolean;
  categorySlug: string;
}>();

const emit = defineEmits(['close', 'saved']);

const form = ref({
  title: '',
  file: null as File | null,
  description: '',
  publishedAt: (() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })(),
});

const uploading = ref(false);
const fileInput = ref<HTMLInputElement>();

const close = () => emit('close');

const triggerUpload = () => fileInput.value?.click();

const onFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files?.length) {
    form.value.file = target.files[0];
  }
};

const onDrop = (e: DragEvent) => {
  const file = e.dataTransfer?.files[0];
  if (file && file.type.startsWith('audio/')) {
    form.value.file = file;
  }
};

const upload = async () => {
  if (!form.value.file || !form.value.title) return;
  uploading.value = true;
  try {
    // Upload file first
    const fd = new FormData();
    console.log(form.value.file)
    fd.append('file', toRaw(form.value.file));
    console.log(fd);
    const uploadResult = await api.uploadAPI.upload(fd);

    const audioUrl = uploadResult?.data[0]?.url;
    // Find category id
    const cats = await api.crudAPI.getList('categories', {
      filter: { slug: props.categorySlug }
    });
    if (!cats?.data?.length) throw new Error('Music category not found');

    // Create article with audio data
    await api.crudAPI.create('articles', {
      title: form.value.title,
      slug: form.value.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\u4e00-\u9fff-]/g, '') + '-' + Date.now(),
      content: form.value.description || form.value.title,
      description: form.value.description || '',
      category_id: cats.data[0].id,
      visible: 1,
      published_at: form.value.publishedAt ? new Date(form.value.publishedAt).toISOString() : undefined,
      data: {
        audio_url: audioUrl,
        audio_type: form.value.file.type,
      },
    });

    emit('saved');
    close();
  } catch (e) {
    console.error('Upload failed:', e);
  } finally {
    uploading.value = false;
  }
};
</script>

<style scoped>
.music-uploader-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.music-uploader {
  background: var(--bg-mid);
  border: 1px solid var(--border-glow);
  border-radius: 20px;
  width: 90%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 40px rgba(179, 136, 255, 0.2);
  animation: editorIn 0.3s ease-out;
  max-height: 90vh;
}

@keyframes editorIn {
  from { opacity: 0; transform: translateY(20px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.uploader-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 1.5rem 0;
  flex-shrink: 0;
}

.uploader-header h2 {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--accent-peach);
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: var(--ink-muted);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: all 0.2s;
}

.close-btn:hover {
  color: var(--accent-peach);
  background: rgba(255, 171, 145, 0.1);
}

.uploader-body { padding: 1.5rem; overflow-y: auto; flex: 1; }

.field-row {
  display: flex;
  gap: 1rem;
}
.field-row .field { flex: 1; }

.field { margin-bottom: 1.2rem; }

.field label {
  display: block;
  font-size: 0.85rem;
  color: var(--ink-muted);
  margin-bottom: 6px;
  font-weight: 500;
}

.input-field {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border-glow);
  border-radius: 10px;
  padding: 10px 14px;
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.3s;
  box-sizing: border-box;
}

.input-field:focus { border-color: var(--accent-peach); }

.upload-area {
  border: 2px dashed var(--border-glow);
  border-radius: 14px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: var(--surface);
}

.upload-area:hover {
  border-color: var(--accent-peach);
  background: rgba(255, 171, 145, 0.05);
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--ink-muted);
  font-size: 0.9rem;
}

.upload-icon { font-size: 2rem; }
.upload-hint { font-size: 0.75rem; color: var(--ink-muted); }

.upload-ready {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--accent-peach);
}

.file-icon { font-size: 1.5rem; }
.file-name { flex: 1; font-weight: 500; color: var(--ink-soft); }

.remove-file {
  background: none;
  border: none;
  color: var(--ink-muted);
  cursor: pointer;
  font-size: 1rem;
  padding: 2px 6px;
}

.desc-field {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border-glow);
  border-radius: 10px;
  padding: 10px 14px;
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 0.95rem;
  outline: none;
  resize: vertical;
  transition: border-color 0.3s;
  box-sizing: border-box;
}

.desc-field:focus { border-color: var(--accent-peach); }

.uploader-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-glow);
  flex-shrink: 0;
}

.btn-cancel {
  background: var(--surface);
  border: 1px solid var(--border-glow);
  color: var(--ink-soft);
  font-family: var(--font-body);
  font-size: 0.9rem;
  padding: 8px 20px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover { background: var(--surface-hover); }

.btn-save {
  background: linear-gradient(135deg, var(--accent-peach), var(--accent-rose));
  border: none;
  color: #fff;
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 0.9rem;
  padding: 8px 24px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-save:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(255, 171, 145, 0.4);
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

@media (max-width: 700px) {
  .music-uploader-overlay { align-items: flex-end; }
  .music-uploader {
    border-radius: 20px 20px 0 0;
    width: 100%;
    max-width: 100%;
    max-height: 88vh;
  }
  @keyframes editorIn {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  .uploader-body { padding: 1rem; }
  .field-row { flex-direction: column; gap: 0; }
}
</style>
