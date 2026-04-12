const fs = require('fs');
const path = 'd:/DYAS_Projects/NFCMS/frontend/src/api.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace("getList: () => api.get('/attachments'),", "getList: (params: any = {}) => {\n        const searchParams = new URLSearchParams();\n        for (const [key, value] of Object.entries(params)) {\n            if (value !== undefined && value !== null) {\n                searchParams.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));\n            }\n        }\n        const qs = searchParams.toString();\n        return api.get(`/attachments${qs ? '?' + qs : ''}`);\n    },");

fs.writeFileSync(path, content);
