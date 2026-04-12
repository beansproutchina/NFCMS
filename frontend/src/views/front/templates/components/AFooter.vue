<template>
  <footer class="uni-footer">
    <div class="container">
      <div class="footer-content">
        <div class="footer-logo">
          {{ config?.site_name || '大学官网' }}
        </div>
        <div class="footer-links">

        </div>
      </div>
      
      <div class="footer-info">
        <p>&copy; {{ new Date().getFullYear() }} {{ config?.site_name || '大学' }} 版权所有. All Rights Reserved.</p>
        <p>地址：中国某省某市某区某路1号 | 邮编：000000 | 电话：000-0000000</p>
        <p class="icp-box">
          公安备案号：<a href="http://www.beian.gov.cn/portal/registerSystemInfo" target="_blank">0000000000号</a>&nbsp;&nbsp;|&nbsp;&nbsp;
          ICP备案号：<a href="https://beian.miit.gov.cn/" target="_blank">{{ config?.icp_record || 'ICP备00000000号' }}</a>
        </p>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const props = defineProps<{ context: any }>();
const { config } = props.context || {};
</script>

<style scoped>
.uni-footer {
  background-color: #222222;
  color: #cccccc;
  padding: 40px 0 30px;
  margin-top: 60px;
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
}
.container {
  max-width: 1200px;
  margin: 0 auto;
}
.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #444;
  padding-bottom: 20px;
  margin-bottom: 20px;
}
.footer-logo {
  font-size: 24px;
  font-weight: 500;
  color: #fff;
}
.footer-links a {
  color: #ccc;
  text-decoration: none;
  margin: 0 10px;
  font-size: 14px;
}
.footer-links a:hover {
  color: #fff;
}
.footer-info {
  text-align: center;
}
.footer-info p {
  margin: 8px 0;
  font-size: 12px;
  color: #999;
}
.footer-info a {
  color: #999;
  text-decoration: none;
}
.footer-info a:hover {
  color: #fff;
}
</style>
