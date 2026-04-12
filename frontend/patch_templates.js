import fs from 'fs';
const base = 'd:/DYAS_Projects/NFCMS/frontend/src/views/front/templates/';
['DefaultHome.vue', 'DefaultCategory.vue', 'DefaultArticle.vue'].forEach(file => {
    let content = fs.readFileSync(base + file, 'utf8');
    content = content.replace("api?: any", "api?: any,\n  user?: any");
    if (!content.includes('user?: any')) {
        content = content.replace("api: any;", "api: any;\n    user?: any;");
    }
    fs.writeFileSync(base + file, content);
});
