import fs from 'fs';
const path = 'd:/DYAS_Projects/NFCMS/frontend/src/views/front/ArticleDetail.vue';
let content = fs.readFileSync(path, 'utf8');
content = content.replace("const configData = ref<any>({});", "const configData = ref<any>({});\nconst user = ref<any>(null);");
content = content.replace("configData.value = fetchedData.config || {};", "configData.value = fetchedData.config || {};\n    try { user.value = JSON.parse(localStorage.getItem('user') || 'null'); } catch(e){}");
content = content.replace(':breadcrumbs="data.breadcrumbs"', ':breadcrumbs="data.breadcrumbs"\n         :user="user"');
fs.writeFileSync(path, content);
