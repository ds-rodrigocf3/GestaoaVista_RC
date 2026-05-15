-- ============================================================
-- SCRIPT DE SINCRONIZAÇÃO DE SCHEMA - V2
-- Corrige gaps nas tabelas BI_Areas, BI_Cargos, BI_Colaboradores e BI_Eventos
-- ============================================================

-- 1. Ajustes em BI_Areas
IF EXISTS (SELECT * FROM sysobjects WHERE name='BI_Areas' AND xtype='U')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Areas') AND name = 'Ativo')
        ALTER TABLE BI_Areas ADD Ativo BIT DEFAULT 1;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Areas') AND name = 'DataInativacao')
        ALTER TABLE BI_Areas ADD DataInativacao DATETIME NULL;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Areas') AND name = 'DataCriacao')
        ALTER TABLE BI_Areas ADD DataCriacao DATETIME DEFAULT GETDATE();
END
GO

-- 2. Ajustes em BI_Cargos
IF EXISTS (SELECT * FROM sysobjects WHERE name='BI_Cargos' AND xtype='U')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Cargos') AND name = 'Ativo')
        ALTER TABLE BI_Cargos ADD Ativo BIT DEFAULT 1;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Cargos') AND name = 'DataInativacao')
        ALTER TABLE BI_Cargos ADD DataInativacao DATETIME NULL;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Cargos') AND name = 'DataCriacao')
        ALTER TABLE BI_Cargos ADD DataCriacao DATETIME DEFAULT GETDATE();
END
GO

-- 3. Ajustes em BI_Colaboradores
IF EXISTS (SELECT * FROM sysobjects WHERE name='BI_Colaboradores' AND xtype='U')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Colaboradores') AND name = 'Ativo')
        ALTER TABLE BI_Colaboradores ADD Ativo BIT DEFAULT 1;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Colaboradores') AND name = 'DataInativacao')
        ALTER TABLE BI_Colaboradores ADD DataInativacao DATETIME NULL;
END
GO

-- 4. Garantir BI_Eventos completa
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
ELSE
BEGIN
    -- Se a tabela existe, verificar se faltam as colunas que deram erro no SSMS
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Eventos') AND name = 'Titulo')
        ALTER TABLE BI_Eventos ADD Titulo NVARCHAR(200) NOT NULL DEFAULT 'Sem Título';
        
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Eventos') AND name = 'Descricao')
        ALTER TABLE BI_Eventos ADD Descricao NVARCHAR(2000) NULL;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Eventos') AND name = 'DataInicio')
        ALTER TABLE BI_Eventos ADD DataInicio DATETIME NOT NULL DEFAULT GETDATE();

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Eventos') AND name = 'DataFim')
        ALTER TABLE BI_Eventos ADD DataFim DATETIME NULL;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('BI_Eventos') AND name = 'Tipo')
        ALTER TABLE BI_Eventos ADD Tipo NVARCHAR(100) DEFAULT 'Reunião';
END
GO

-- 5. Garantir BI_Status_Tipos
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

PRINT 'Schema auditado e corrigido com sucesso.';
