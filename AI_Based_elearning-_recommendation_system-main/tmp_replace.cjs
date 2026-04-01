const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
        results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) { 
        results.push(file);
    }
  });
  return results;
}
walk('./server').forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('ENV')) {
        let original = content;
        content = content.replace(/import\s*\{\s*ENV\s*\}\s*from/g, 'import { env } from');
        content = content.replace(/\bENV\./g, 'env.');
        if (content !== original) {
            fs.writeFileSync(file, content);
            console.log('Updated', file);
        }
    }
});
