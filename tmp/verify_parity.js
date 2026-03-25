const fs = require('fs');

const en = JSON.parse(fs.readFileSync('messages/en.json', 'utf8'));
const ar = JSON.parse(fs.readFileSync('messages/ar.json', 'utf8'));

function compare(enObj, arObj, path = '') {
  let missing = [];
  for (let key in enObj) {
    const currentPath = path ? `${path}.${key}` : key;
    if (arObj[key] === undefined) {
      missing.push(currentPath);
    } else if (typeof enObj[key] === 'object' && enObj[key] !== null) {
      missing = missing.concat(compare(enObj[key], arObj[key], currentPath));
    }
  }
  return missing;
}

const missingKeys = compare(en, ar);

if (missingKeys.length === 0) {
  console.log("SUCCESS: 100% PARITY REACHED! No missing keys.");
} else {
  console.log("MISSING KEYS FOUND (" + missingKeys.length + "):");
  missingKeys.forEach(k => console.log("- " + k));
}
