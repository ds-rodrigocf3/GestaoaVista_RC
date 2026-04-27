-- ============================================================
-- GESTÃO BI — ESQUEMA COMPLETO (UNIFICADO)
-- Este arquivo contém a definição completa de tabelas e dados iniciais.
-- Instruções: Execute este script no SQL Server.
-- ============================================================

IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'gestaointernabi-database')
BEGIN
    CREATE DATABASE [gestaointernabi-database];
END
GO

USE [gestaointernabi-database];
GO

-- 1. NÍVEIS DE HIERARQUIA
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='NiveisHierarquia' AND xtype='U')
BEGIN
    CREATE TABLE NiveisHierarquia (
        Id INT PRIMARY KEY,
        Descricao NVARCHAR(100) NOT NULL
    );

    INSERT INTO NiveisHierarquia (Id, Descricao) VALUES
    (1, 'Diretoria'),
    (2, 'Superintendência'),
    (3, 'Gerência Executiva'),
    (4, 'Gerência'),
    (5, 'Coordenação / Especialista'),
    (6, 'Analista / Assistente'),
    (7, 'Estagiário');
END
GO

-- 2. ÁREAS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BI_Areas' AND xtype='U')
BEGIN
    CREATE TABLE BI_Areas (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Nome NVARCHAR(100) NOT NULL,
        Cor NVARCHAR(20) DEFAULT '#33CCCC',
        Ativo BIT DEFAULT 1,
        DataInativacao DATETIME NULL,
        DataCriacao DATETIME DEFAULT GETDATE()
    );
    
    INSERT INTO BI_Areas (Nome, Cor) VALUES
    ('BI e Analytics', '#33CCCC'),
    ('Controladoria', '#FF9900'),
    ('Tesouraria', '#4CAF50');
END
GO

-- 3. CARGOS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BI_Cargos' AND xtype='U')
BEGIN
    CREATE TABLE BI_Cargos (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Nome NVARCHAR(100) NOT NULL,
        AreaId INT FOREIGN KEY REFERENCES BI_Areas(Id),
        Ativo BIT DEFAULT 1,
        DataInativacao DATETIME NULL,
        DataCriacao DATETIME DEFAULT GETDATE()
    );
END
GO

-- 4. COLABORADORES
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BI_Colaboradores' AND xtype='U')
BEGIN
    CREATE TABLE BI_Colaboradores (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Nome NVARCHAR(100) NOT NULL,
        Cargo NVARCHAR(100),
        Gestor NVARCHAR(100),
        GestorId INT NULL,  -- FK auto-referência (adicionada após criação)
        Tp_contrato NVARCHAR(20),
        Color NVARCHAR(20),
        AvatarUrl NVARCHAR(MAX),
        Email NVARCHAR(200),
        NivelHierarquia INT NULL FOREIGN KEY REFERENCES NiveisHierarquia(Id),
        AreaId INT NULL FOREIGN KEY REFERENCES BI_Areas(Id),
        CargoId INT NULL FOREIGN KEY REFERENCES BI_Cargos(Id),
        Ativo BIT DEFAULT 1,
        DataInativacao DATETIME NULL
    );

    -- Dados iniciais base
    INSERT INTO BI_Colaboradores (Nome, Cargo, Gestor, Tp_contrato, Color, AvatarUrl, Email, NivelHierarquia) VALUES
    ('Fernando da Costa Bronzeri Pereira', 'Gerente de BI', 'Aline Kedma Nozima','INT', '#55c9fa', 'https://i.pravatar.cc/150?u=1', 'fbronzeri@elopar.com.br', 4),
    ('Pedro Cavalcanti Magliari', 'Analista de BI', 'Fernando da Costa Bronzeri Pereira','INT', '#6d7cff', 'https://i.pravatar.cc/150?u=2', 'pmagliari@elopar.com.br', 6),
    ('Péricles Damasceno', 'Engenheiro de Performance e Dados', 'Fernando da Costa Bronzeri Pereira','EXT', '#22c55e', 'https://i.pravatar.cc/150?u=3', 'pdamasceno.stefanini@elopar.com.br', 6),
    ('Rodrigo de Camargo Freitas', 'Analista de BI', 'Fernando da Costa Bronzeri Pereira','INT', '#f59e0b', 'https://i.pravatar.cc/150?u=4', 'rcamargo@elopar.com.br', 6);

    -- Definir gestor hierárquico após inserção dos dados iniciais
    UPDATE BI_Colaboradores SET GestorId = (SELECT Id FROM BI_Colaboradores WHERE Nome LIKE '%Bronzeri%')
    WHERE Nome LIKE '%Magliari%' OR Nome LIKE '%Damasceno%' OR Nome LIKE '%Camargo%';
