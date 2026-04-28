require('dotenv').config();
const { poolPromise, sql } = require('../src/config/database');

async function migrate() {
    try {
        const pool = await poolPromise;
        console.log('Verificando colunas da tabela Demandas...');
        
        // Adicionar CriadoPor se não existir
        const checkCriadoPor = await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Demandas') AND name = 'CriadoPor')
            BEGIN
                ALTER TABLE Demandas ADD CriadoPor INT NULL;
                PRINT 'Coluna CriadoPor adicionada.';
            END
        `);
        
        console.log('Migração concluída com sucesso.');
        process.exit(0);
    } catch (err) {
        console.error('Erro na migração:', err);
        process.exit(1);
    }
}

migrate();
