@echo off
REM Teste de conexão ao SQL Server Local
REM Este script ajuda a diagnosticar problemas de conexão

echo.
echo ====================================================
echo Testando conexao com SQL Server Local
echo ====================================================
echo.

REM Teste 1: Listar servidores disponíveis
echo [1/3] Procurando servidores SQL disponiveis...
sqlcmd -L
echo.

REM Teste 2: Testar conexão com LocalDB
echo [2/3] Testando conexao com (localdb)\MSSQLLocalDB...
sqlcmd -S (localdb)\MSSQLLocalDB -U sa -P SuaSenha123 -Q "SELECT @@VERSION" 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Conexao bem-sucedida!
) else (
    echo [ERRO] Nao foi possivel conectar
    echo Verifique:
    echo - Senha correta (use a senha configurada na instalacao)
    echo - SQL Server esta rodando
    echo - LocalDB esta instalado
)
echo.

REM Teste 3: Testar com SQL Server Express (se disponivel)
echo [3/3] Testando conexao com localhost\SQLEXPRESS...
sqlcmd -S localhost\SQLEXPRESS -U sa -P SuaSenha123 -Q "SELECT @@VERSION" 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Conexao bem-sucedida com SQL Server Express!
) else (
    echo [INFO] SQL Server Express nao encontrado (isso e normal se nao instalado)
)
echo.

echo ====================================================
echo Teste concluido
echo ====================================================
pause
