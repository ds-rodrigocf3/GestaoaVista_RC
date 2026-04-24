const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, '..', 'public', 'js');
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
    const filePath = path.join(jsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace non-ASCII characters with Unicode escapes
    // But exclude common mangled sequences if they still exist, fix them first
    content = content.replace(/Ã¡/g, 'á')
                     .replace(/Ã©/g, 'é')
                     .replace(/Ã\*/g, 'í')
                     .replace(/Ã³/g, 'ó')
                     .replace(/Ãº/g, 'ú')
                     .replace(/Ã§/g, 'ç')
                     .replace(/Ã£/g, 'ã')
                     .replace(/Ãµ/g, 'õ')
                     .replace(/Ãª/g, 'ê')
                     .replace(/Ã´/g, 'ô')
                     .replace(/Ã‰/g, 'É')
                     .replace(/Ã“/g, 'Ó')
                     .replace(/Ãš/g, 'Ú')
                     .replace(/Ã‡/g, 'Ç')
                     .replace(/Ã€/g, 'À')
                     .replace(/Ã‚/g, 'Â')
                     .replace(/Ãƒ/g, 'Ã')
                     .replace(/Ã /g, 'à')
                     .replace(/Ã¦/g, 'æ')
                     .replace(/Ã/g, 'Á')
                     .replace(/Ã/g, 'Í')
                     .replace(/Â°/g, '°');

    let escapedContent = '';
    for (let i = 0; i < content.length; i++) {
        const charCode = content.charCodeAt(i);
        if (charCode > 127) {
            escapedContent += '\\u' + charCode.toString(16).padStart(4, '0');
        } else {
            escapedContent += content[i];
        }
    }
    
    fs.writeFileSync(filePath, escapedContent, 'utf8');
    console.log(`Processed ${file}`);
});
