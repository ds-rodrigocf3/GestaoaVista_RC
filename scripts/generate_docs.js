const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['node_modules', '.git', '.gemini', 'project_analysis', 'scripts', 'database', 'documentacao_projeto'];
const IGNORE_EXTS = ['.png', '.jpg', '.jpeg', '.ico', '.db', '.sqlite', '.pdf', '.docx'];
const OUTPUT_DIR = path.join(__dirname, 'documentacao_projeto');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (IGNORE_DIRS.includes(file)) continue;
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, fileList);
    } else {
      if (!IGNORE_EXTS.includes(path.extname(filePath).toLowerCase()) && file !== 'generate_docs.js' && file !== 'package-lock.json') {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

const allFiles = getFiles(__dirname);

const fileDescriptions = {
  // Public - Frontend
  'public/index.html': 'Página principal da aplicação, contendo o shell e os modais.',
  'public/styles.css': 'Folha de estilos global contendo tokens de design, utilitários e estilos de componentes.',
  'public/js/app.js': 'Lógica central do frontend, gerenciamento de estado global e navegação entre páginas.',
  'public/js/calendar.js': 'Componente React para o calendário mensal, incluindo escala presencial/home office.',
  'public/js/dashboard.js': 'Componente React para os dashboards de indicadores e estatísticas da equipe.',
  'public/js/requests.js': 'Componente React para o painel de solicitações (folgas, férias, etc).',
  'public/js/approvals.js': 'Componente React para o painel de aprovações do gestor.',
  'public/js/events.js': 'Componente React para gerenciamento e listagem de eventos globais.',
  'public/js/tasks.js': 'Componente React para o módulo de gestão de tarefas/demandas e controle de progresso.',
  'public/js/login.js': 'Lógica de autenticação do frontend (tela de login).',
  'public/js/settings.js': 'Componente para o painel de configurações (administração de usuários, cargos, hierarquia).',
  'public/js/utils.js': 'Funções utilitárias compartilhadas no frontend (formatação de data, debounce, etc).',
  
  // Src - Backend
  'src/server.js': 'Ponto de entrada do backend Express, configura rotas e middlewares globais.',
  'src/config/database.js': 'Configuração de conexão com o banco de dados SQLite.',
  'src/config/constants.js': 'Constantes compartilhadas do sistema.',
  'src/middleware/auth.js': 'Middleware de autenticação para proteger as rotas da API verificando o token do usuário.',
  'src/middleware/logger.js': 'Middleware simples para log de requisições HTTP.',
  
  // Controllers
  'src/controllers/authController.js': 'Lógica de login, validação de credenciais e geração de tokens.',
  'src/controllers/areasController.js': 'Gerenciamento do CRUD de Áreas.',
  'src/controllers/cargosController.js': 'Gerenciamento do CRUD de Cargos.',
  'src/controllers/colaboradoresController.js': 'Gerenciamento de Colaboradores (funcionários).',
  'src/controllers/demandasController.js': 'Gerenciamento do CRUD de Demandas/Tarefas.',
  'src/controllers/eventosController.js': 'Gerenciamento do CRUD de Eventos Globais.',
  'src/controllers/hierarquiaController.js': 'Gerenciamento das relações de gestão (quem aprova quem).',
  'src/controllers/requestsController.js': 'Lógica de negócio para criação, aprovação e rejeição de Agendamentos.',
  'src/controllers/statusTiposController.js': 'Gerenciamento de Tipos de Status para demandas.',
  'src/controllers/tarefasController.js': 'Lógica de negócio para o quadro de tarefas diárias.',
  
  // Routes
  'src/routes/areas.js': 'Rotas para manipulação de Áreas.',
  'src/routes/auth.js': 'Rotas para login e autenticação.',
  'src/routes/cargos.js': 'Rotas para manipulação de Cargos.',
  'src/routes/colaboradores.js': 'Rotas para manipulação de Colaboradores.',
  'src/routes/demandas.js': 'Rotas para manipulação de Demandas.',
  'src/routes/eventos.js': 'Rotas para manipulação de Eventos.',
  'src/routes/hierarquia.js': 'Rotas para configuração de Hierarquia.',
  'src/routes/requests.js': 'Rotas para Agendamentos (escalas, day-offs).',
  'src/routes/status-tipos.js': 'Rotas para configuração de Status das demandas.',
  'src/routes/tarefas.js': 'Rotas para o módulo de Tarefas.',
  
  // Utils
  'src/utils/dateFormatters.js': 'Helpers para padronização e conversão de datas (formato brasileiro e banco).',
  'src/utils/hierarchyHelpers.js': 'Helpers para descobrir quais colaboradores estão sob gestão de um usuário.',
  'src/utils/scaleHelpers.js': 'Helpers para manipulação de intervalos de datas em aprovações de escalas.',

  // Root
  'package.json': 'Configuração do projeto Node.js e dependências.',
  'server.js': 'Entry point auxiliar para inicialização (repassa para src/server.js).'
};

function getDesc(filePath) {
  const relPath = path.relative(__dirname, filePath).replace(/\\/g, '/');
  return fileDescriptions[relPath] || 'Arquivo de código fonte ou configuração auxiliar do projeto.';
}

const visaoGeralPath = path.join(OUTPUT_DIR, 'Visao_Geral_e_Arquitetura.txt');

let visaoGeral = `
=====================================================
VISÃO GERAL DO PROJETO - GESTÃO À VISTA
=====================================================

1. ARQUITETURA DO PROJETO
-------------------------
A aplicação "Gestão à Vista" é um sistema web do tipo Single Page Application (SPA) com arquitetura cliente-servidor:
- Frontend (Cliente): Construído com HTML5, CSS puro e JavaScript nativo. Utiliza a biblioteca React inserida diretamente no navegador (via Babel Standalone) para renderizar a maioria dos módulos interativos (Calendário, Dashboard, Tarefas, etc). Isso dispensa o uso de empacotadores como Webpack ou Vite no lado do cliente, simplificando a estrutura.
- Backend (Servidor): Construído com Node.js e Express.js, atuando como uma API RESTful. Ele é responsável pelas regras de negócios e segurança.
- Banco de Dados: SQLite (arquivo local na pasta /database). O banco é relacional e as consultas são feitas via pacote \`sqlite3\`.
- Autenticação: Customizada via Tokens gerados no backend e persistidos na base de dados, enviados em headers (x-auth-token).

2. LISTA COMPLETA DE ARQUIVOS
-------------------------
`;

for (const filePath of allFiles) {
  const relPath = path.relative(__dirname, filePath).replace(/\\/g, '/');
  visaoGeral += `- ${relPath}\n`;
}

visaoGeral += `

3. CONTEÚDO INTEGRAL DOS ARQUIVOS E SUAS FUNÇÕES
------------------------------------------------
`;

for (const filePath of allFiles) {
  const relPath = path.relative(__dirname, filePath).replace(/\\/g, '/');
  const desc = getDesc(filePath);
  const content = fs.readFileSync(filePath, 'utf8');

  // Adiciona ao arquivo de Visão Geral
  visaoGeral += `
========================================================================
ARQUIVO: ${relPath}
FUNÇÃO: ${desc}
========================================================================
${content}

`;

  // Gera um arquivo separado
  const safeName = relPath.replace(/\//g, '_');
  const individualContent = `NOME DO ARQUIVO: ${path.basename(filePath)}
CAMINHO: ${relPath}
PROPÓSITO: ${desc}

CONTEÚDO COMPLETO:
========================================================================
${content}
`;
  fs.writeFileSync(path.join(OUTPUT_DIR, `${safeName}.txt`), individualContent);
}

fs.writeFileSync(visaoGeralPath, visaoGeral);

console.log('Documentação gerada com sucesso na pasta documentacao_projeto!');
