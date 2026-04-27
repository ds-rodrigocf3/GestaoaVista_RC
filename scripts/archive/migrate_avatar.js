const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const serverAddressRaw = process.env.DB_SERVER || process.env.LOCAL_DB_SERVER || '127.0.0.1';
const serverAddress = serverAddressRaw.split('\\')[0];
const databaseName = process.env.DB_DATABASE || process.env.LOCAL_DB_NAME || process.env.DB_NAME;

const sqlConfig = {
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

async function migrate() {
  console.log('🔄 Iniciando migração da coluna AvatarUrl...');
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('✅ Conectado ao banco de dados.');

    console.log('🏗️ Alterando coluna AvatarUrl para NVARCHAR(MAX)...');
    await pool.request().query(`
      ALTER TABLE BI_Colaboradores 
      ALTER COLUMN AvatarUrl NVARCHAR(MAX);
    `);

    console.log('🎉 Migração concluída com sucesso!');
    await sql.close();
  } catch (err) {
    console.error('❌ Erro durante a migração:', err.message);
    process.exit(1);
  }
}

migrate();
