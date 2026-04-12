const fs = require('fs');
const file = 'd:/DYAS_Projects/NFCMS/frontend/src/components/SmartTable.vue';
let content = fs.readFileSync(file, 'utf8');

// import the custom format
content = content.replace("import Column from 'primevue/column';", "import Column from 'primevue/column';\nimport { customPaginatorPt } from './CustomPaginator';");

// replace pcPaginator block
content = content.replace(/pcPaginator: \{\n(\s*.*\n)+\s*\},/g, "pcPaginator: customPaginatorPt as any,");

// add rowsPerPageOptions etc inside DataTable props
content = content.replace(':totalRecords="totalRecords"', ':totalRecords="totalRecords"\n      :rowsPerPageOptions="[10, 20, 50]"\n      paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"\n      currentPageReportTemplate="{first} to {last} of {totalRecords}"');

fs.writeFileSync(file, content);
