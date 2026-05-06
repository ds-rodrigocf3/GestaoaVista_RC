const fs = require('fs');
let f = fs.readFileSync('public/js/events.js', 'utf8');

f = f.replace(/const respNome = ev\.responsavelNome \|\| ev\.ResponsavelNome;/, 
`const respNome = ev.responsavelNome || ev.ResponsavelNome;
              const relTime = getRelativeTime(ev.dataInicio || ev.DataInicio || ev.inicio, tipo, ev.dataFim || ev.DataFim || ev.fim);
              const isHappeningSoon = relTime === 'Em breve' || relTime === 'AGORA';`);

f = f.replace(/className="glass-card"/g, 'className={`glass-card ${isHappeningSoon ? \\\'pulse-emphasis\\\' : \\\'\\\'}`}');

f = f.replace(/const relTime = getRelativeTime\(ev\.dataInicio \|\| ev\.DataInicio \|\| ev\.inicio, tipo, ev\.dataFim \|\| ev\.DataFim \|\| ev\.fim\);/, '');

fs.writeFileSync('public/js/events.js', f);
