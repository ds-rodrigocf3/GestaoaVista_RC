const sql = require('mssql');

const isAzure = process.env.WEBSITE_SITE_NAME || process.env.AZURE_FUNCTIONS_ENVIRONMENT;
const serverAddressRaw = process.env.DB_SERVER || process.env.LOCAL_DB_SERVER || '127.0.0.1';
const serverAddress = serverAddressRaw.split('\\')[0];
const databaseName = process.env.DB_DATABASE || process.env.LOCAL_DB_NAME || process.env.DB_NAME;

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: databaseName,
  server: serverAddress,
  port: parseInt(process.env.DB_PORT || 1433),
  options: {
    encrypt: true,
    trustServerCertificate: true,
    useUTC: false
  }
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log(`✅ Conectado ao SQL Server (${isAzure ? 'Azure' : 'Local'}) com sucesso!`);
    return pool;
  })
  .catch(err => {
    console.error('❌ Erro de conexão:', err);
    process.exit(1);
  });

module.exports = { poolPromise, sql, isAzure, config };
