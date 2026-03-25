const fs = require('fs');
const paths = ['messages/en.json', 'messages/tr.json'];

paths.forEach(path => {
    if (!fs.existsSync(path)) return;
    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    if (data.Muse) {
        Object.keys(data.Muse).forEach(key => {
            if (typeof data.Muse[key] === 'string') {
                // Replace "AI" with "Uniq" but be careful not to break words like "AId" (if any)
                // Using regex for whole word or start of string
                data.Muse[key] = data.Muse[key].replace(/\bAI\b/g, 'Uniq');
            }
        });
        fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
        console.log(`Updated ${path}`);
    }
});
