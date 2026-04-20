$body = @{
    titulo = "Teste da Correção - Demanda"
    descricao = "Teste após correção do erro 404"
    status = "Não Iniciado"
    prioridade = "Alta"
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/demandas" `
        -Method POST `
        -Body $body `
        -Headers $headers `
        -ErrorAction Stop

    Write-Host "✅ SUCESSO!" -ForegroundColor Green
    Write-Host "Status HTTP: $($response.StatusCode)"
    Write-Host "Resposta:" -ForegroundColor Cyan
    $response.Content | ConvertFrom-Json | ConvertTo-Json | Write-Host
} 
catch {
    Write-Host "❌ ERRO!" -ForegroundColor Red
    Write-Host "Status HTTP: $($_.Exception.Response.StatusCode.value__)"
    Write-Host "Erro: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $response = $reader.ReadToEnd()
        Write-Host "Resposta do servidor:" -ForegroundColor Yellow
        Write-Host $response
    }
}
