# 🔐 Autenticação Windows - Guia Rápido

## O que é Autenticação Windows?

Autenticação Windows (Integrated Security) permite usar suas credenciais do Windows para acessar o SQL Server sem precisar armazenar senhas.

**Vantagens:**
- ✅ Mais seguro (sem senhas em texto plano)
- ✅ Usa suas credenciais do Windows
- ✅ Configuração mais simples
- ✅ Sincronizado com seu usuário do SO

**Desvantagens:**
- ❌ Funciona apenas no Windows
- ❌ Requer executar como administrador
- ❌ Não funciona em máquinas remotas facilmente

---

## Como Usar (3 passos)

### 1️⃣ Editar o `.env`

```env
USE_LOCAL_DB=true
LOCAL_DB_AUTH_TYPE=windows
LOCAL_DB_SERVER=(localdb)\MSSQLLocalDB
LOCAL_DB_NAME=GestaoVista
```

**Nota:** Não é necessário adicionar `LOCAL_DB_USER` ou `LOCAL_DB_PASSWORD`

### 2️⃣ Executar como Administrador

Abra PowerShell ou CMD **como Administrador**:

```powershell
# PowerShell
Start-Process powershell -Verb RunAs
cd "c:\Users\rodri\OneDrive\Área de Trabalho\GestaoaVista_RC"
node server.js
```

Ou via atalho (Win+X, A no Windows 11)

### 3️⃣ Acessar a aplicação

```
http://localhost:3000
```

Esperado ver:
```
🔧 Modo DESENVOLVIMENTO - SQL Server Local
🔐 Usando autenticação Windows integrada
✅ Conectado ao SQL Server Local com sucesso!
🚀 Servidor rodando na porta 3000
```

---

## Troubleshooting

### Erro: "Connection refused"
- ❌ Não está rodando como Administrador
- ✅ Abra PowerShell/CMD como Admin (Win+X → A)

### Erro: "Login failed for user"
- ❌ Seu usuário Windows não tem permissão no SQL Server
- ✅ Veja a seção "Adicionar Permissão Windows" abaixo

### Erro: "Named pipe provider, error: 40"
- ❌ SQL Server não está rodando ou not found
- ✅ Inicie com: `sqllocaldb start MSSQLLocalDB`

---

## Adicionar Permissão Windows no SQL Server

Se seu usuário Windows não consegue acessar:

1. **Abra SQL Server Management Studio como Admin**
2. Conecte com autenticação Windows
3. Vá em: `Security` → `Logins` (lado esquerdo)
4. Clique com botão direito → `New Login`
5. Em "Login name", clique em `Search...`
6. Digite seu usuário: `COMPUTADOR\usuario`
7. Clique `OK`
8. Vá para `User Mapping` e marque `GestaoVista` com role `db_owner`
9. Clique `OK` para salvar

---

## Trocar entre Autenticações

### De Windows para SQL

```env
# Mude isto:
LOCAL_DB_AUTH_TYPE=windows

# Para isto:
LOCAL_DB_AUTH_TYPE=sql
LOCAL_DB_USER=sa
LOCAL_DB_PASSWORD=SuaSenha123
```

### De SQL para Windows

```env
# Mude isto:
LOCAL_DB_AUTH_TYPE=sql
LOCAL_DB_USER=sa
LOCAL_DB_PASSWORD=SuaSenha123

# Para isto:
LOCAL_DB_AUTH_TYPE=windows
```

Depois reinicie o servidor: `node server.js`

---

## Comandos Úteis

### Testar conexão com autenticação Windows
```bash
sqlcmd -S (localdb)\MSSQLLocalDB -E -Q "SELECT @@VERSION"
# -E = usar Windows Auth
# -Q = executar query
```

### Iniciar SQL Server LocalDB
```bash
sqllocaldb start MSSQLLocalDB
```

### Parar SQL Server LocalDB
```bash
sqllocaldb stop MSSQLLocalDB
```

### Listar instâncias LocalDB
```bash
sqllocaldb info
```

---

## Comparação: Windows vs SQL

| Aspecto | Windows | SQL |
|--------|---------|-----|
| Segurança | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Facilidade | ⭐⭐⭐⭐ | ⭐⭐ |
| Cross-plataforma | ❌ | ✅ |
| Senhas armazenadas | ❌ | ✅ |
| Requer admin | ✅ | ❌ |
| Produção | ⭐⭐ | ⭐⭐⭐⭐ |

---

## 💡 Recomendação

Para **desenvolvimento local** → Use **autenticação Windows** ✅

Para **produção/remote** → Use **autenticação SQL** ou **Azure SQL**
