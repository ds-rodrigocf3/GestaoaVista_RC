const sql = require('mssql/msnodesqlv8');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectionString = `Driver={ODBC Driver 17 for SQL Server};Server=${process.env.DB_SERVER || 'localhost\\SQLEXPRESS'};Database=${process.env.DB_DATABASE || 'GestaoBI'};Trusted_Connection=yes;`;
const SALT_ROUNDS = 12;

const usersToCreate = [
  { email: 'admin@sistema.local', senha: 'admin', colaboradorNome: null, isAdmin: true, label: 'Administrador' },
  { email: 'fbronzeri@elopar.com.br', senha: 'mudar123', colaboradorNome: '%bronzeri%', isAdmin: false, label: 'Fernando Bronzeri' },
  { email: 'pmagliari@elopar.com.br', senha: 'mudar123', colaboradorNome: '%magliari%', isAdmin: false, label: 'Pedro Magliari' },
  { email: 'pdamasceno.stefanini@elopar.com.br', senha: 'mudar123', colaboradorNome: '%damasceno%', isAdmin: false, label: 'Péricles Damasceno' },
  { email: 'rcamargo@elopar.com.br', senha: 'mudar123', colaboradorNome: '%camargo%', isAdmin: false, label: 'Rodrigo Camargo' }
];

