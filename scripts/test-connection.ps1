# Script para testar e gerenciar SQL Server Local
# Execute: .\test-connection.ps1

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Teste de Conexao - SQL Server Local" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Configuracoes
$SERVER = "(localdb)\MSSQLLocalDB"
$USER = "sa"
$PASSWORD = "SuaSenha123"
$DATABASE = "GestaoVista"

# Teste 1: Listar servidores disponiveis
Write-Host "[1/4] Procurando servidores SQL disponiveis..." -ForegroundColor Yellow
$servidores = sqlcmd -L
if ($servidores) {
    Write-Host "[OK] Servidores encontrados:" -ForegroundColor Green
    $servidores | ForEach-Object { Write-Host "  - $_" }
} else {
    Write-Host "[AVISO] Nenhum servidor encontrado" -ForegroundColor Yellow
}
Write-Host ""

# Teste 2: Conectar ao LocalDB
Write-Host "[2/4] Testando conexao com $SERVER..." -ForegroundColor Yellow
try {
    $resultado = sqlcmd -S $SERVER -U $USER -P $PASSWORD -Q "SELECT @@VERSION" 2>&1
    if ($resultado -match "SQL Server") {
        Write-Host "[OK] Conexao bem-sucedida!" -ForegroundColor Green
        Write-Host "  Versao: $($resultado[0])" -ForegroundColor Green
    } else {
        Write-Host "[ERRO] Falha na conexao" -ForegroundColor Red
    }
} catch {
    Write-Host "[ERRO] $($_)" -ForegroundColor Red
}
Write-Host ""

# Teste 3: Listar bancos de dados
Write-Host "[3/4] Bancos de dados disponiveis:" -ForegroundColor Yellow
try {
    $bancos = sqlcmd -S $SERVER -U $USER -P $PASSWORD -Q "SELECT name FROM sys.databases ORDER BY name" 2>&1
    if ($bancos -match "master") {
        $bancos | ForEach-Object { 
            if ($_ -and $_ -notmatch "---" -and $_ -notmatch "(row" -and $_.Trim()) {
                Write-Host "  - $_" -ForegroundColor Cyan
            }
        }
    }
} catch {
    Write-Host "[ERRO] Nao foi possivel listar bancos" -ForegroundColor Red
}
Write-Host ""

# Teste 4: Verificar banco GestaoVista
Write-Host "[4/4] Verificando banco '$DATABASE'..." -ForegroundColor Yellow
try {
    $dbExiste = sqlcmd -S $SERVER -U $USER -P $PASSWORD -Q "SELECT COUNT(*) FROM sys.databases WHERE name = '$DATABASE'" 2>&1
    if ($dbExiste -match "1") {
        Write-Host "[OK] Banco '$DATABASE' existe!" -ForegroundColor Green
        
        # Listar tabelas
        $tabelas = sqlcmd -S $SERVER -U $USER -P $DATABASE -Q "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo'" 2>&1
        Write-Host "  Tabelas encontradas:" -ForegroundColor Cyan
        $tabelas | Where-Object { $_ -and $_ -notmatch "---" -and $_ -notmatch "(row" } | ForEach-Object {
            if ($_.Trim()) { Write-Host "    - $_" }
        }
    } else {
        Write-Host "[AVISO] Banco '$DATABASE' nao encontrado" -ForegroundColor Yellow
        Write-Host "  Criando banco..." -ForegroundColor Yellow
        sqlcmd -S $SERVER -U $USER -P $PASSWORD -Q "CREATE DATABASE $DATABASE" 2>&1 | Out-Null
        Write-Host "  [OK] Banco criado com sucesso!" -ForegroundColor Green
    }
} catch {
    Write-Host "[ERRO] $($_)" -ForegroundColor Red
}
Write-Host ""

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Teste concluido" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Oferecendo opcoes
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Yellow
Write-Host "1. Editar o arquivo .env com suas credenciais" -ForegroundColor Cyan
Write-Host "2. Executar: node server.js" -ForegroundColor Cyan
Write-Host "3. Acessar: http://localhost:3000" -ForegroundColor Cyan
