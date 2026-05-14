const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

async function runMigration() {
    const isAzure = process.env.DB_ENVIRONMENT === 'azure';
    const databaseName = process.env.DB_DATABASE || process.env.LOCAL_DB_NAME || 'DB_TESTE';

    console.log(`🚀 Iniciando Migração Segura em modo: ${isAzure ? 'AZURE' : 'LOCAL'}`);

    let sqlConfig;
    if (isAzure) {
        sqlConfig = {
            user: process.env.AZURE_SQL_USERNAME || process.env.DB_USER,
            password: process.env.AZURE_SQL_PASSWORD || process.env.DB_PASSWORD,
            database: process.env.AZURE_SQL_DATABASE || process.env.DB_DATABASE || 'DB_TESTE',
            server: process.env.AZURE_SQL_SERVER || process.env.DB_SERVER,
            options: {
                encrypt: true,
                trustServerCertificate: true,
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

        const request = pool.request();

        // --- MUDANÇAS RECENTES NO ESQUEMA ---

        console.log('🛠️ Verificando e aplicando atualizações de esquema...');

        // 1. Garantir que CriadoPor existe em Demandas
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Demandas') AND name = 'CriadoPor')
            BEGIN
                ALTER TABLE Demandas ADD CriadoPor INT NULL;
                PRINT 'Adicionado: Demandas.CriadoPor';
            END
        `);

        // 2. Garantir que ComentarioAprovacao existe em Requests
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Requests') AND name = 'ComentarioAprovacao')
            BEGIN
                ALTER TABLE Requests ADD ComentarioAprovacao NVARCHAR(1000) NULL;
                PRINT 'Adicionado: Requests.ComentarioAprovacao';
            END
        `);

        // 3. Garantir que BI_StatusTipos existe (Tabela de apoio para cores de status)
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BI_StatusTipos' AND xtype='U')
            BEGIN
                CREATE TABLE BI_StatusTipos (
                    Id INT PRIMARY KEY IDENTITY(1,1), 
                    Nome NVARCHAR(100) NOT NULL, 
                    Cor NVARCHAR(20) DEFAULT '#c4c4c4', 
                    Aplicacao NVARCHAR(50) DEFAULT 'Ambos', 
                    Ordem INT DEFAULT 99, 
                    Ativo BIT DEFAULT 1, 
                    DataCriacao DATETIME DEFAULT GETDATE()
                );
                PRINT 'Criado: Tabela BI_StatusTipos';
            END
        `);

        // 4. Garantir que DataNascimento e DataAdmissao existem em Colaboradores
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Colaboradores') AND name = 'DataNascimento')
                ALTER TABLE BI_Colaboradores ADD DataNascimento DATE NULL;
            
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Colaboradores') AND name = 'DataAdmissao')
                ALTER TABLE BI_Colaboradores ADD DataAdmissao DATE NULL;
        `);

        // 5. Garantir que ExibirIdade existe (necessário para o login)
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Colaboradores') AND name = 'ExibirIdade')
                ALTER TABLE BI_Colaboradores ADD ExibirIdade BIT DEFAULT 0;
        `);

        // 6. Colunas de Delegação
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Colaboradores') AND name = 'DelegadoId')
                ALTER TABLE BI_Colaboradores ADD DelegadoId INT NULL;
            
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Colaboradores') AND name = 'DelegacaoInicio')
                ALTER TABLE BI_Colaboradores ADD DelegacaoInicio DATE NULL;
            
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Colaboradores') AND name = 'DelegacaoFim')
                ALTER TABLE BI_Colaboradores ADD DelegacaoFim DATE NULL;

            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Colaboradores') AND name = 'DelegacaoAtiva')
                ALTER TABLE BI_Colaboradores ADD DelegacaoAtiva BIT DEFAULT 0;
        `);

        // 7. Garantir que NivelHierarquia aceita NULL
        await request.query(`
            ALTER TABLE BI_Colaboradores ALTER COLUMN NivelHierarquia INT NULL;
        `);

        // 8. Colunas de Perfil Profissional
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Colaboradores') AND name = 'ResumoProfissional')
                ALTER TABLE BI_Colaboradores ADD ResumoProfissional NVARCHAR(MAX) NULL;
            
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Colaboradores') AND name = 'TimelineRealizacoes')
                ALTER TABLE BI_Colaboradores ADD TimelineRealizacoes NVARCHAR(MAX) NULL;

            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Colaboradores') AND name = 'Formacoes')
                ALTER TABLE BI_Colaboradores ADD Formacoes NVARCHAR(MAX) NULL;

            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Colaboradores') AND name = 'MeritosPromocoes')
                ALTER TABLE BI_Colaboradores ADD MeritosPromocoes NVARCHAR(MAX) NULL;
        `);

        console.log('✨ Migração finalizada com sucesso!');
        await pool.close();
        process.exit(0);
    } catch (err) {
        console.error('❌ Erro na migração:', err.message);
        process.exit(1);
    }
}

runMigration();
