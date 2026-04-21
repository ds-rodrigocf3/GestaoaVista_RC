Write-Host "Testando GET /api/demandas..." -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/demandas" `
        -Method GET `
        -ErrorAction Stop

    Write-Host "✅ GET SUCESSO!" -ForegroundColor Green
    Write-Host "Status HTTP: $($response.StatusCode)"
    Write-Host "Resposta:" -ForegroundColor Cyan
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 2 | Write-Host
} 
catch {
    Write-Host "❌ GET ERRO!" -ForegroundColor Red
    Write-Host "Status HTTP: $($_.Exception.Response.StatusCode.value__)"
    Write-Host "Erro: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Testando POST /api/demandas..." -ForegroundColor Cyan

$body = @{
    titulo = "Teste POST Demanda"
    status = "Não Iniciado"
    prioridade = "Média"
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

    Write-Host "✅ POST SUCESSO!" -ForegroundColor Green
    Write-Host "Status HTTP: $($response.StatusCode)"
    Write-Host "Resposta:" -ForegroundColor Cyan
    $response.Content | ConvertFrom-Json | ConvertTo-Json | Write-Host
} 
catch {
    Write-Host "❌ POST ERRO!" -ForegroundColor Red
    Write-Host "Status HTTP: $($_.Exception.Response.StatusCode.value__)"
    Write-Host "Erro: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $response = $reader.ReadToEnd()
        Write-Host "Resposta do servidor (primeiros 200 chars):" -ForegroundColor Yellow
        Write-Host $response.Substring(0, [Math]::Min(200, $response.Length))
    }
}
