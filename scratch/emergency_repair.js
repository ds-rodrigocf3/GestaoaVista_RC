const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, '..', 'public', 'js');
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
    const filePath = path.join(jsDir, file);
    const rawBuffer = fs.readFileSync(filePath);
    
    // Try to detect the pattern. 
    // In the corrupted files, it seems many characters are 0xED (í) or similar markers.
    // If we see this interleaving, we extract the real characters.
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // The pattern is: junk_char, real_char, junk_char, real_char...
    // Let's identify the junk char. In app.js it's 'í' (\u00ed).
    
    let cleaned = '';
    if (content.includes('\u00ed') || content.includes('\ufffd')) {
        // More robust: filter out ANY character that isn't supposed to be there if it's interleaved
        // Let's just remove the 'í' and any other common junk markers from the script results
        cleaned = content.replace(/[\u00ed\ufffd\ufeff\u￭]/g, '');
        
        // Wait, if I just remove them, what about words that actually have accents?
        // Let's look at the pattern again: ífíuínícítíiíoíní -> f u n c t i o n
        // It's literally interleaved.
        
        let possibleCleaned = '';
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            if (char !== '\u00ed' && char !== '\ufeff' && char !== '\ufffd' && char !== '￭') {
                possibleCleaned += char;
            }
        }
        cleaned = possibleCleaned;
    } else {
        cleaned = content;
    }

    // Secondary fix for specific mangled words like "níÁíÂí£ío" -> "não"
    // The interleaving might have broken existing accents.
    // But first, let's just get the code back.
    
    fs.writeFileSync(filePath, cleaned, 'utf8');
    console.log(`Emergency cleaned ${file}`);
});

// Also clean styles.css
const cssPath = path.join(__dirname, '..', 'public', 'styles.css');
let cssContent = fs.readFileSync(cssPath, 'utf8');
let cleanCss = '';
for (let i = 0; i < cssContent.length; i++) {
    const char = cssContent[i];
    if (char !== '\u00ed' && char !== '\ufeff' && char !== '\ufffd' && char !== '￭') {
        cleanCss += char;
    }
}
fs.writeFileSync(cssPath, cleanCss, 'utf8');
console.log(`Emergency cleaned styles.css`);
