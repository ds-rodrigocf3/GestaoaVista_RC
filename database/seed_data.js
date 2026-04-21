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

async function seed() {
    try {
        console.log('🌱 Iniciando re-população de dados básicos...');
        const pool = await sql.connect(config);

        // 1. Áreas
        const areas = [
            'Superintendência de Finanças',
            'Gerência de TI',
            'Recursos Humanos',
            'Operações',
            'Comercial'
        ];

        console.log('🏢 Inserindo Áreas...');
        for (const area of areas) {
            await pool.request()
                .input('Nome', sql.NVARCHAR, area)
                .query('IF NOT EXISTS (SELECT 1 FROM BI_Areas WHERE Nome = @Nome) INSERT INTO BI_Areas (Nome) VALUES (@Nome)');
        }

        // 2. Colaboradores (Exemplo básico)
        console.log('👥 Inserindo Colaboradores e Áreas relacionadas...');
        const tiArea = await pool.request().query("SELECT Id FROM BI_Areas WHERE Nome = 'Gerência de TI'");
        const finArea = await pool.request().query("SELECT Id FROM BI_Areas WHERE Nome = 'Superintendência de Finanças'");

        if (tiArea.recordset.length > 0) {
            await pool.request()
                .input('Nome', sql.NVARCHAR, 'Colaborador TI 1')
                .input('AreaId', sql.INT, tiArea.recordset[0].Id)
                .query('IF NOT EXISTS (SELECT 1 FROM BI_Colaboradores WHERE Nome = @Nome) INSERT INTO BI_Colaboradores (Nome, AreaId) VALUES (@Nome, @AreaId)');
        }

        if (finArea.recordset.length > 0) {
            await pool.request()
                .input('Nome', sql.NVARCHAR, 'Responsável Financeiro')
                .input('AreaId', sql.INT, finArea.recordset[0].Id)
                .query('IF NOT EXISTS (SELECT 1 FROM BI_Colaboradores WHERE Nome = @Nome) INSERT INTO BI_Colaboradores (Nome, AreaId) VALUES (@Nome, @AreaId)');
        }

        console.log('✨ Re-população concluída com sucesso!');
        await pool.close();
    } catch (err) {
        console.error('❌ Erro no seeding:', err.message);
    }
}

seed();
