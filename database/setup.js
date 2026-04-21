const sql = require('mssql');
const bcrypt = require('bcryptjs');
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

async function runSetup() {
  console.log('🚀 Reiniciando Banco de Dados Local com Esquema Completo...');
  let pool;
  try {
    pool = await sql.connect(sqlConfig);

    console.log('🧹 Limpando tabelas antigas...');
    await pool.request().query(`
        -- Ordem inversa de dependência para evitar erros de FK
        DROP TABLE IF EXISTS StatusHistorico;
        DROP TABLE IF EXISTS Tarefas;
        DROP TABLE IF EXISTS Demandas;
        DROP TABLE IF EXISTS Requests;
        DROP TABLE IF EXISTS BI_Eventos;
        DROP TABLE IF EXISTS BI_Usuarios;
        DROP TABLE IF EXISTS BI_Colaboradores;
        DROP TABLE IF EXISTS BI_StatusTipos; -- Nome usado no server.js
        DROP TABLE IF EXISTS BI_Cargos;
        DROP TABLE IF EXISTS BI_Areas;
        DROP TABLE IF EXISTS NiveisHierarquia;
    `);

    console.log('🏗️ Criando novas tabelas...');
    await pool.request().query(`
        CREATE TABLE NiveisHierarquia (Id INT PRIMARY KEY, Descricao NVARCHAR(100));
        INSERT INTO NiveisHierarquia (Id, Descricao) VALUES 
        (1, 'Diretoria'), (2, 'Superintendência'), (3, 'Gerência Executiva'), 
        (4, 'Gerência'), (5, 'Coordenação / Especialista'), (6, 'Analista / Assistente'), (7, 'Estagiário');

        CREATE TABLE BI_Areas (Id INT PRIMARY KEY IDENTITY(1,1), Nome NVARCHAR(100), Cor NVARCHAR(20));
        INSERT INTO BI_Areas (Nome, Cor) VALUES ('BI e Analytics', '#33CCCC'), ('Controladoria', '#FF9900'), ('Tesouraria', '#4CAF50');

        CREATE TABLE BI_Cargos (Id INT PRIMARY KEY IDENTITY(1,1), Nome NVARCHAR(100), AreaId INT FOREIGN KEY REFERENCES BI_Areas(Id), Ativo BIT DEFAULT 1);
        
        CREATE TABLE BI_StatusTipos (
            Id INT PRIMARY KEY IDENTITY(1,1), Nome NVARCHAR(100) NOT NULL, Cor NVARCHAR(20) DEFAULT '#c4c4c4', 
            Aplicacao NVARCHAR(50) DEFAULT 'Ambos', Ordem INT DEFAULT 99, Ativo BIT DEFAULT 1, DataCriacao DATETIME DEFAULT GETDATE()
        );

        CREATE TABLE BI_Colaboradores (
            Id INT PRIMARY KEY IDENTITY(1,1), Nome NVARCHAR(100), Cargo NVARCHAR(100), Gestor NVARCHAR(100),
            Tp_contrato NVARCHAR(20), Color NVARCHAR(20), AvatarUrl NVARCHAR(500), Email NVARCHAR(200),
            NivelHierarquia INT FOREIGN KEY REFERENCES NiveisHierarquia(Id),
            AreaId INT FOREIGN KEY REFERENCES BI_Areas(Id),
            CargoId INT NULL, GestorId INT NULL, Ativo BIT DEFAULT 1
        );

        CREATE TABLE BI_Usuarios (
            Id INT PRIMARY KEY IDENTITY(1,1), ColaboradorId INT FOREIGN KEY REFERENCES BI_Colaboradores(Id),
            Email NVARCHAR(200) NOT NULL UNIQUE, SenhaHash NVARCHAR(500) NOT NULL,
            IsAdmin BIT DEFAULT 0, Ativo BIT DEFAULT 1, UltimoLogin DATETIME NULL
        );

        CREATE TABLE Demandas (
            Id INT PRIMARY KEY IDENTITY(1,1), Titulo NVARCHAR(300) NOT NULL, Descricao NVARCHAR(2000) NULL,
            ResponsavelId INT NULL FOREIGN KEY REFERENCES BI_Colaboradores(Id),
            Status NVARCHAR(50) DEFAULT 'Não Iniciado', Prioridade NVARCHAR(50) DEFAULT 'Média',
            InicioPlanjado DATE NULL, FimPlanejado DATE NULL, InicioRealizado DATE NULL, FimRealizado DATE NULL,
            ComentarioStatus NVARCHAR(1000) NULL, DataCriacao DATETIME DEFAULT GETDATE(), DataModificacao DATETIME DEFAULT GETDATE()
        );

        CREATE TABLE Tarefas (
            Id INT PRIMARY KEY IDENTITY(1,1), Titulo NVARCHAR(200) NOT NULL, 
            ResponsavelId INT FOREIGN KEY REFERENCES BI_Colaboradores(Id),
            DemandaId INT NULL FOREIGN KEY REFERENCES Demandas(Id),
            Status NVARCHAR(50), Prioridade NVARCHAR(50), Inicio DATE, Final DATE,
            ComentarioStatus NVARCHAR(1000) NULL, InicioRealizado DATE NULL, FimRealizado DATE NULL, Ativo BIT DEFAULT 1
        );

        CREATE TABLE Requests (
            Id INT PRIMARY KEY IDENTITY(1,1), EmployeeId INT FOREIGN KEY REFERENCES BI_Colaboradores(Id),
            Type NVARCHAR(100), Status NVARCHAR(50), StartDate DATE, EndDate DATE, Note NVARCHAR(500),
            Coverage NVARCHAR(100), Priority NVARCHAR(50), LocalTrabalho NVARCHAR(50), 
            DataCriacao DATETIME DEFAULT GETDATE(), DataModificacao DATETIME DEFAULT GETDATE()
        );

        CREATE TABLE StatusHistorico (
            Id INT PRIMARY KEY IDENTITY(1,1), TipoEntidade NVARCHAR(20) NOT NULL, EntidadeId INT NOT NULL,
            StatusAnterior NVARCHAR(50) NULL, StatusNovo NVARCHAR(50) NOT NULL, Comentario NVARCHAR(1000) NULL,
            UsuarioId INT NULL FOREIGN KEY REFERENCES BI_Usuarios(Id), DataInicio DATETIME DEFAULT GETDATE(), DataFim DATETIME NULL
        );

        CREATE TABLE BI_Eventos (
            Id INT PRIMARY KEY IDENTITY(1,1), Titulo NVARCHAR(200) NOT NULL, Descricao NVARCHAR(2000) NULL,
            DataInicio DATETIME NOT NULL, DataFim DATETIME NULL, Tipo NVARCHAR(100) DEFAULT 'Reunião',
            AreaId INT NULL, ResponsavelId INT NULL, CriadoPor INT,
            DataCriacao DATETIME DEFAULT GETDATE(), DataModificacao DATETIME DEFAULT GETDATE()
        );
    `);

    console.log('👥 Criando usuário administrador...');
    const hash = await bcrypt.hash('admin', 12);
    await pool.request().query(`
        INSERT INTO BI_Colaboradores (Nome, Email, NivelHierarquia, AreaId, Cargo, Gestor, Color, Tp_contrato) 
        VALUES ('Administrador Local', 'admin@sistema.local', 1, 1, 'Administrador Geral', 'Conselho', '#33CCCC', 'CLT');
        DECLARE @ColabId INT = SCOPE_IDENTITY();
        INSERT INTO BI_Usuarios (ColaboradorId, Email, SenhaHash, IsAdmin) VALUES (@ColabId, 'admin@sistema.local', '${hash}', 1);
    `);

    console.log('📋 Inserindo dados iniciais em Demandas e Tarefas...');
    await pool.request().query(`
        INSERT INTO Demandas (Titulo, Status, Prioridade, ResponsavelId) VALUES ('Projeto Piloto Gestão à Vista', 'Em Andamento', 'Alta', 1);
        DECLARE @DemId INT = SCOPE_IDENTITY();
        INSERT INTO Tarefas (Titulo, ResponsavelId, DemandaId, Status, Prioridade, Inicio, Final) VALUES 
        ('Setup do Ambiente', 1, @DemId, 'Concluído', 'Alta', GETDATE(), GETDATE()),
        ('Desenvolvimento do Dashboard', 1, @DemId, 'Em Andamento', 'Alta', GETDATE(), DATEADD(day, 7, GETDATE()));
    `);

    console.log('✨ Setup completo!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro no setup:', err.message);
    process.exit(1);
  }
}
runSetup();
