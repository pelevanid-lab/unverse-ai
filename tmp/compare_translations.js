const fs = require('fs');

const en = JSON.parse(fs.readFileSync('c:\\Users\\enesp\\unverse-ai\\messages\\en.json', 'utf8'));
const tr = JSON.parse(fs.readFileSync('c:\\Users\\enesp\\unverse-ai\\messages\\tr.json', 'utf8'));

function compare(obj1, obj2, prefix = '') {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    keys1.forEach(key => {
        if (!obj2.hasOwnProperty(key)) {
            console.log(`Missing in TR: ${prefix}${key}`);
        } else if (typeof obj1[key] === 'object' && obj1[key] !== null) {
            compare(obj1[key], obj2[key], `${prefix}${key}.`);
        }
    });

    keys2.forEach(key => {
        if (!obj1.hasOwnProperty(key)) {
            console.log(`Missing in EN: ${prefix}${key}`);
        }
    });
}

console.log('--- Comparison Results ---');
compare(en, tr);
