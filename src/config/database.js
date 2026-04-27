const sql = require('mssql');

// Identifica se está no Azure ou Local
const isAzure = !!(process.env.WEBSITE_SITE_NAME || process.env.DB_ENVIRONMENT === 'azure');

// Tratamento para instâncias nomeadas (Ex: localhost\SQLEXPRESS01)
const serverRaw = process.env.DB_SERVER || process.env.LOCAL_DB_SERVER || 'localhost';
const [serverAddress, instanceName] = serverRaw.split('\\');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || process.env.LOCAL_DB_NAME,
  server: serverAddress,
  port: parseInt(process.env.DB_PORT || 1433),
  options: {
    encrypt: true,
    trustServerCertificate: true, // Essencial para o seu SQLEXPRESS local e Driver 18
    instanceName: instanceName,   // Permite que o driver ache a instância correta
    useUTC: false
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log(`✅ Conectado ao SQL Server (${isAzure ? 'Azure' : 'Local'})`);
    return pool;
  })
  .catch(err => {
    console.error('❌ Erro de conexão no banco de dados:', err.message);
    // Lançamos o erro para que o server.js saiba que a conexão falhou
    throw err;
  });

module.exports = { poolPromise, sql, isAzure, config };