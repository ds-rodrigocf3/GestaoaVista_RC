# Script para habilitar TCP/IP no SQL Server SQLEXPRESS01
# Execute como ADMINISTRADOR: clique direito → "Executar com PowerShell" como admin

$instanceKey = "MSSQL17.SQLEXPRESS01"

# Ativar protocolo TCP
$tcpReg = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$instanceKey\MSSQLServer\SuperSocketNetLib\Tcp"
Set-ItemProperty -Path $tcpReg -Name "Enabled" -Value 1 -ErrorAction Stop

# Definir porta fixa 1433 em IPAll
$ipAllReg = "$tcpReg\IPAll"
Set-ItemProperty -Path $ipAllReg -Name "TcpPort"         -Value "1433"
Set-ItemProperty -Path $ipAllReg -Name "TcpDynamicPorts" -Value ""

# Verificar resultado
$enabled = (Get-ItemProperty $tcpReg).Enabled
Write-Host "TCP Enabled: $enabled (esperado: 1)"

# Reiniciar serviço
Write-Host "Reiniciando SQL Server (SQLEXPRESS01)..."
Restart-Service -Name "MSSQL`$SQLEXPRESS01" -Force
Start-Sleep -Seconds 3

# Confirmar porta
$porta = netstat -an | Select-String ":1433"
Write-Host "Porta 1433: $porta"

Write-Host ""
Write-Host "OK! Agora execute: node server.js"
Write-Host "Pressione ENTER para sair..."
Read-Host
