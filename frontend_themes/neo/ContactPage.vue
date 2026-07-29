<template>
  <main class="contact">
    <header class="c-head">
      <span class="eyebrow">联系</span>
      <h1>一起做点<br>好东西</h1>
    </header>

    <div class="c-body">
      <!-- 联系方式 -->
      <aside class="c-info">
        <div class="info-item" v-if="email">
          <span class="k">Email</span>
          <a :href="`mailto:${email}`">{{ email }}</a>
        </div>
        <div class="info-item" v-if="phone">
          <span class="k">Phone</span>
          <a :href="`tel:${phone}`">{{ phone }}</a>
        </div>
        <div class="info-item" v-if="location">
          <span class="k">Location</span>
          <span>{{ location }}</span>
        </div>
        <div class="info-item">
          <span class="k">Social</span>
          <Socials :context="context" />
        </div>
      </aside>

      <!-- mailto 表单:提交时唤起邮件客户端并预填 -->
      <form class="c-form" @submit.prevent="send">
        <label>你的称呼<input v-model="form.name" type="text" required placeholder="张三 / Studio X"></label>
        <label>你的邮箱<input v-model="form.email" type="email" placeholder="you@example.com"></label>
        <label>想聊些什么<textarea v-model="form.message" rows="6" required placeholder="项目背景、预算、时间线…"></textarea></label>
        <button type="submit" :disabled="!email">
          {{ email ? '发送 →' : '未配置收件邮箱' }}
        </button>
        <p class="form-note" v-if="email">提交会用你的邮件客户端向 {{ email }} 发送这条消息。</p>
        <p class="form-note" v-else>请在「后台 → 设置 → 主题设置 → 联系邮箱」中填写收件地址。</p>
      </form>
    </div>
  </main>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue';
import Socials from './components/Socials.vue';

const props = defineProps<{ context: any }>();
const cfg = computed(() => props.context?.config || {});
const email = computed(() => cfg.value.theme_neo_contact_email || '');
const phone = computed(() => cfg.value.theme_neo_contact_phone || '');
const location = computed(() => cfg.value.theme_neo_contact_location || '');

const form = reactive({ name: '', email: '', message: '' });
const send = () => {
  if (!email.value) return;
  const subject = `来自 ${form.name || '访客'} 的项目咨询`;
  const body = `姓名: ${form.name}\n邮箱: ${form.email}\n\n${form.message}`;
  window.location.href = `mailto:${email.value}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};
</script>

<style scoped>
.contact { max-width: 1100px; margin: 0 auto; padding: 3rem 2rem 5rem; width: 100%; }
.c-head { border-bottom: 3px solid var(--ink); padding-bottom: 2rem; margin-bottom: 3rem; }
.eyebrow { font-family: 'Space Mono', monospace; text-transform: uppercase; letter-spacing: 2px; color: var(--accent); }
.c-head h1 { font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(3rem, 10vw, 7rem); line-height: 0.9; text-transform: uppercase; margin-top: 0.75rem; }

.c-body { display: grid; grid-template-columns: 300px 1fr; gap: 3rem; align-items: start; }

.c-info { display: flex; flex-direction: column; gap: 1.75rem; }
.info-item { display: flex; flex-direction: column; gap: 0.5rem; }
.info-item .k { font-family: 'Space Mono', monospace; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: var(--accent); }
.info-item a, .info-item span:not(.k) { font-size: 1.05rem; color: var(--ink); text-decoration: none; }
.info-item a:hover { color: var(--accent); text-decoration: underline wavy var(--accent) 1px; }

.c-form { display: flex; flex-direction: column; gap: 1.5rem; border: 3px solid var(--ink); background: var(--surface); box-shadow: var(--shadow-hard); padding: 2rem; }
.c-form label { display: flex; flex-direction: column; gap: 0.5rem; font-family: 'Space Mono', monospace; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; }
.c-form input, .c-form textarea { font-family: 'Manrope', sans-serif; font-size: 1rem; border: 2px solid var(--ink); background: var(--bg-page); padding: 12px 14px; outline: none; resize: vertical; }
.c-form input:focus, .c-form textarea:focus { border-color: var(--accent); }
.c-form button { font-family: 'Space Mono', monospace; font-weight: 700; text-transform: uppercase; font-size: 1rem; background: var(--accent); color: var(--surface); border: 3px solid var(--ink); box-shadow: 4px 4px 0 var(--ink); padding: 14px; cursor: pointer; transition: transform .1s, box-shadow .1s; }
.c-form button:hover:not(:disabled) { transform: translate(-2px,-2px); box-shadow: 7px 7px 0 var(--ink); }
.c-form button:disabled { background: var(--border-light); cursor: not-allowed; box-shadow: none; }
.form-note { font-family: 'Space Mono', monospace; font-size: 0.75rem; color: rgba(28,28,28,.6); margin: 0; }

@media (max-width: 760px) { .c-body { grid-template-columns: 1fr; } }
</style>
