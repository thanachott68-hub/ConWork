const fs = require('fs');
const html = fs.readFileSync('ConWork.html', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');

const strings = new Set();

const htmlMatches = html.match(/>[^<]*[ก-๙]+[^<]*</g) || [];
htmlMatches.forEach(m => {
    let clean = m.replace(/[><\r\n\t]/g, '').trim();
    if (clean) strings.add(clean);
});

const placeholderMatches = html.match(/placeholder=\"[^\"]*[ก-๙]+[^\"]*\"/g) || [];
placeholderMatches.forEach(m => {
    let clean = m.replace(/placeholder=\"/, '').replace(/\"$/, '').trim();
    if (clean) strings.add(clean);
});

const valueMatches = html.match(/value=\"[^\"]*[ก-๙]+[^\"]*\"/g) || [];
valueMatches.forEach(m => {
    let clean = m.replace(/value=\"/, '').replace(/\"$/, '').trim();
    if (clean) strings.add(clean);
});

const jsMatches = app.match(/['\`\"][^'\`\"]*[ก-๙]+[^'\`\"]*['\`\"]/g) || [];
jsMatches.forEach(m => {
    let clean = m.slice(1, -1).trim();
    if (clean) strings.add(clean);
});

const existing = fs.readFileSync('js/i18n.js', 'utf8');
const missing = [];
for (let s of strings) {
    if (!existing.includes('"' + s + '"') && !existing.includes("'" + s + "'")) {
        missing.push(s);
    }
}

console.log(JSON.stringify(missing, null, 2));
