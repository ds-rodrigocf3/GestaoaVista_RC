const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

async function migrate() {
    const isAzure = process.env.DB_ENVIRONMENT === 'azure';
    console.log(`🚀 Iniciando Migração em modo: ${isAzure ? 'AZURE' : 'LOCAL'}`);

    let sqlConfig;
    if (isAzure) {
        sqlConfig = {
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE || 'DB_TESTE',
            server: process.env.DB_SERVER,
            options: {
                encrypt: true,
                trustServerCertificate: false,
                enableArithAbort: true
            }
        };
    } else {
        const driver = "ODBC Driver 18 for SQL Server";
        const server = process.env.DB_SERVER || 'localhost\\SQLEXPRESS01';
        const database = process.env.DB_DATABASE || process.env.LOCAL_DB_NAME || 'DB_TESTE';
        sqlConfig = {
            connectionString: `Driver={${driver}};Server=${server};Database=${database};Trusted_Connection=yes;Encrypt=yes;TrustServerCertificate=yes;`,
            driver: 'msnodesqlv8'
        };
    }

    try {
        const mssqlProvider = isAzure ? require('mssql') : require('mssql/msnodesqlv8');
        const pool = await mssqlProvider.connect(sqlConfig);
        console.log('🔗 Conectado ao banco de dados...');

        console.log('🛠️ Verificando e adicionando colunas faltantes...');

        // 1. Adicionar CriadoPor em Demandas
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Demandas') AND name = 'CriadoPor')
            BEGIN
                ALTER TABLE Demandas ADD CriadoPor INT NULL;
                PRINT 'Coluna CriadoPor adicionada à tabela Demandas.';
            END
            ELSE
            BEGIN
                PRINT 'Coluna CriadoPor já existe na tabela Demandas.';
            END
        `);

        // 2. Adicionar ComentarioAprovacao em Requests
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'ComentarioAprovacao')
            BEGIN
                ALTER TABLE Requests ADD ComentarioAprovacao NVARCHAR(1000) NULL;
                PRINT 'Coluna ComentarioAprovacao adicionada à tabela Requests.';
            END
            ELSE
            BEGIN
                PRINT 'Coluna ComentarioAprovacao já existe na tabela Requests.';
            END
        `);

        console.log('✨ Migração finalizada com sucesso!');
        await pool.close();
        process.exit(0);
    } catch (err) {
        console.error('❌ Erro na migração:', err.message);
        process.exit(1);
    }
}

migrate();
