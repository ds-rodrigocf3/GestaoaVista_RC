require('dotenv').config();
const { poolPromise, sql } = require('./src/config/database');

async function repair() {
    try {
        console.log('Iniciando reparo da tabela Tarefas...');
        const pool = await poolPromise;
        
        // 1. Adicionar colunas faltantes se não existirem
        const columnsToAdd = [
            { name: 'Descricao', type: 'NVARCHAR(MAX)' },
            { name: 'DataCriacao', type: 'DATETIME DEFAULT GETDATE()' },
            { name: 'DataModificacao', type: 'DATETIME DEFAULT GETDATE()' },
            { name: 'ComentarioStatus', type: 'NVARCHAR(1000)' },
            { name: 'InicioRealizado', type: 'DATE' },
            { name: 'FimRealizado', type: 'DATE' }
        ];

        for (const col of columnsToAdd) {
            try {
                console.log(`Verificando coluna ${col.name}...`);
                await pool.request().query(`
                    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tarefas') AND name = '${col.name}')
                    BEGIN
                        ALTER TABLE Tarefas ADD ${col.name} ${col.type};
                    END
                `);
            } catch (e) {
                console.error(`Erro ao adicionar ${col.name}:`, e.message);
            }
        }

        console.log('Reparo concluído com sucesso.');
        process.exit(0);
    } catch (err) {
        console.error('Erro fatal no reparo:', err);
        process.exit(1);
    }
}

repair();
