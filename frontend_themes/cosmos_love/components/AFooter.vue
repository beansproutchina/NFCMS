<template>
  <footer class="love-footer">
    <div class="footer-inner">
      <div class="footer-love">
        <span class="heart-pulse">♥</span>
        <span>Made with love</span>
      </div>
      <div class="footer-info">
        <span>© {{ new Date().getFullYear() }} {{ config?.site_name }}</span>
        <span class="dot">·</span>
        <a href="https://github.com/beansproutchina/NFCMS" target="_blank">NFCMS</a>
        <template v-if="config?.icp_record">
          <span class="dot">·</span>
          <a href="https://beian.miit.gov.cn/" target="_blank">{{ config.icp_record }}</a>
        </template>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const props = defineProps<{ context: any }>();
const { config } = props.context || {};
</script>

<style scoped>
.love-footer {
  border-top: 1px solid var(--border-glow);
  padding: 2rem;
  background: rgba(10, 10, 26, 0.6);
  backdrop-filter: blur(10px);
}

.footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.footer-love {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-display);
  font-size: 1rem;
  color: var(--ink-soft);
}

.heart-pulse {
  color: var(--accent-rose);
  font-size: 1.2rem;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.footer-info {
  font-size: 0.8rem;
  color: var(--ink-muted);
  display: flex;
  align-items: center;
  gap: 4px;
}

.dot { color: var(--accent-lavender); }

a {
  color: var(--ink-muted);
  text-decoration: none;
  transition: color 0.3s;
}
a:hover { color: var(--accent-rose); }

@media (max-width: 640px) {
  .footer-inner { flex-direction: column; align-items: center; text-align: center; }
}
</style>
