-- ============================================================
-- GESTÃO BI — SCRIPT DE MIGRAÇÃO
-- Execute este script no SQL Server Local para adicionar
-- as colunas ausentes necessárias para o funcionamento correto.
-- ============================================================

USE gestaointernabi-database;
GO

-- 1. Adicionar GestorId em BI_Colaboradores (referência hierárquica)
IF NOT EXISTS (
  SELECT * FROM sys.columns
  WHERE object_id = OBJECT_ID('BI_Colaboradores') AND name = 'GestorId'
)
BEGIN
    ALTER TABLE BI_Colaboradores
      ADD GestorId INT NULL;
    PRINT '✅ GestorId adicionado em BI_Colaboradores';
END
ELSE
    PRINT '• GestorId já existe em BI_Colaboradores — ignorado';
GO

-- 2. Adicionar a FK para GestorId (auto-referência)
IF NOT EXISTS (
  SELECT * FROM sys.foreign_keys
  WHERE name = 'FK_Colaboradores_Gestor'
)
BEGIN
    ALTER TABLE BI_Colaboradores
      ADD CONSTRAINT FK_Colaboradores_Gestor
      FOREIGN KEY (GestorId) REFERENCES BI_Colaboradores(Id);
    PRINT '✅ FK GestorId criada';
END
ELSE
    PRINT '• FK GestorId já existe — ignorado';
GO

-- 3. Adicionar Ativo em Tarefas (soft-delete)
IF NOT EXISTS (
  SELECT * FROM sys.columns
  WHERE object_id = OBJECT_ID('Tarefas') AND name = 'Ativo'
)
BEGIN
    ALTER TABLE Tarefas ADD Ativo BIT DEFAULT 1;
    -- Marcar todos os existentes como ativos
    UPDATE Tarefas SET Ativo = 1 WHERE Ativo IS NULL;
    PRINT '✅ Ativo adicionado em Tarefas';
END
ELSE
    PRINT '• Ativo já existe em Tarefas — ignorado';
GO

-- 4. Adicionar DataInativacao em BI_Usuarios (sincronia com colaborador)
IF NOT EXISTS (
  SELECT * FROM sys.columns
  WHERE object_id = OBJECT_ID('BI_Usuarios') AND name = 'DataInativacao'
)
BEGIN
    ALTER TABLE BI_Usuarios ADD DataInativacao DATETIME NULL;
    PRINT '✅ DataInativacao adicionado em BI_Usuarios';
END
ELSE
    PRINT '• DataInativacao já existe em BI_Usuarios — ignorado';
GO

-- 5. Criar tabela BI_Eventos se não existir
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BI_Eventos' AND xtype='U')
BEGIN
    CREATE TABLE BI_Eventos (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Titulo NVARCHAR(200) NOT NULL,
      Descricao NVARCHAR(1000),
      DataInicio DATETIME NOT NULL,
      DataFim DATETIME,
      Tipo NVARCHAR(50) DEFAULT 'Reunião',
      CriadoPor INT,
      DataCriacao DATETIME DEFAULT GETDATE(),
      DataModificacao DATETIME DEFAULT GETDATE()
    );
    PRINT '✅ BI_Eventos criada';
END
ELSE
    PRINT '• BI_Eventos já existe — ignorado';
GO

-- 6. Criar tabela BI_StatusTipos se não existir
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BI_StatusTipos' AND xtype='U')
BEGIN
    CREATE TABLE BI_StatusTipos (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Nome NVARCHAR(50) NOT NULL,
      Cor NVARCHAR(20) DEFAULT '#c4c4c4',
      Aplicacao NVARCHAR(20) DEFAULT 'Ambos',
      Ativo BIT DEFAULT 1,
      Ordem INT DEFAULT 99
    );
    PRINT '✅ BI_StatusTipos criada';
END
ELSE
    PRINT '• BI_StatusTipos já existe — ignorado';
GO

PRINT '';
PRINT '🎉 Migração concluída com sucesso!';
GO
