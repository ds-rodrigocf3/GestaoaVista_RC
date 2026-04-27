require('dotenv').config();
const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.LOCAL_DB_NAME || 'gestaointernabi-database',
    server: (process.env.LOCAL_DB_SERVER || 'localhost').split('\\')[0],
    port: parseInt(process.env.DB_PORT || 1433),
    options: {
        encrypt: true,
        trustServerCertificate: true,
        useUTC: false
    }
};

async function migrate() {
    try {
        console.log('🔄 Iniciando regressão do schema para DATETIME...');
        const pool = await sql.connect(config);

        // Alterar colunas para DATETIME
        await pool.request().query('ALTER TABLE BI_Eventos ALTER COLUMN DataInicio DATETIME');
        console.log('✅ DataInicio alterada para DATETIME');

        await pool.request().query('ALTER TABLE BI_Eventos ALTER COLUMN DataFim DATETIME');
        console.log('✅ DataFim alterada para DATETIME');

        console.log('✨ Migração concluída com sucesso!');
        await pool.close();
    } catch (err) {
        console.error('❌ Erro na migração:', err.message);
    }
}

migrate();
