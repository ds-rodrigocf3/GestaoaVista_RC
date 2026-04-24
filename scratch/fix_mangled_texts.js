const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, '..', 'public', 'js');
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));

// We use regular expressions to match the mangled words flexibly.
// For example, "Par?metros" or "Par¢metros" or "ParÂ¢metros"
const fixes = [
  { regex: /ðŸ“‚/g, replace: '📂' },
  { regex: /ðŸ“‹/g, replace: '📋' },
  { regex: /Par[^\w\s]*metros/g, replace: 'Parâmetros' },
  { regex: /Solicita[^\w\s]*o/g, replace: 'Solicitação' },
  { regex: /Solicita[^\w\s]*es/g, replace: 'Solicitações' },
  { regex: /N[^\w\s]*o Iniciado/g, replace: 'Não Iniciado' },
  { regex: /[^\w\s]*Pausadas \/ Backlog/g, replace: '⏸️ Pausadas / Backlog' },
  { regex: /Gest[^\w\s]*o/g, replace: 'Gestão' },
  { regex: /M[^\w\s]*dia/g, replace: 'Média' },
  { regex: /Cr[^\w\s]*tica/g, replace: 'Crítica' },
  { regex: /Hist[^\w\s]*rico/g, replace: 'Histórico' },
  { regex: /Conclu[^\w\s]*das/g, replace: 'Concluídas' },
  { regex: /F[^\w\s]*rias/g, replace: 'Férias' },
  { regex: /Pr[^\w\s]*ximas/g, replace: 'Próximas' },
  { regex: /Aprova[^\w\s]*es/g, replace: 'Aprovações' },
  { regex: /M[^\w\s]*s\b/g, replace: 'Mês' },
  { regex: /Aten[^\w\s]*o/g, replace: 'Atenção' },
  { regex: /Reuni[^\w\s]*es/g, replace: 'Reuniões' },
  { regex: /Presencial\/(M[^\w\s]*dia)/g, replace: 'Presencial/Média' },
  // specific icon fix for the screenshot:
  { regex: /Â\s*HD G2M P M 3\s*PAUSADAS/g, replace: '⏸️ PAUSADAS' },
  { regex: /Â\s*HD G2M P M 3/g, replace: '⏸️' },
  { regex: /Â\u0081/g, replace: '' } // Remove garbage characters
];

files.forEach(file => {
    const filePath = path.join(jsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    let original = content;
    fixes.forEach(fix => {
        content = content.replace(fix.regex, fix.replace);
    });

    // Also manually search for 'rea' without the 'Á' to fix 'Área' if it was stripped
    // This is risky if 'rea' is part of another word (like 'real'), so we'll be careful
    // "rea " -> "Área " if it's in a label or option
    content = content.replace(/>\s*rea\s*</g, '>Área<')
                     .replace(/'rea'/g, "'Área'")
                     .replace(/"rea"/g, '"Área"')
                     .replace(/ rea\b/g, ' Área')
                     .replace(/^rea\b/g, 'Área');
    
    // Fix N o -> Não (if space was left)
    content = content.replace(/N o Iniciado/g, 'Não Iniciado')
                     .replace(/N o /g, 'Não ');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed texts in ${file}`);
    }
});

console.log('Text fix script complete.');
