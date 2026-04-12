const fs = require('fs');
const path = require('path');

const filePath = path.join('d:/DYAS_Projects/NFCMS/frontend/src/components/SmartTable.vue');
let cc = fs.readFileSync(filePath, 'utf-8');

// Find the block starting with pcPaginator: { and its closing brace at the root of pcPaginator
const lines = cc.split('\n');
let out = [];
let inPaginator = false;
let braceStack = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inPaginator && line.includes('pcPaginator: {')) {
        inPaginator = true;
        braceStack = 1;
        // Count braces in this line
        const restOfLine = line.substring(line.indexOf('pcPaginator: {') + 14);
        for (let j = 0; j < restOfLine.length; j++) {
            if (restOfLine[j] === '{') braceStack++;
            else if (restOfLine[j] === '}') braceStack--;
        }
        out.push('  pcPaginator: customPaginatorPt as any,');
        if (braceStack === 0) inPaginator = false;
        continue;
    }
    
    if (inPaginator) {
        for (let j = 0; j < line.length; j++) {
            if (line[j] === '{') braceStack++;
            else if (line[j] === '}') braceStack--;
        }
        if (braceStack <= 0) {
            inPaginator = false;
        }
        continue;
    }
    
    out.push(line);
}

fs.writeFileSync(filePath, out.join('\n'));
console.log('Done');
