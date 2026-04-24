const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, '..', 'public', 'js');
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
    const filePath = path.join(jsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // The previous script failed because it didn't catch the exact interleaved character.
    // Let's just remove ALL occurrences of the 'í' character (0xED) and other markers.
    // This is safe because 'í' is now a junk character in these files.
    
    // We replace it by identifying its character code.
    let cleaned = '';
    for (let i = 0; i < content.length; i++) {
        const code = content.charCodeAt(i);
        // Skip 0xED (í), 0xFEFF (BOM), 0xFFFD (Replacement char), 0x25AA (￭)
        if (code !== 0xED && code !== 0xFEFF && code !== 0xFFFD && code !== 0x25AA) {
            cleaned += content[i];
        }
    }
    
    // One more pass: remove the 'Ã' if it was part of a mangled 'í'
    cleaned = cleaned.replace(/Ã/g, '');

    fs.writeFileSync(filePath, cleaned, 'utf8');
    console.log(`Deep cleaned ${file}`);
});

const cssPath = path.join(__dirname, '..', 'public', 'styles.css');
let cssContent = fs.readFileSync(cssPath, 'utf8');
let cleanedCss = '';
for (let i = 0; i < cssContent.length; i++) {
    const code = cssContent.charCodeAt(i);
    if (code !== 0xED && code !== 0xFEFF && code !== 0xFFFD && code !== 0x25AA) {
        cleanedCss += cssContent[i];
    }
}
fs.writeFileSync(cssPath, cleanedCss.replace(/Ã/g, ''), 'utf8');
console.log(`Deep cleaned styles.css`);
