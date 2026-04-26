const sql = require('mssql');
const path = require('path');
const fs = require('fs');
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

async function runMigration() {
  console.log('🚀 Iniciando migração de Áreas de Eventos...');
  let pool;
  try {
    pool = await sql.connect(sqlConfig);
    
    const migrationSql = fs.readFileSync(path.join(__dirname, 'migrate_event_areas.sql'), 'utf8');
    
    // SQL Server doesn't like GO in the middle of a string passed to .query()
    // We split by GO and run each part
    const parts = migrationSql.split(/\bGO\b/i);
    
    for (let part of parts) {
      if (part.trim()) {
        await pool.request().query(part);
      }
    }

    console.log('✨ Migração concluída com sucesso!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro na migração:', err.message);
    process.exit(1);
  }
}

runMigration();
