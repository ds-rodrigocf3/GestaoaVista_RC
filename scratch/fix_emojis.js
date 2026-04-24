const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, '..', 'public', 'js');
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));

const replacements = [
  { search: /ðŸ”‘/g, replace: '🔑' },
  { search: /ðŸš«/g, replace: '🚫' },
  { search: /ðŸ“ /g, replace: '📋' },
  { search: /ðŸ“…/g, replace: '📅' },
  { search: /â›±ï¸ /g, replace: '🏖️' },
  { search: /ðŸš©/g, replace: '🚩' },
  { search: /âš¡/g, replace: '⚡' },
  { search: /â ³/g, replace: '⏳' },
  { search: /âœ…/g, replace: '✅' },
  { search: /â Œ/g, replace: '❌' },
  { search: /ðŸš€/g, replace: '🚀' },
  { search: /ðŸ“ˆ/g, replace: '📈' },
  { search: /ðŸ“¡/g, replace: '📡' },
  { search: /ðŸ“Š/g, replace: '📊' },
  { search: /ðŸ“‚/g, replace: '📂' },
  { search: /ðŸ“‹/g, replace: '📋' },
  { search: /ConcluÁ­do/g, replace: 'Concluído' },
  { search: /ConcluÁ­das/g, replace: 'Concluídas' },
  { search: /Nã£o/g, replace: 'Não' },
  { search: /nã£o/g, replace: 'não' }
];

files.forEach(file => {
    const filePath = path.join(jsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    let original = content;
    replacements.forEach(rep => {
        content = content.replace(rep.search, rep.replace);
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Cleaned emojis in ${file}`);
    }
});
