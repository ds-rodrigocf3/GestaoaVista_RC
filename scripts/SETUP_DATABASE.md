# 🚀 Guia de Conexão - SQL Server Local vs Azure SQL

## 📌 Opção 1: SQL Server Local (Recomendado para Desenvolvimento)

### Pré-requisitos
- SQL Server Local, Express ou Standard instalado
- SQL Management Studio (opcional, mas recomendado)

### Variáveis de Autenticação

#### Autenticação Windows (Integrada) - RECOMENDADO ⭐
Usa suas credenciais de usuário do Windows. Nenhuma senha necessária.

```env
USE_LOCAL_DB=true
LOCAL_DB_AUTH_TYPE=windows
LOCAL_DB_SERVER=(localdb)\MSSQLLocalDB
LOCAL_DB_NAME=GestaoVista
```

**Vantagens:**
- Mais seguro (sem senhas armazenadas)
- Usa credenciais do Windows
- Mais simples de configurar

**Desvantagens:**
- Deve estar rodando como admin
- Funciona apenas em máquinas Windows

#### Autenticação SQL (user/password)
Usa usuário `sa` ou outro usuário SQL.

```env
USE_LOCAL_DB=true
LOCAL_DB_AUTH_TYPE=sql
LOCAL_DB_USER=sa
LOCAL_DB_PASSWORD=SuaSenha123
LOCAL_DB_SERVER=(localdb)\MSSQLLocalDB
LOCAL_DB_NAME=GestaoVista
```

### Passo 1: Configurar o .env
```bash
# Copie o arquivo .env.local para .env
cp .env.local .env

# Edite conforme necessário (ou deixe o padrão)
```

### Passo 2: Editar o .env com suas credenciais

**Para Autenticação Windows:**
```
USE_LOCAL_DB=true
LOCAL_DB_AUTH_TYPE=windows
LOCAL_DB_SERVER=(localdb)\MSSQLLocalDB
LOCAL_DB_NAME=GestaoVista
```

**Para Autenticação SQL:**
```
USE_LOCAL_DB=true
LOCAL_DB_AUTH_TYPE=sql
LOCAL_DB_USER=sa
LOCAL_DB_PASSWORD=SuaSenha123
LOCAL_DB_SERVER=(localdb)\MSSQLLocalDB
LOCAL_DB_NAME=GestaoVista
```

### Opções de LOCAL_DB_SERVER

#### SQL Server LocalDB (Padrão)
```
LOCAL_DB_SERVER=(localdb)\MSSQLLocalDB
```

#### SQL Server Express
```
LOCAL_DB_SERVER=localhost\SQLEXPRESS
```

#### SQL Server (Standard/Enterprise no localhost)
```
LOCAL_DB_SERVER=localhost
```

#### SQL Server remoto (outro computador)
```
LOCAL_DB_SERVER=192.168.1.100\SQLEXPRESS
```

### Passo 3: Iniciar o servidor
```bash
node server.js
```

**Para Autenticação Windows:**
```
🔧 Modo DESENVOLVIMENTO - SQL Server Local
🔐 Usando autenticação Windows integrada
✅ Conectado ao SQL Server Local com sucesso!
🚀 Servidor rodando na porta 3000
   http://localhost:3000
```

**Para Autenticação SQL:**
```
🔧 Modo DESENVOLVIMENTO - SQL Server Local
🔐 Usando autenticação SQL (user/password)
✅ Conectado ao SQL Server Local com sucesso!
🚀 Servidor rodando na porta 3000
   http://localhost:3000
```

---

## 📌 Opção 2: Azure SQL (Produção)

### Pré-requisitos
- Banco Azure SQL provisionado
- Credenciais do Azure SQL

### Passo 1: Configurar o .env
```
USE_LOCAL_DB=false
DB_USER=seu_usuario@seu_servidor
DB_PASSWORD=sua_senha_forte
DB_SERVER=seu_servidor.database.windows.net
DB_DATABASE=sua_database
```

### Passo 2: Iniciar o servidor
```bash
node server.js
```

Você deve ver:
```
🚀 Modo PRODUÇÃO - Azure SQL
✅ Conectado ao Azure SQL com sucesso!
🚀 Servidor rodando na porta 3000
   http://localhost:3000
```

---

## 🔧 Solução de Problemas

### Autenticação Windows não funciona

**Problema: "Error: 'Connection Refused'"**

**Causa 1: Não está rodando como administrador**
- Abra PowerShell/CMD como Administrador
- Execute `node server.js` novamente

