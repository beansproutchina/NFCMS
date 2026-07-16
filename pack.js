const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname);

// Use git to list ALL non-ignored files: --cached (tracked) + --others --exclude-standard (untracked non-ignored)
let files;
try {
  files = execSync('git ls-files -z --cached --others --exclude-standard', {
    cwd: rootDir,
    encoding: 'utf8',
  });
} catch (err) {
  console.error('Failed to run git ls-files. Make sure git is installed and this is a git repo.');
  process.exit(1);
}

// -z uses NUL as separator; filter out files that no longer exist on disk (deleted but not staged)
const fileList = files
  .split('\0')
  .map((f) => f.trim())
  .filter(Boolean)
  .filter((f) => fs.existsSync(path.join(rootDir, f)))
  .sort((a,b)=> a.localeCompare(b))

if (fileList.length === 0) {
  console.error('No files found to pack.');
  process.exit(1);
}

const outputFile = 'NFCMS.tar.gz';

// Exclude the output archive and temp file from the file list
const excludeFiles = new Set([outputFile, '.pack_filelist.tmp']);
const filteredList = fileList.filter((f) => !excludeFiles.has(f));

console.log(`Packing ${filteredList.length} files into ${outputFile} ...`);

// Write file list to a temp file so we can pass it to tar via -T
const tmpList = path.join(rootDir, '.pack_filelist.tmp');
fs.writeFileSync(tmpList, filteredList.join('\n'), 'utf8');

try {
  // Delete old archive first to avoid tar read-write conflict
  const oldArchive = path.join(rootDir, outputFile);
  if (fs.existsSync(oldArchive)) fs.unlinkSync(oldArchive);

  // Use relative paths for both output and -T file to avoid Windows drive-letter issues with tar
  execSync(`tar -czf "${outputFile}" -T ".pack_filelist.tmp"`, {
    cwd: rootDir,
    stdio: 'inherit',
  });
  console.log(`Done: ${path.join(rootDir, outputFile)}`);
} finally {
  //fs.unlinkSync(tmpList);
}
