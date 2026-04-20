const sql = require('mssql');

async function testConnection() {
  const config = {
    user: process.env.DB_USER || 'db_user_admin',
    password: process.env.DB_PASSWORD || 'DevAdmin01@@',
    database: process.env.DB_DATABASE || 'gestaointernabi-database',
    server: 'localhost',
    port: 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true
    }
  };

  try {
    const pool = await sql.connect(config);
    console.log('✅ Success with localhost:1433!');
    pool.close();
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

testConnection();
