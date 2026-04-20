const sql = require('mssql');

const isAzure = process.env.WEBSITE_SITE_NAME || process.env.AZURE_FUNCTIONS_ENVIRONMENT;
const serverAddressRaw = process.env.DB_SERVER || process.env.LOCAL_DB_SERVER || '127.0.0.1';
const serverAddress = serverAddressRaw.split('\\')[0]; 
const databaseName = process.env.DB_DATABASE || process.env.LOCAL_DB_NAME || process.env.DB_NAME;

const dbConfig = {
  user: process.env.DB_USER || 'db_user_admin',
  password: process.env.DB_PASSWORD || 'DevAdmin01@@',
  database: databaseName,
  server: serverAddress,
  port: parseInt(process.env.DB_PORT || 1433),
  options: { encrypt: true, trustServerCertificate: true }
};

require('dotenv').config();

async function checkDatabase() {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query('SELECT Id, Email, SenhaHash FROM BI_Usuarios');
    console.table(result.recordset);
    pool.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkDatabase();
