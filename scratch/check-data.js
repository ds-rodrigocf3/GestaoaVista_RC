const sql = require('mssql');
require('dotenv').config();

const serverAddressRaw = process.env.DB_SERVER || process.env.LOCAL_DB_SERVER || '127.0.0.1';
const serverAddress = serverAddressRaw.split('\\')[0];

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || process.env.LOCAL_DB_NAME || process.env.DB_NAME,
    server: serverAddress,
    port: parseInt(process.env.DB_PORT || 1433),
    options: {
        encrypt: true,
        trustServerCertificate: true,
        useUTC: false
    }
};

async function check() {
    try {
        const pool = await sql.connect(config);
        const res = await pool.request().query('SELECT TOP 1 c1.Id as managerId, c1.Nome as managerName, c2.Id as subordinateId, c2.Nome as subordinateName FROM BI_Colaboradores c1 JOIN BI_Colaboradores c2 ON c1.Id = c2.GestorId WHERE c1.Ativo=1 AND c2.Ativo=1');
        console.log(JSON.stringify(res.recordset[0], null, 2));
        await pool.close();
    } catch (err) {
        console.error(err);
    }
}

check();