END
GO

-- FK auto-referência de GestorId (separada para evitar erro de forward-reference)
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Colaboradores_Gestor')
    ALTER TABLE BI_Colaboradores ADD CONSTRAINT FK_Colaboradores_Gestor FOREIGN KEY (GestorId) REFERENCES BI_Colaboradores(Id);
GO

-- 5. USUÁRIOS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BI_Usuarios' AND xtype='U')
BEGIN
    CREATE TABLE BI_Usuarios (
        Id INT PRIMARY KEY IDENTITY(1,1),
        ColaboradorId INT NULL FOREIGN KEY REFERENCES BI_Colaboradores(Id),
        Email NVARCHAR(200) NOT NULL UNIQUE,
        SenhaHash NVARCHAR(500) NOT NULL,
        IsAdmin BIT DEFAULT 0,
        Ativo BIT DEFAULT 1,
        DataInativacao DATETIME NULL,
        DataCriacao DATETIME DEFAULT GETDATE(),
        UltimoLogin DATETIME NULL
    );
END
GO

-- 6. DEMANDAS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Demandas' AND xtype='U')
BEGIN
    CREATE TABLE Demandas (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Titulo NVARCHAR(300) NOT NULL,
        Descricao NVARCHAR(2000) NULL,
        ResponsavelId INT NULL FOREIGN KEY REFERENCES BI_Colaboradores(Id),
        Status NVARCHAR(50) DEFAULT 'Não Iniciado',
        Prioridade NVARCHAR(50) DEFAULT 'Média',
        InicioPlanjado DATE NULL,
        FimPlanejado DATE NULL,
        InicioRealizado DATE NULL,
        FimRealizado DATE NULL,
        ComentarioStatus NVARCHAR(1000) NULL,
        DataCriacao DATETIME DEFAULT GETDATE(),
        DataModificacao DATETIME DEFAULT GETDATE()
    );
END
GO

-- 7. TAREFAS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Tarefas' AND xtype='U')
BEGIN
    CREATE TABLE Tarefas (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Titulo NVARCHAR(200) NOT NULL,
        Descricao NVARCHAR(MAX),
        ResponsavelId INT FOREIGN KEY REFERENCES BI_Colaboradores(Id),
        DemandaId INT NULL FOREIGN KEY REFERENCES Demandas(Id),
        Status NVARCHAR(50),
        Prioridade NVARCHAR(50),
        Inicio DATE,
        Final DATE,
        ComentarioStatus NVARCHAR(1000) NULL,
        InicioRealizado DATE NULL,
        FimRealizado DATE NULL,
        Ativo BIT DEFAULT 1,  -- soft-delete
        DataCriacao DATETIME DEFAULT GETDATE(),
        DataModificacao DATETIME DEFAULT GETDATE()
    );

    -- Tarefas iniciais
    INSERT INTO Tarefas (Titulo, ResponsavelId, Status, Prioridade, Inicio, Final, Ativo) VALUES
    ('Criação do Modulo de Gestão a Vista de BI', 4, 'Em Andamento', 'Alta', '2026-04-05', '2026-04-12', 1),
    ('Sistema EAG de Liberações de Relatórios', 2, 'Concluído', 'Média', '2026-04-01', '2026-04-04', 1),
    ('RFP - Projeto MAPR Alelo e Veloe', 1, 'Em Andamento', 'Crítica', '2026-04-15', '2026-04-25', 1);
