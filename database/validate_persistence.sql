-- Script de Validação: Verificar Persistência de Escala e Agendamentos
-- Execute este script no SQL Server Management Studio para verificar se os dados estão sendo salvos

-- 1. Verificar tabela Requests existe e tem dados
USE [gestaointernabi-database];

PRINT '========================================';
PRINT 'VALIDAÇÃO DE PERSISTÊNCIA';
PRINT '========================================';

-- 2. Contar registros totais
PRINT '';
PRINT '📊 Total de Registros na Tabela Requests:';
SELECT COUNT(*) as TotalRegistros FROM Requests;

-- 3. Contar por tipo
PRINT '';
PRINT '📋 Distribuição por Tipo:';
SELECT Type, COUNT(*) as Quantidade FROM Requests
GROUP BY Type
ORDER BY Quantidade DESC;

-- 4. Verificar Escalas de Trabalho
PRINT '';
PRINT '📅 Escalas de Trabalho Registradas:';
SELECT TOP 50
    r.Id,
    c.Nome as Colaborador,
    r.StartDate as Data,
    r.LocalTrabalho as Local,
    r.Status,
    r.DataCriacao,
    r.DataModificacao
FROM Requests r
LEFT JOIN BI_Colaboradores c ON r.EmployeeId = c.Id
WHERE r.Type = 'Escala de Trabalho'
ORDER BY r.StartDate DESC;

-- 5. Verificar Agendamentos (Férias, etc)
PRINT '';
PRINT '🏖️  Agendamentos Registrados:';
SELECT TOP 50
    r.Id,
    c.Nome as Colaborador,
    r.Type,
    r.StartDate as DataInicio,
    r.EndDate as DataFim,
    r.Status,
    r.DataCriacao
FROM Requests r
LEFT JOIN BI_Colaboradores c ON r.EmployeeId = c.Id
WHERE r.Type IN ('Férias integrais', 'Férias fracionadas', 'Day-off', 'Saúde (Exames/Consultas)')
ORDER BY r.StartDate DESC;

-- 6. Verificar consistência (escalas sem LocalTrabalho)
PRINT '';
PRINT '⚠️  Escalas SEM LocalTrabalho (Inconsistência):';
SELECT COUNT(*) as Inconsistencias FROM Requests
WHERE Type = 'Escala de Trabalho'
AND (LocalTrabalho IS NULL OR LocalTrabalho = '');

IF EXISTS (SELECT 1 FROM Requests WHERE Type = 'Escala de Trabalho' AND (LocalTrabalho IS NULL OR LocalTrabalho = ''))
BEGIN
    PRINT 'ATENÇÃO: Existem escalas sem LocalTrabalho definido!';
    PRINT 'Limpar com: DELETE FROM Requests WHERE Type=''Escala de Trabalho'' AND (LocalTrabalho IS NULL OR LocalTrabalho = '''')';
END
ELSE
BEGIN
    PRINT 'Nenhuma inconsistência encontrada ✅';
END

-- 7. Verificar dados criados hoje
PRINT '';
PRINT '🔔 Registros Criados Hoje:';
SELECT 
    Id,
    Type,
    Status,
    CAST(DataCriacao AS TIME) as HoraCriacao
FROM Requests
WHERE CAST(DataCriacao AS DATE) = CAST(GETDATE() AS DATE)
ORDER BY DataCriacao DESC;

-- 8. Verificar estrutura da tabela
PRINT '';
PRINT '📋 Colunas da Tabela Requests:';
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Requests'
ORDER BY ORDINAL_POSITION;

-- 9. Verificar índices
PRINT '';
PRINT '🔑 Índices na Tabela Requests:';
SELECT INDEX_NAME, COLUMN_NAME 
FROM INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE 
WHERE TABLE_NAME = 'Requests';

PRINT '';
PRINT '========================================';
PRINT 'VALIDAÇÃO CONCLUÍDA';
PRINT '========================================';
