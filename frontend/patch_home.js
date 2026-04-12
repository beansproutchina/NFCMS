const fs = require('fs');
const path = 'd:/DYAS_Projects/NFCMS/frontend/src/views/front/Home.vue';
let content = fs.readFileSync(path, 'utf8');
content = content.replace('const siteConfig = ref<any>({});', 'const siteConfig = ref<any>({});\nconst user = ref<any>(null);');
content = content.replace("siteConfig.value = newData.config || {};", "siteConfig.value = newData.config || {};\n            try { user.value = JSON.parse(localStorage.getItem('user') || 'null'); } catch(e){}");
content = content.replace(':categories="categories"', ':categories="categories"\n        :user="user"');
fs.writeFileSync(path, content);
