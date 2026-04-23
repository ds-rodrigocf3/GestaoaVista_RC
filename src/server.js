// Modular server entrypoint - mounts route modules
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { poolPromise } = require('./config/database');
const { loggerMiddleware } = require('./middleware/logger');

// Route Modules
const authRouter = require('./routes/auth');
const hierarquiaRouter = require('./routes/hierarquia');
const areasRouter = require('./routes/areas');
const cargosRouter = require('./routes/cargos');
const demandasRouter = require('./routes/demandas');
const tarefasRouter = require('./routes/tarefas');
const requestsRouter = require('./routes/requests');
const colaboradoresRouter = require('./routes/colaboradores');
const eventosRouter = require('./routes/eventos');
const statusTiposRouter = require('./routes/status-tipos');

const app = express();

app.use(loggerMiddleware);
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/hierarquia', hierarquiaRouter);
app.use('/api/areas', areasRouter);
app.use('/api/cargos', cargosRouter);
app.use('/api/demandas', demandasRouter);
app.use(['/api/tarefas', '/api/tasks'], tarefasRouter); // Handle both names
app.use('/api/requests', requestsRouter);
app.use(['/api/colaboradores', '/api/employees'], colaboradoresRouter); // Handle both names
app.use('/api/eventos', eventosRouter);
app.use('/api/status-tipos', statusTiposRouter);

// Static Files
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, res) => res.status(404).json({ error: 'Endpoint não encontrado' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3000;

const routers = { 
  authRouter, hierarquiaRouter, areasRouter, cargosRouter, 
  demandasRouter, tarefasRouter, requestsRouter, 
  colaboradoresRouter, eventosRouter, statusTiposRouter 
};

poolPromise.then(() => {
  // Conta rotas a partir dos routers importados
  const routeCount = Object.values(routers).reduce((acc, r) => {
    if (!r || !r.stack) return acc;
    return acc + r.stack.filter(l => l.route).length;
  }, 0);

  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Total de routes: ${routeCount}`);
  });
}).catch(err => {
  console.error('Erro ao conectar ao banco:', err.message || err);
  app.listen(PORT, () => console.log(`Servidor rodando (sem DB) na porta ${PORT}`));
});

module.exports = app;