END
GO

-- 8. SOLICITAÇÕES (REQUESTS) — Férias e Escala
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Requests' AND xtype='U')
BEGIN
    CREATE TABLE Requests (
        Id INT PRIMARY KEY IDENTITY(1,1),
        EmployeeId INT FOREIGN KEY REFERENCES BI_Colaboradores(Id),
        Type NVARCHAR(100), -- 'Férias integrais', 'Escala de Trabalho', etc.
        Status NVARCHAR(50), -- 'Pendente', 'Aprovado', 'Rejeitado'
        StartDate DATE,
        EndDate DATE,
        Note NVARCHAR(500),
        Coverage NVARCHAR(100),
        Priority NVARCHAR(50),
        LocalTrabalho NVARCHAR(50), -- 'Presencial', 'Home Office'
        DataCriacao DATETIME DEFAULT GETDATE(),
        DataModificacao DATETIME DEFAULT GETDATE()
    );

    -- Exemplo inicial
    INSERT INTO Requests (EmployeeId, Type, Status, StartDate, EndDate, Note, Coverage, Priority) VALUES
    (2, 'Day-off', 'Aprovado', '2026-03-27', '2026-03-27', 'Tempo de Casa', 'Rodrigo de Camargo Freitas', 'Média');
END
GO

-- 9. HISTÓRICO DE STATUS
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='StatusHistorico' AND xtype='U')
BEGIN
    CREATE TABLE StatusHistorico (
        Id INT PRIMARY KEY IDENTITY(1,1),
        TipoEntidade NVARCHAR(20) NOT NULL, -- 'Tarefa' ou 'Demanda'
        EntidadeId INT NOT NULL,
        StatusAnterior NVARCHAR(50) NULL,
        StatusNovo NVARCHAR(50) NOT NULL,
        Comentario NVARCHAR(1000) NULL,
        UsuarioId INT NULL FOREIGN KEY REFERENCES BI_Usuarios(Id),
        DataInicio DATETIME DEFAULT GETDATE(),
        DataFim DATETIME NULL
    );
END
GO

-- 10. ÍNDICES
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Tarefas_Demanda' AND object_id = OBJECT_ID('Tarefas'))
    CREATE INDEX IX_Tarefas_Demanda ON Tarefas(DemandaId);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Tarefas_Responsavel' AND object_id = OBJECT_ID('Tarefas'))
    CREATE INDEX IX_Tarefas_Responsavel ON Tarefas(ResponsavelId);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_StatusHistorico_Entidade' AND object_id = OBJECT_ID('StatusHistorico'))
    CREATE INDEX IX_StatusHistorico_Entidade ON StatusHistorico(TipoEntidade, EntidadeId);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Requests_Employee' AND object_id = OBJECT_ID('Requests'))
    CREATE INDEX IX_Requests_Employee ON Requests(EmployeeId);
GO

-- 11. STATUS TIPOS E EVENTOS (APOIO)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BI_Status_Tipos' AND xtype='U')
BEGIN
    CREATE TABLE BI_Status_Tipos (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Nome NVARCHAR(100) NOT NULL,
        Cor NVARCHAR(20) DEFAULT '#c4c4c4',
        Aplicacao NVARCHAR(50) DEFAULT 'Ambos',
        Ordem INT DEFAULT 99,
        Ativo BIT DEFAULT 1,
        DataCriacao DATETIME DEFAULT GETDATE()
    );
END
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BI_Eventos' AND xtype='U')
BEGIN
    CREATE TABLE BI_Eventos (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Titulo NVARCHAR(200) NOT NULL,
        Descricao NVARCHAR(2000) NULL,
        DataInicio DATETIME NOT NULL,
        DataFim DATETIME NULL,
        Tipo NVARCHAR(100) DEFAULT 'Reunião',
        AreaId NVARCHAR(500) NULL,
        ResponsavelId INT NULL,
        CriadoPor INT,
        DataCriacao DATETIME DEFAULT GETDATE(),
        DataModificacao DATETIME DEFAULT GETDATE()
    );
END
GO
