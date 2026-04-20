const sql = require('mssql');

async function testConnection() {
  console.log('Testando conexão com 127.0.0.1 e instância...');

  const config = {
    server: '127.0.0.1\\SQLEXPRESS01',
    database: 'gestaointernabi-database',
    authentication: { type: 'default' },
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      connectionTimeout: 15000,
      requestTimeout: 15000,
      cancelTimeout: 5000,
      abortTransactionOnError: true
    }
  };

  console.log('Configuração:', JSON.stringify(config, null, 2));

  try {
    console.log('Tentando conectar com 127.0.0.1...');
    const pool = await sql.connect(config);
    console.log('✅ Conexão estabelecida com sucesso!');

    // Testar uma consulta simples
    const result = await pool.request().query('SELECT COUNT(*) as total FROM BI_Usuarios');
    console.log('✅ Consulta executada com sucesso!');
    console.log('Total de usuários:', result.recordset[0].total);

    await pool.close();
    console.log('✅ Conexão fechada.');
  } catch (err) {
    console.log('❌ Erro na conexão:');
    console.log('Mensagem:', err.message);
    console.log('Código:', err.code);
  } finally {
    sql.close();
  }
}

testConnection();