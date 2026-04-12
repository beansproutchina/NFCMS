import fs from 'fs';
const file = 'd:/DYAS_Projects/NFCMS/frontend/src/components/SmartTable.vue';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("defineProps({", `defineProps({\n  lazy: { type: Boolean, default: false },\n  totalRecords: { type: Number, default: 0 },`);

content = content.replace(':filters="filters"', ':filters="filters"\n      :lazy="lazy"\n      :totalRecords="totalRecords"');

fs.writeFileSync(file, content);
