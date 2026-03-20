const fs = require('fs');
const path = require('path');

const srcPath = path.join('c:', 'Users', 'enesp', 'unverse-ai', 'src');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(filePath));
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) { 
      results.push(filePath);
    }
  });
  return results;
}

const files = walk(srcPath);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Replace next/link
  if (content.includes("import Link from 'next/link'") || content.includes('import Link from "next/link"')) {
    content = content.replace(/import Link from ['"]next\/link['"];?/, "import { Link } from '@/i18n/routing';");
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated Link imports in " + file);
  }
});
