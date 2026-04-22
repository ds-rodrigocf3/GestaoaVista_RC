const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || process.env.LOCAL_DB_NAME || process.env.DB_NAME,
    server: (process.env.DB_SERVER || process.env.LOCAL_DB_SERVER || '127.0.0.1').split('\\')[0],
    port: parseInt(process.env.DB_PORT || 1433),
    options: {
        encrypt: true,
        trustServerCertificate: true,
        useUTC: false
    }
};

async function cleanup() {
    try {
        console.log('Connecting to database...');
        const pool = await sql.connect(config);
        console.log('Connected.');

        console.log('Identifying and removing duplicate Scale Work requests...');
        const result = await pool.request().query(`
            WITH CTE AS (
                SELECT Id,
                       ROW_NUMBER() OVER(PARTITION BY EmployeeId, StartDate, Type ORDER BY DataModificacao DESC, Id DESC) as rn
                FROM Requests
                WHERE Type = 'Escala de Trabalho'
            )
            DELETE FROM Requests WHERE Id IN (SELECT Id FROM CTE WHERE rn > 1);
        `);

        console.log(`Cleaned up ${result.rowsAffected[0]} duplicate records.`);
        await pool.close();
        console.log('Done.');
    } catch (err) {
        console.error('Error during cleanup:', err.message);
        process.exit(1);
    }
}

cleanup();
