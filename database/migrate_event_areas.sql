-- ============================================================
-- GESTÃO BI — MIGRAÇÃO: MÚLTIPLAS ÁREAS PARA EVENTOS
-- Altera a coluna AreaId de INT para NVARCHAR para suportar
-- múltiplos IDs de áreas (ex: "1,2,3").
-- ============================================================

USE [gestaointernabi-database];
GO

IF EXISTS (
  SELECT * FROM sys.columns 
  WHERE object_id = OBJECT_ID('BI_Eventos') AND name = 'AreaId'
)
BEGIN
    -- Se a coluna for INT, precisamos alterá-la para NVARCHAR
    -- Nota: O SQL Server permite converter INT para NVARCHAR automaticamente
    ALTER TABLE BI_Eventos
    ALTER COLUMN AreaId NVARCHAR(500) NULL;
    
    PRINT '✅ Coluna AreaId alterada para NVARCHAR(500) na tabela BI_Eventos';
END
ELSE
BEGIN
    -- Se por algum motivo a coluna não existir, criamos ela
    ALTER TABLE BI_Eventos
    ADD AreaId NVARCHAR(500) NULL;
    
    PRINT '✅ Coluna AreaId criada como NVARCHAR(500) na tabela BI_Eventos';
END
GO
