const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, '..', 'public', 'js');
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));

// Some bytes might be completely missing, so we use regex with optional wildcard for the mangled char
const replacements = [
  { search: /Anivers[^\w\s]rio/g, replace: 'Aniversário' },
  { search: /S[^\w\s]b/g, replace: 'Sáb' },
  { search: /cr[^\w\s]tica/g, replace: 'crítica' },
  { search: /cr[^\w\s]ticas/g, replace: 'críticas' },
  { search: /CR[^\w\s]TICAS/g, replace: 'CRÍTICAS' },
  { search: /pend[^\w\s]ncias/g, replace: 'pendências' },
  { search: /N[^\w\s]o /g, replace: 'Não ' },
  { search: /n[^\w\s]o /g, replace: 'não ' },
  { search: /poss[^\w\s]vel/g, replace: 'possível' },
  { search: /A[^\w\s]es/g, replace: 'Ações' },
  { search: /t[^\w\s]tulo/g, replace: 'título' },
  { search: /T[^\w\s]tulo/g, replace: 'Título' },
  { search: /respons[^\w\s]vel/g, replace: 'responsável' },
  { search: /Respons[^\w\s]vel/g, replace: 'Responsável' },
  { search: /P[^\w\s]scoa/g, replace: 'Páscoa' },
  { search: /In[^\w\s]cio/g, replace: 'Início' },
  { search: /Gest[^\w\s]o/g, replace: 'Gestão' },
  { search: /Gest[^\w\s]*or/g, replace: 'Gestor' },
  { search: /inv[^\w\s]lidas/g, replace: 'inválidas' },
  { search: /est[^\w\s]\b/g, replace: 'está' },
  { search: /indispon[^\w\s]vel/g, replace: 'indisponível' },
  { search: /r[^\w\s]pida/g, replace: 'rápida' },
  { search: /Per[^\w\s]odo/g, replace: 'Período' },
  { search: /M[^\w\s]nimo/g, replace: 'Mínimo' },
  { search: /n[^\w\s]vel/g, replace: 'nível' },
  { search: /N[^\w\s]vel/g, replace: 'Nível' },
  { search: /obrigat[^\w\s]rios/g, replace: 'obrigatórios' },
  { search: /exclu[^\w\s]da/g, replace: 'excluída' },
  { search: /Hier[^\w\s]rquico/g, replace: 'Hierárquico' },
  { search: /Descri[^\w\s]o/g, replace: 'Descrição' },
  { search: /mudan[^\w\s]a/g, replace: 'mudança' },
  { search: /estrat[^\w\s]gica/g, replace: 'estratégica' },
  { search: /altera[^\w\s]es/g, replace: 'alterações' },
  { search: /Coment[^\w\s]rio/g, replace: 'Comentário' },
  { search: /Resolu[^\w\s]o/g, replace: 'Resolução' },
  { search: /C[^\w\s]lculo/g, replace: 'Cálculo' },
  { search: /Aprova[^\w\s]es/g, replace: 'Aprovações' },
  { search: /aprova[^\w\s]o/g, replace: 'aprovação' },
  { search: /Par[^\w\s]metros/g, replace: 'Parâmetros' },
  { search: /Solicita[^\w\s]o/g, replace: 'Solicitação' },
  { search: /Tr[^\w\s]s/g, replace: 'Três' },
  { search: /M[^\w\s]s/g, replace: 'Mês' },
  { search: /P[^\w\s]g/g, replace: 'Pág' },
  { search: /Hist[^\w\s]rico/g, replace: 'Histórico' },
  { search: /M[^\w\s]dia/g, replace: 'Média' },
  { search: /Conclu[^\w\s]das/g, replace: 'Concluídas' },
  { search: /Conclu[^\w\s]do/g, replace: 'Concluído' },
  { search: /F[^\w\s]rias/g, replace: 'Férias' },
  { search: /Pr[^\w\s]ximas/g, replace: 'Próximas' },
  { search: /Aten[^\w\s]o/g, replace: 'Atenção' },
  { search: /Reuni[^\w\s]es/g, replace: 'Reuniões' },
  { search: /âš ï¸ /g, replace: '⚠️' },
  { search: /ÂŠÏ‚/g, replace: '⚠️' },
  { search: /Â¢/g, replace: 'â' },
  { search: /Â/g, replace: 'Á' },
  { search: /Todas as [A-Za-z]?reas/g, replace: 'Todas as Áreas' },
  { search: / [A-Za-z]?reas/g, replace: ' Áreas' },
  { search: / [A-Za-z]?rea/g, replace: ' Área' },
  { search: />[A-Za-z]?reas</g, replace: '>Áreas<' },
  { search: />[A-Za-z]?rea</g, replace: '>Área<' },
  { search: /'[A-Za-z]?rea'/g, replace: "'Área'" },
  { search: /"[A-Za-z]?rea"/g, replace: '"Área"'}
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
        console.log(`Cleaned mangled words in ${file}`);
    }
});
