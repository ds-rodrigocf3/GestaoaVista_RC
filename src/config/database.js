const sql = require('mssql');

// Identifica se está no Azure (WEBSITE_SITE_NAME é injetado pelo App Service) ou via flag manual
const isAzure = !!(process.env.WEBSITE_SITE_NAME || process.env.DB_ENVIRONMENT === 'azure');

// Mapeamento flexível para aceitar padrões do Azure (AZURE_SQL_...) ou padrões customizados (DB_...)
const dbUser = process.env.AZURE_SQL_USERNAME || process.env.DB_USER;
const dbPassword = process.env.AZURE_SQL_PASSWORD || process.env.DB_PASSWORD;
const dbDatabase = process.env.AZURE_SQL_DATABASE || process.env.DB_DATABASE || process.env.LOCAL_DB_NAME;
const dbServerRaw = process.env.AZURE_SQL_SERVER || process.env.DB_SERVER || process.env.LOCAL_DB_SERVER || 'localhost';

const [serverAddress, instanceName] = dbServerRaw.split('\\');

const config = {
  user: dbUser,
  password: dbPassword,
  database: dbDatabase,
  server: serverAddress,
  port: parseInt(process.env.AZURE_SQL_PORT || process.env.DB_PORT || 1433),
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