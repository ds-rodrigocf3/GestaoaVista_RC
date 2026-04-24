const fs = require('fs');
let f = fs.readFileSync('public/js/calendar.js', 'utf8');
f = f.replace(/fontSize:\s*'18px'/g, "fontSize: 'var(--cal-icon-size, 18px)'");
f = f.replace(/fontSize:\s*'20px'/g, "fontSize: 'var(--cal-icon-size, 20px)'");
fs.writeFileSync('public/js/calendar.js', f);
console.log('Calendar icons updated to responsive sizes.');
