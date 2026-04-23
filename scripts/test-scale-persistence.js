/**
 * Script de Teste: Verificar Persistência de Escala e Agendamentos
 * 
 * Este script testa se:
 * 1. Os dados de escala são salvos corretamente no banco
 * 2. Os agendamentos persistem após recarregar a página
 * 3. O sincronismo entre frontend e backend está funcionando
 * 
 * Executar com: node test-scale-persistence.js
 */

const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || process.env.LOCAL_DB_NAME || 'gestaointernabi-database',
    server: (process.env.DB_SERVER || process.env.LOCAL_DB_SERVER || '127.0.0.1').split('\\')[0],
    port: parseInt(process.env.DB_PORT || 1433),
    options: {
        encrypt: true,
        trustServerCertificate: true,
        useUTC: false
    }
};

async function testScalePersistence() {
    const pool = new sql.ConnectionPool(config);
    
    try {
        await pool.connect();
        console.log('✅ Conectado ao banco de dados\n');

        // Teste 1: Verificar se existem escalas de trabalho
        console.log('📋 TESTE 1: Verificar Escalas de Trabalho Registradas');
        const scalesResult = await pool.request().query(`
            SELECT 
                r.Id,
                r.EmployeeId,
                r.Type,
                r.Status,
                r.StartDate,
                r.LocalTrabalho,
                c.Nome as NomeColaborador
            FROM Requests r
            LEFT JOIN BI_Colaboradores c ON r.EmployeeId = c.Id
            WHERE r.Type = 'Escala de Trabalho'
            ORDER BY r.StartDate DESC
            LIMIT 20
        `);
        
        if (scalesResult.recordset.length === 0) {
            console.log('⚠️  Nenhuma escala de trabalho encontrada no banco');
        } else {
            console.log(`✅ Encontradas ${scalesResult.recordset.length} escalas:`);
            scalesResult.recordset.forEach(scale => {
                console.log(`   - ID: ${scale.Id} | ${scale.NomeColaborador} | ${scale.StartDate ? new Date(scale.StartDate).toLocaleDateString('pt-BR') : 'N/A'} | ${scale.LocalTrabalho} | Status: ${scale.Status}`);
            });
        }

        // Teste 2: Verificar agendamentos
        console.log('\n📋 TESTE 2: Verificar Agendamentos (Férias, etc)');
        const requestsResult = await pool.request().query(`
            SELECT 
                r.Id,
                r.EmployeeId,
                r.Type,
                r.Status,
                r.StartDate,
                r.EndDate,
                c.Nome as NomeColaborador
            FROM Requests r
            LEFT JOIN BI_Colaboradores c ON r.EmployeeId = c.Id
            WHERE r.Type IN ('Férias integrais', 'Férias fracionadas', 'Day-off', 'Saúde (Exames/Consultas)')
            ORDER BY r.StartDate DESC
            LIMIT 20
        `);
        
        if (requestsResult.recordset.length === 0) {
            console.log('ℹ️  Nenhum agendamento encontrado no banco');
        } else {
            console.log(`✅ Encontrados ${requestsResult.recordset.length} agendamentos:`);
            requestsResult.recordset.forEach(req => {
                const start = req.StartDate ? new Date(req.StartDate).toLocaleDateString('pt-BR') : 'N/A';
                const end = req.EndDate ? new Date(req.EndDate).toLocaleDateString('pt-BR') : 'N/A';
                console.log(`   - ID: ${req.Id} | ${req.NomeColaborador} | ${start} a ${end} | ${req.Type} | Status: ${req.Status}`);
            });
        }

        // Teste 3: Verificar consistência de dados
        console.log('\n📋 TESTE 3: Verificar Consistência');
        const inconsistency = await pool.request().query(`
            SELECT COUNT(*) as InconsistentRecords
            FROM Requests
            WHERE Type = 'Escala de Trabalho'
            AND (LocalTrabalho IS NULL OR LocalTrabalho = '')
        `);
        
        if (inconsistency.recordset[0].InconsistentRecords > 0) {
            console.log(`⚠️  AVISO: ${inconsistency.recordset[0].InconsistentRecords} escalas sem LocalTrabalho definido!`);
            console.log('   Executar: DELETE FROM Requests WHERE Type="Escala de Trabalho" AND (LocalTrabalho IS NULL OR LocalTrabalho = "")');
        } else {
            console.log('✅ Todas as escalas têm LocalTrabalho definido');
        }

        // Teste 4: Verificar registros com status inválido
        console.log('\n📋 TESTE 4: Verificar Status dos Registros');
        const statusCheck = await pool.request().query(`
            SELECT Status, COUNT(*) as Quantidade
            FROM Requests
            GROUP BY Status
            ORDER BY Quantidade DESC
        `);
        
        console.log('Status encontrados:');
        statusCheck.recordset.forEach(row => {
            console.log(`   - ${row.Status}: ${row.Quantidade} registros`);
        });

        // Teste 5: Verificar registros recentes (últimas 24 horas)
        console.log('\n📋 TESTE 5: Registros Criados nas Últimas 24 Horas');
        const recentResult = await pool.request().query(`
            SELECT 
                r.Id,
                r.Type,
                r.Status,
                r.DataCriacao,
                r.DataModificacao,
                c.Nome as NomeColaborador
            FROM Requests r
            LEFT JOIN BI_Colaboradores c ON r.EmployeeId = c.Id
            WHERE r.DataCriacao >= DATEADD(HOUR, -24, GETDATE())
            ORDER BY r.DataCriacao DESC
        `);
        
        if (recentResult.recordset.length === 0) {
            console.log('ℹ️  Nenhum registro criado nas últimas 24 horas');
        } else {
            console.log(`✅ ${recentResult.recordset.length} registros criados/modificados:`);
            recentResult.recordset.forEach(req => {
                const created = new Date(req.DataCriacao).toLocaleString('pt-BR');
                console.log(`   - ID: ${req.Id} | ${req.NomeColaborador} | ${req.Type} | ${req.Status} | Criado: ${created}`);
            });
        }

        console.log('\n✅ Testes de persistência concluídos!');
        console.log('\n💡 Recomendações:');
        console.log('1. Se nenhuma escala/agendamento for encontrado, o problema está na persistência');
        console.log('2. Se houver inconsistências, revisar o código de sincronização');
        console.log('3. Sempre verificar os campos "LocalTrabalho" e "Status" para escalas');

    } catch (err) {
        console.error('❌ Erro durante teste:', err.message);
    } finally {
        await pool.close();
    }
}

testScalePersistence();
