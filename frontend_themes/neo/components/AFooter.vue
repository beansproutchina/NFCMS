<template>
  <footer class="site-footer">
    <div class="footer-grid">
      <div class="footer-copyright">
        © {{ new Date().getFullYear() }} {{ config?.site_name || 'BRUTAL PRESS' }}
      </div>
      <div class="footer-links">
        <span>Proudly powered by <a href="https://github.com/dyas-dev/NFCMS" target="_blank">NFCMS</a></span>
        <span v-if="config?.icp_record" class="icp">
          <a href="https://beian.miit.gov.cn/" target="_blank">{{ config.icp_record }}</a>
        </span>
      </div>
    </div>
    <div class="footer-decoration">⏤ ⏤ ⏤</div>
  </footer>
</template>

<script setup lang="ts">
const props = defineProps<{ context: any }>();
const { config } = props.context || {};
</script>

<style scoped>
.site-footer {
  margin-top: auto;
  border-top: 2px solid var(--border-light);
  padding: 3rem 2rem 2rem;
  background: var(--surface);
  font-family: 'Space Mono', monospace;
  font-size: 0.8rem;
  color: var(--ink);
}

.footer-grid {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.footer-links {
  display: flex;
  gap: 1.5rem;
}

.footer-decoration {
  text-align: center;
  margin-top: 3rem;
  letter-spacing: 8px;
  color: var(--border-light);
  font-size: 1.2rem;
}

a {
  color: var(--ink);
  text-decoration: underline wavy var(--accent) 1px;
  text-underline-offset: 4px;
}
a:hover { color: var(--accent); }

@media (max-width: 640px) {
  .footer-grid { flex-direction: column; align-items: flex-start; }
}
</style>