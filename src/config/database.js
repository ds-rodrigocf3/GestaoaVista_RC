const sql = require('mssql');

// Identifica se está no Azure (WEBSITE_SITE_NAME é injetado pelo App Service) ou via flag manual
const isAzure = !!(process.env.WEBSITE_SITE_NAME || process.env.DB_ENVIRONMENT === 'azure');

// Tratamento para instâncias nomeadas (Ex: localhost\SQLEXPRESS)
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
    // No Azure, o certificado é confiável. No Local (SQLEXPRESS), geralmente precisamos forçar o trust.
    trustServerCertificate: isAzure ? false : true,
    instanceName: instanceName,
    useUTC: false,
    connectTimeout: 30000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Validação básica para ajudar no debug do Azure
if (isAzure && (!config.user || !config.password)) {
  console.warn('⚠️ Alerta: Credenciais de banco de dados não detectadas no ambiente Azure.');
}

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log(`✅ Conexão SQL Server estabelecida com sucesso (${isAzure ? 'Azure/PaaS' : 'Local/Dev'})`);
    return pool;
  })
  .catch(err => {
    console.error('❌ ERRO CRÍTICO: Falha ao conectar no SQL Server:', err.message);
    throw err;
  });

module.exports = { poolPromise, sql, isAzure, config };