**Causa 2: Usuário Windows não tem permissão**
- Abra SQL Server Management Studio como Admin
- Vá em Security > Logins
- Verifique se sua conta Windows está listada
- Se não estiver, clique em New Login
- Digite seu usuário no formato `COMPUTADOR\usuario`
- Grant acesso ao banco GestaoVista

**Causa 3: SQL Server não está rodando**
```bash
# Verifique se o serviço está ativo
Get-Service -Name "MSSQL*" | Start-Service

# Ou para LocalDB:
sqllocaldb start MSSQLLocalDB
```

### Erro: "Falha ao conectar ao SQL Server Local"

**Problema 1: SQL Server não está instalado**
- Baixe SQL Server Express em: https://www.microsoft.com/pt-br/sql-server/sql-server-downloads
- Ou use LocalDB: https://learn.microsoft.com/pt-br/sql/database-engine/configure-windows/sql-server-express-localdb

**Problema 2: Credenciais SQL incorretas (autenticação=sql)**
- Verifique o usuário (geralmente `sa`)
- Verifique a senha configurada durante instalação
- Use SQL Management Studio para testar conexão

**Problema 3: Servidor não encontrado**
- Verifique o nome do servidor: `(localdb)\MSSQLLocalDB`, `localhost\SQLEXPRESS`, etc.
- Use este comando para listar servidores:
```bash
sqlcmd -L
```

### Erro: "Banco de dados não existe"

Execute este script SQL para criar o banco:

```sql
-- Criar banco de dados
CREATE DATABASE GestaoVista;

-- Usar o novo banco
USE GestaoVista;

-- Criar tabelas básicas (se necessário)
CREATE TABLE BI_Colaboradores (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Nome NVARCHAR(100),
    Email NVARCHAR(200),
    NivelHierarquia INT,
    CargoId INT,
    AreaId INT,
    GestorId INT,
    Color NVARCHAR(20),
    AvatarUrl NVARCHAR(500),
    Ativo BIT DEFAULT 1
);

-- Continuar com outras tabelas conforme necessário...
```

### Trocar de Autenticação Windows para SQL

Se quiser mudar de autenticação Windows para SQL (ou vice-versa):

1. **Edite o `.env`:**
```env
# De Windows:
LOCAL_DB_AUTH_TYPE=windows

# Para SQL:
LOCAL_DB_AUTH_TYPE=sql
LOCAL_DB_USER=sa
LOCAL_DB_PASSWORD=SuaSenha123
```

2. **Reinicie o servidor:**
```bash
node server.js
```

---

## 📊 Variáveis de Ambiente Suportadas

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `USE_LOCAL_DB` | `true` | Usa SQL Server Local (true) ou Azure (false) |
| `LOCAL_DB_USER` | `sa` | Usuário do SQL Server Local |
| `LOCAL_DB_PASSWORD` | `SuaSenha123` | Senha do SQL Server Local |
| `LOCAL_DB_SERVER` | `(localdb)\MSSQLLocalDB` | Servidor SQL Local |
| `LOCAL_DB_NAME` | `GestaoVista` | Nome do banco de dados local |
| `PORT` | `3000` | Porta do servidor Node.js |

---

## 🎯 Fluxo de Escolha Automático

O servidor tenta conectar nesta ordem:
1. **Se `USE_LOCAL_DB=true`** → SQL Server Local
2. **Se `USE_LOCAL_DB=false` ou não definido** → Azure SQL
3. **Se Azure falhar** → Erro e saída

---

## 💡 Dicas Úteis

### Testar conexão antes de iniciar
```bash
sqlcmd -S (localdb)\MSSQLLocalDB -U sa -P SuaSenha123 -Q "SELECT @@VERSION"
```

### Ver bancos disponíveis
```bash
sqlcmd -S (localdb)\MSSQLLocalDB -U sa -P SuaSenha123 -Q "SELECT name FROM sys.databases"
```

### Criar banco via comando
```bash
sqlcmd -S (localdb)\MSSQLLocalDB -U sa -P SuaSenha123 -Q "CREATE DATABASE GestaoVista"
```

---

## 🔒 Segurança

⚠️ **IMPORTANTE**: Nunca commit as credenciais do banco no git!

```bash
# Adicione ao .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

Use variáveis de ambiente em produção:
```bash
export DB_USER="seu_usuario"
export DB_PASSWORD="sua_senha"
export DB_SERVER="seu_servidor.database.windows.net"
export DB_DATABASE="sua_database"
```
