## Como habilitar TCP/IP no SQL Server SQLEXPRESS01

O driver Node.js (`mssql`) usa TCP/IP para se conectar ao SQL Server.
Atualmente o TCP está desabilitado na instância SQLEXPRESS01.

### Opção A - Script PowerShell (executar como Administrador)

Abra o **PowerShell como Administrador** e cole:

```powershell
# 1. Ativar TCP na instância SQLEXPRESS01
$reg = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL17.SQLEXPRESS01\MSSQLServer\SuperSocketNetLib\Tcp"
Set-ItemProperty -Path $reg -Name "Enabled" -Value 1

# 2. Definir porta fixa 1433 para todas as IPs
$ipAll = "$reg\IPAll"
Set-ItemProperty -Path $ipAll -Name "TcpPort" -Value "1433"
Set-ItemProperty -Path $ipAll -Name "TcpDynamicPorts" -Value ""

# 3. Reiniciar o serviço
Restart-Service -Name "MSSQL`$SQLEXPRESS01" -Force
Write-Host "✅ TCP ativado na porta 1433. Pronto!"
```

### Opção B - SQL Server Configuration Manager (GUI)

1. Abra **SQL Server Configuration Manager** (pesquise no menu iniciar)
2. Expanda **SQL Server Network Configuration**
3. Clique em **Protocols for SQLEXPRESS01**
4. Clique com botão direito em **TCP/IP** → **Enable**
5. Clique duas vezes em TCP/IP → aba **IP Addresses** → no grupo **IPAll**: defina `TCP Port = 1433`, apague `TCP Dynamic Ports`
6. Clique **OK**
7. Vá em **SQL Server Services** → clique direito em **SQL Server (SQLEXPRESS01)** → **Restart**

### Depois de ativar

O servidor vai conectar automaticamente. O `.env` já está configurado corretamente:
```
USE_LOCAL_DB=true
LOCAL_DB_SERVER=localhost\SQLEXPRESS01
LOCAL_DB_NAME=gestaointernabi-database
```

Reinicie o `node server.js` após ativar o TCP.
