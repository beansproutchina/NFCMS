<template>
  <div class="diary-editor-overlay" v-if="visible">
    <div class="diary-editor">
      <div class="editor-header">
        <h2>{{ editArticle ? '✎ 编辑日记' : '✎ 写日记' }}</h2>
        <button class="close-btn" @click="close">✕</button>
      </div>

      <div class="editor-body">
        <div class="field">
          <input v-model="form.title" type="text" placeholder="输入今天的心情..." class="title-input" />
        </div>

        <div class="meta-row">
          <div class="meta-field">
            <label>发布日期</label>
            <input v-model="form.publishedAt" type="datetime-local" class="meta-input" />
          </div>
          <div class="meta-field">
            <label>关联见面</label>
            <select v-model="form.meetupId" class="meta-input">
              <option value="">不关联</option>
              <option v-for="m in meetups" :key="m.id" :value="m.id">
                {{ m.title }} — {{ formatDate(m.data?.date) }}
              </option>
            </select>
          </div>
        </div>

        <div class="editor-area">
          <MdEditor
            v-model="form.content"
            @onUploadImg="onUploadImg"
            :preview="true"
            language="zh-CN"
            placeholder="写下你想说的..."
            :toolbars="mdToolBar"
            theme="dark"
          />
        </div>
      </div>

      <div class="editor-footer">
        <button class="btn-delete" v-if="editArticle" @click="remove" :disabled="saving">
          删除
        </button>
        <div class="footer-spacer"></div>
        <button class="btn-cancel" @click="close">取消</button>
        <button class="btn-save" @click="save" :disabled="saving">
          {{ saving ? '保存中...' : '保存 ♡' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import * as api from "../../../../api.ts";

const props = defineProps<{
  visible: boolean;
  meetups: any[];
  categorySlug: string;
  editArticle?: any;
}>();

const mdToolBar = [
  'bold',
  'underline',
  'italic',
  'quote',
  'image',
  '=',
  'revoke',
  'next',
  'preview',
  'previewOnly',
];


const emit = defineEmits(['close', 'saved']);

const toLocalDatetime = (d: string | Date) => {
  const date = d ? new Date(d) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const form = ref({
  title: '',
  content: '',
  meetupId: '',
  slug: '',
  publishedAt: toLocalDatetime(new Date()),
});

const saving = ref(false);

watch(() => props.visible, (v) => {
  if (v && props.editArticle) {
    form.value.title = props.editArticle.title || '';
    form.value.content = props.editArticle.content || '';
    form.value.meetupId = props.editArticle.data?.meetup_id || '';
    form.value.slug = props.editArticle.slug || '';
    form.value.publishedAt = toLocalDatetime(props.editArticle.published_at || new Date());
  } else if (v) {
    form.value = {
      title: '',
      content: '',
      meetupId: '',
      slug: '',
      publishedAt: toLocalDatetime(new Date()),
    };
  }
});

const onUploadImg = async (files: File[], callback: (urls: string[]) => void) => {
  const results: string[] = [];
  for (const file of files) {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res: any = await api.uploadAPI.upload(fd);
      const url = res?.data?.url || res?.data?.[0]?.url || res?.url;
      if (url) results.push(url);
    } catch (e) {
      console.error('Image upload failed:', e);
    }
  }
  callback(results);
};

const formatDate = (d: string) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('zh-CN');
};

const close = () => emit('close');

const save = async () => {
  if (!form.value.title || !form.value.content) return;
  saving.value = true;
  try {
    const data: any = {
      title: form.value.title,
      content: form.value.content,
      slug: form.value.slug || form.value.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\u4e00-\u9fff-]/g, '') + '-' + Date.now(),
      visible: 1,
      published_at: form.value.publishedAt ? new Date(form.value.publishedAt).toISOString() : undefined,
      data: {
        meetup_id: form.value.meetupId || undefined,
      },
    };
    if (props.editArticle) {
      await api.crudAPI.update('articles', props.editArticle.id, data);
    } else {
      const cats = await api.crudAPI.getList('categories', {
        filter: { slug: props.categorySlug }
      });
      if (cats?.data?.length) {
        data.category_id = cats.data[0].id;
      }
      await api.crudAPI.create('articles', data);
    }
    emit('saved');
    close();
  } catch (e) {
    console.error('Save failed:', e);
  } finally {
    saving.value = false;
  }
};

const remove = async () => {
  if (!props.editArticle) return;
  if (!confirm('确定要删除这篇日记吗？')) return;
  saving.value = true;
  try {
    await api.crudAPI.remove('articles', props.editArticle.id);
    emit('saved');
    close();
  } catch (e) {
    console.error('Delete failed:', e);
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.diary-editor-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.diary-editor {
  background: var(--bg-mid);
  border: 1px solid var(--border-glow);
  border-radius: 20px 20px 0 0;
  width: 100%;
  max-width: 700px;
  height: 92vh;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -8px 40px rgba(179, 136, 255, 0.2);
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.2rem 1.5rem;
  border-bottom: 1px solid var(--border-glow);
  flex-shrink: 0;
}

.editor-header h2 {
  font-family: var(--font-display);
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--accent-rose);
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
  color: var(--accent-rose);
  background: rgba(255, 107, 157, 0.1);
}

.editor-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.title-input {
  width: 100%;
  background: transparent;
  border: none;
  padding: 1rem 1.5rem 0.5rem;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 600;
  outline: none;
  box-sizing: border-box;
}
.title-input::placeholder { color: var(--ink-muted); }

.meta-row {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 1.5rem 0.8rem;
  border-bottom: 1px solid rgba(179, 136, 255, 0.1);
  flex-shrink: 0;
}
.meta-field { flex: 1; }
.meta-field label {
  display: block;
  font-size: 0.75rem;
  color: var(--ink-muted);
  margin-bottom: 4px;
}
.meta-input {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border-glow);
  border-radius: 8px;
  padding: 6px 10px;
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 0.8rem;
  outline: none;
  transition: border-color 0.3s;
  box-sizing: border-box;
}
.meta-input:focus { border-color: var(--accent-lavender); }
.meta-input option { background: var(--bg-mid); color: var(--ink); }

.editor-area {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}



.editor-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0.8rem 1.5rem;
  border-top: 1px solid var(--border-glow);
  flex-shrink: 0;
}

.footer-spacer { flex: 1; }

.btn-cancel {
  background: var(--surface);
  border: 1px solid var(--border-glow);
  color: var(--ink-soft);
  font-family: var(--font-body);
  font-size: 0.85rem;
  padding: 8px 18px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-cancel:hover { background: var(--surface-hover); }

.btn-save {
  background: linear-gradient(135deg, var(--accent-rose), var(--accent-lavender));
  border: none;
  color: #fff;
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 0.85rem;
  padding: 8px 22px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;
}
.btn-save:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(255, 107, 157, 0.4);
}
.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-delete {
  background: rgba(255, 80, 80, 0.15);
  border: 1px solid rgba(255, 80, 80, 0.3);
  color: #ff6b6b;
  font-family: var(--font-body);
  font-size: 0.85rem;
  padding: 8px 18px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-delete:hover { background: rgba(255, 80, 80, 0.25); }
.btn-delete:disabled { opacity: 0.6; cursor: not-allowed; }

@media (min-width: 700px) {
  .diary-editor-overlay {
    align-items: center;
  }
  .diary-editor {
    border-radius: 20px;
    height: 85vh;
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
}
</style>
