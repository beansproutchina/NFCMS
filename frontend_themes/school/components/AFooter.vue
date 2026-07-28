<template>
  <footer class="uni-footer">
    <div class="container">
      <!-- 上区:友情链接组(menus[footer]) + 联系方式 + 二维码 -->
      <div class="footer-top" v-if="hasTop">
        <div class="footer-links" v-if="footerGroups.length">
          <div class="link-group" v-for="(g, gi) in footerGroups" :key="gi">
            <h4>{{ g.label }}</h4>
            <ul>
              <li v-for="(l, li) in g.children" :key="li">
                <a :href="l.url" :target="isExternal(l.url) ? '_blank' : undefined" :rel="isExternal(l.url) ? 'noopener' : undefined">{{ l.label }}</a>
              </li>
            </ul>
          </div>
        </div>

        <div class="footer-contact" v-if="hasContact">
          <h4>联系我们</h4>
          <p v-if="address">地址：{{ address }}<span v-if="postcode">（邮编：{{ postcode }}）</span></p>
          <p v-if="phone">电话：{{ phone }}</p>
          <p v-if="email">邮箱：<a :href="`mailto:${email}`">{{ email }}</a></p>
        </div>

        <div class="footer-qr" v-if="qrcode">
          <img :src="qrcode" alt="官方公众号二维码" />
          <span>官方公众号</span>
        </div>
      </div>

      <!-- 下区:版权 / 备案 -->
      <div class="footer-info">
        <p>&copy; {{ year }} {{ siteName }}. All Rights Reserved.</p>
        <p class="record-line">
          <a v-if="policeRecord" :href="policeHref" target="_blank" rel="noopener">
            <span class="police-badge">⬢</span>{{ policeRecord }}
          </a>
          <span v-if="policeRecord && icp" class="sep">|</span>
          <a v-if="icp" href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">{{ icp }}</a>
        </p>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ context: any }>();
const { config, menus } = props.context || {};

const siteName = computed(() => config?.site_name || '学院官网');
const icp = computed(() => config?.icp_record || '');
const address = computed(() => config?.theme_school_footer_address || '');
const postcode = computed(() => config?.theme_school_footer_postcode || '');
const phone = computed(() => config?.theme_school_footer_phone || '');
const email = computed(() => config?.theme_school_footer_email || '');
const qrcode = computed(() => config?.theme_school_qrcode || '');
const policeRecord = computed(() => config?.theme_school_police_record || '');
// Extract the numeric record id for the gov filing link, if present.
const policeHref = computed(() => {
  const digits = (policeRecord.value.match(/\d{6,}/) || [''])[0];
  return digits
    ? `https://beian.mps.gov.cn/#/query/webSearch?code=${digits}`
    : 'https://beian.mps.gov.cn/';
});

const footerGroups = computed(() => {
  if (!menus) return [];
  const m = menus.find((x: any) => x.location === 'footer');
  // Top-level footer menu items become column headings; their children become links.
  return (m?.items || []).filter((it: any) => it.children && it.children.length);
});

const hasContact = computed(() => !!(address.value || phone.value || email.value));
const hasTop = computed(() => footerGroups.value.length || hasContact.value || qrcode.value);

const isExternal = (url: string) => /^https?:\/\//i.test(url || '');
const year = new Date().getFullYear();
</script>

<style scoped>
.uni-footer {
  background: #1f1f1f; color: #bfbfbf; margin-top: 60px;
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
}
.container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }

.footer-top {
  display: flex; gap: 48px; flex-wrap: wrap;
  padding: 44px 0 30px; border-bottom: 1px solid #383838;
}
.footer-top h4 { color: #fff; font-size: 15px; font-weight: 500; margin: 0 0 16px; }

.footer-links { display: flex; gap: 48px; flex-wrap: wrap; flex: 1; }
.link-group ul { list-style: none; padding: 0; margin: 0; }
.link-group li { margin-bottom: 10px; }
.link-group a { color: #bfbfbf; text-decoration: none; font-size: 13px; transition: color .2s; }
.link-group a:hover { color: #fff; }

.footer-contact { min-width: 240px; }
.footer-contact p { margin: 0 0 10px; font-size: 13px; line-height: 1.6; color: #bfbfbf; }
.footer-contact a { color: #bfbfbf; text-decoration: none; }
.footer-contact a:hover { color: #fff; }

.footer-qr { text-align: center; }
.footer-qr img { width: 104px; height: 104px; background: #fff; padding: 5px; border-radius: 4px; display: block; }
.footer-qr span { display: block; margin-top: 8px; font-size: 12px; color: #999; }

.footer-info { text-align: center; padding: 22px 0; }
.footer-info p { margin: 6px 0; font-size: 12px; color: #8c8c8c; }
.record-line { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; }
.record-line a { color: #8c8c8c; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; }
.record-line a:hover { color: #ccc; }
.record-line .sep { color: #555; }
.police-badge { color: #4a90d9; font-size: 11px; }

@media (max-width: 768px) {
  .footer-top { gap: 30px; padding: 32px 0 24px; }
  .footer-links { gap: 30px; }
  .footer-qr { margin: 0 auto; }
}
</style>
