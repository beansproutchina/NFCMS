<template>
  <footer class="td-footer" :style="bgStyle">
    <div class="td-container">
      <div class="footer-top">
        <div class="footer-left">
          <img v-if="logo" class="footer-logo" :src="logo" :alt="siteName" />
          <div v-else class="footer-logo-text fnt24">{{ siteName }}</div>

          <div class="message-info fnt18">
            <div v-if="address" class="address">{{ address }}</div>
            <div class="contact">
              <span v-if="phone">{{ phone }}</span>
              <a v-if="email" :href="`mailto:${email}`">{{ email }}</a>
            </div>
          </div>

          <div v-if="quickItems.length" class="quick-link fnt18">
            <a v-for="(m, i) in quickItems" :key="i" :href="m.url" target="_blank" rel="noopener">{{ m.label }}</a>
          </div>

          <div v-if="footerItems.length" class="other-link fnt18">
            <a v-for="(m, i) in footerItems" :key="i" :href="m.url" :target="isExternal(m.url) ? '_blank' : undefined">{{ m.label }}</a>
          </div>
        </div>

        <!-- 二维码:两张都没配就整块不渲染,不留一片空白 -->
        <div v-if="qrcodes.length" class="qrcode-list">
          <div v-for="(q, i) in qrcodes" :key="i" class="qrcode">
            <img :src="q.src" :alt="q.label" />
            <p v-if="q.label" class="fnt14">{{ q.label }}</p>
          </div>
        </div>
      </div>

      <div v-if="icp" class="footer-copyright fnt18">{{ icp }}</div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Locale } from '../lib';

const props = defineProps<{ context: any; locale?: Locale }>();
const locale = computed<Locale>(() => props.locale ?? 'zh');
const config = computed(() => props.context?.config ?? {});
const c = (k: string) => String(config.value[k] ?? '').trim();

const siteName = computed(() => String(config.value.site_name ?? ''));
const logo = computed(() => c('theme_tdli_logo_white'));
const phone = computed(() => c('theme_tdli_footer_phone'));
const email = computed(() => c('theme_tdli_footer_email'));
/** 备案号走 NFCMS 的通用站点配置(设置 → 站点配置),主题不重复造一个字段。 */
const icp = computed(() => String(config.value.icp_record ?? '').trim());

/** 地址有中英两份;英文没配就回落中文,总比空着强(地址本身是可读的)。 */
const address = computed(() =>
    locale.value === 'en' ? (c('theme_tdli_footer_address_en') || c('theme_tdli_footer_address'))
                          : c('theme_tdli_footer_address'));

const bgStyle = computed(() => {
    const bg = c('theme_tdli_footer_bg');
    return bg ? { backgroundImage: `url(${bg})` } : {};
});

/**
 * 空配置 → 不渲染那一张,而不是渲染一个坏图标。
 * 说明文字中英各一份;英文没填就回落中文 —— 二维码本身还是有用的,总比只剩一张无字的图好。
 */
const qrLabel = (base: string) =>
    locale.value === 'en' ? (c(`${base}_en`) || c(base)) : c(base);

const qrcodes = computed(() => [
    { src: c('theme_tdli_qrcode_video'), label: qrLabel('theme_tdli_qrcode_video_label') },
    { src: c('theme_tdli_qrcode_wechat'), label: qrLabel('theme_tdli_qrcode_wechat_label') },
].filter(q => q.src));

const menuAt = (loc: string) => {
    const suffix = locale.value === 'en' ? '_en' : '';
    const hit = (props.context?.menus ?? []).find((m: any) => m.location === loc + suffix);
    return Array.isArray(hit?.items) ? hit.items : [];
};
const quickItems = computed(() => menuAt('quicklinks'));
const footerItems = computed(() => menuAt('footer'));

const isExternal = (url: string) => /^(https?:)?\/\//i.test(String(url || ''));
</script>

<style scoped>
.td-footer {
  background-color: var(--footer-bg);
  background-repeat: no-repeat; background-position: center bottom; background-size: cover;
  color: #fff; position: relative; z-index: 2;
}
.td-footer a { color: #fff; }
.td-footer a:hover { text-decoration: underline; }

.footer-top { display: flex; gap: 4vw; padding: 50px 0; }
.footer-left { flex: 1; min-width: 0; }
.footer-logo { max-height: 60px; margin-bottom: 15px; }
.footer-logo-text { font-weight: 600; margin-bottom: 15px; }

.message-info { margin-top: var(--size-36); }
.contact { display: flex; gap: var(--size-24); margin-top: var(--size-6); flex-wrap: wrap; }

.quick-link { margin-top: var(--size-36); display: flex; flex-wrap: wrap; gap: var(--size-30); }
.other-link { margin-top: var(--size-24); display: flex; flex-wrap: wrap; gap: var(--size-30); }

.qrcode-list { display: flex; gap: 24px; justify-content: flex-end; flex: none; }
.qrcode { text-align: center; }
.qrcode img { width: 108px; height: 108px; object-fit: contain; background: #fff; }
.qrcode p { margin-top: 9px; }

.footer-copyright {
  padding: 18px 0; text-align: center; border-top: 1px solid rgba(255,255,255,.1);
}

@media (max-width: 991px) {
  .footer-top { flex-direction: column; gap: 28px; padding: 36px 0; }
  .qrcode-list { justify-content: flex-start; }
}
</style>