async function runSetup() {
  console.log('🚀 Iniciando configuração do Banco de Dados GestaoBI...\n');

  let pool;
  try {
    pool = await new sql.ConnectionPool({ connectionString }).connect();
    console.log('✅ Conectado ao SQL Server (Windows Auth)\n');

    // --- 1. Tabelas Base (Hierarquia, Áreas, Cargos) ---
    console.log('📦 Verificando tabelas estruturais...');

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='NiveisHierarquia' and xtype='U')
      BEGIN
          CREATE TABLE NiveisHierarquia (Id INT PRIMARY KEY, Descricao NVARCHAR(100) NOT NULL);
          INSERT INTO NiveisHierarquia (Id, Descricao) VALUES
          (1, 'Diretoria'), (2, 'Superintendência'), (3, 'Gerência Executiva'), (4, 'Gerência'),
          (5, 'Coordenação / Especialista'), (6, 'Analista / Assistente'), (7, 'Estagiário / Aprendiz');
      END
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BI_Areas' and xtype='U')
      CREATE TABLE BI_Areas (
          Id INT PRIMARY KEY IDENTITY(1,1), Nome NVARCHAR(100) NOT NULL, Cor NVARCHAR(20) DEFAULT '#33CCCC',
          Ativo BIT DEFAULT 1, DataInativacao DATETIME NULL, DataCriacao DATETIME DEFAULT GETDATE()
      );
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BI_Cargos' and xtype='U')
      CREATE TABLE BI_Cargos (
          Id INT PRIMARY KEY IDENTITY(1,1), Nome NVARCHAR(100) NOT NULL, AreaId INT FOREIGN KEY REFERENCES BI_Areas(Id),
          Ativo BIT DEFAULT 1, DataInativacao DATETIME NULL, DataCriacao DATETIME DEFAULT GETDATE()
      );
    `);

    // --- 2. Colaboradores e Usuários ---
    console.log('👥 Verificando colaboradores e usuários...');

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BI_Colaboradores' and xtype='U')
      CREATE TABLE BI_Colaboradores (
          Id INT PRIMARY KEY IDENTITY(1,1), Nome NVARCHAR(100) NOT NULL, Cargo NVARCHAR(100), Gestor NVARCHAR(100),
          Tp_contrato NVARCHAR(20), Color NVARCHAR(20), AvatarUrl NVARCHAR(500), Email NVARCHAR(200),
          NivelHierarquia INT NULL FOREIGN KEY REFERENCES NiveisHierarquia(Id),
          AreaId INT NULL FOREIGN KEY REFERENCES BI_Areas(Id),
          CargoId INT NULL FOREIGN KEY REFERENCES BI_Cargos(Id),
          Ativo BIT DEFAULT 1, DataInativacao DATETIME NULL
      );
      
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BI_Usuarios' and xtype='U')
      CREATE TABLE BI_Usuarios (
          Id INT PRIMARY KEY IDENTITY(1,1), ColaboradorId INT NULL FOREIGN KEY REFERENCES BI_Colaboradores(Id),
          Email NVARCHAR(200) NOT NULL UNIQUE, SenhaHash NVARCHAR(500) NOT NULL,
          IsAdmin BIT DEFAULT 0, Ativo BIT DEFAULT 1, DataCriacao DATETIME DEFAULT GETDATE(), UltimoLogin DATETIME NULL
      );
    `);

    // --- 3. Demandas e Tarefas ---
    console.log('📋 Verificando fluxos de trabalho...');

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Demandas' and xtype='U')
      CREATE TABLE Demandas (
          Id INT PRIMARY KEY IDENTITY(1,1), Titulo NVARCHAR(300) NOT NULL, Descricao NVARCHAR(2000) NULL,
          ResponsavelId INT NULL FOREIGN KEY REFERENCES BI_Colaboradores(Id), Status NVARCHAR(50) DEFAULT 'Não Iniciado',
          Prioridade NVARCHAR(50) DEFAULT 'Média', InicioPlanjado DATE NULL, FimPlanejado DATE NULL,
          InicioRealizado DATE NULL, FimRealizado DATE NULL, ComentarioStatus NVARCHAR(1000) NULL,
          DataCriacao DATETIME DEFAULT GETDATE(), DataModificacao DATETIME DEFAULT GETDATE()
      );

      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Tarefas' and xtype='U')
      CREATE TABLE Tarefas (
          Id INT PRIMARY KEY IDENTITY(1,1), Titulo NVARCHAR(200) NOT NULL, ResponsavelId INT FOREIGN KEY REFERENCES BI_Colaboradores(Id),
          DemandaId INT NULL FOREIGN KEY REFERENCES Demandas(Id), Status NVARCHAR(50), Prioridade NVARCHAR(50),
          Inicio DATE, Final DATE, ComentarioStatus NVARCHAR(1000) NULL, InicioRealizado DATE NULL, FimRealizado DATE NULL
      );
    `);

    // --- 4. Escala e Histórico ---
    console.log('🕒 Verificando escalas e histórico...');

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Requests' and xtype='U')
      CREATE TABLE Requests (
          Id INT PRIMARY KEY IDENTITY(1,1), EmployeeId INT FOREIGN KEY REFERENCES BI_Colaboradores(Id),
          Type NVARCHAR(100), Status NVARCHAR(50), StartDate DATE, EndDate DATE, Note NVARCHAR(500),
          Coverage NVARCHAR(100), Priority NVARCHAR(50), LocalTrabalho NVARCHAR(50),
          DataCriacao DATETIME DEFAULT GETDATE(), DataModificacao DATETIME DEFAULT GETDATE()
      );

      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='StatusHistorico' and xtype='U')
      CREATE TABLE StatusHistorico (
          Id INT PRIMARY KEY IDENTITY(1,1), TipoEntidade NVARCHAR(20) NOT NULL, EntidadeId INT NOT NULL,
          StatusAnterior NVARCHAR(50) NULL, StatusNovo NVARCHAR(50) NOT NULL, Comentario NVARCHAR(1000) NULL,
          UsuarioId INT NULL FOREIGN KEY REFERENCES BI_Usuarios(Id), DataInicio DATETIME DEFAULT GETDATE(), DataFim DATETIME NULL
      );
    `);

    // --- 5. Inicialização de Usuários ---
    console.log('\n🔐 Verificando usuários padrão...');
    for (const u of usersToCreate) {
      const existing = await pool.request().input('E', sql.NVARCHAR, u.email).query('SELECT Id FROM BI_Usuarios WHERE Email = @E');
      if (existing.recordset.length === 0) {
        let colabId = null;
        if (u.colaboradorNome) {
          const colab = await pool.request().input('N', sql.NVARCHAR, u.colaboradorNome).query('SELECT Id FROM BI_Colaboradores WHERE Nome LIKE @N');
          if (colab.recordset.length > 0) colabId = colab.recordset[0].Id;
        }
        const hash = await bcrypt.hash(u.senha, SALT_ROUNDS);
        await pool.request()
          .input('C', sql.INT, colabId).input('E', sql.NVARCHAR, u.email).input('H', sql.NVARCHAR, hash).input('A', sql.BIT, u.isAdmin ? 1 : 0)
          .query('INSERT INTO BI_Usuarios (ColaboradorId, Email, SenhaHash, IsAdmin) VALUES (@C, @E, @H, @A)');
        console.log(`   + Usuário criado: ${u.label} (${u.email})`);
      } else {
        console.log(`   . Usuário já existe: ${u.email}`);
      }
    }

    console.log('\n✨ Configuração concluída com sucesso!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Erro durante o setup:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

runSetup();
