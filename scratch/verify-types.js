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

function formatDateYYYYMMDD(date) {
  if (!date) return null;
  const d = (typeof date === 'string' && !date.includes('T')) ? new Date(date + 'T12:00:00') : new Date(date);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function verify() {
    try {
        const pool = await sql.connect(config);
        console.log('✅ Connected');

        const result = await pool.request().query('SELECT TOP 1 * FROM Requests ORDER BY Id DESC');
        const r = result.recordset[0];
        
        if (r) {
            const formatted = {
                id: Number(r.Id),
                employeeId: Number(r.EmployeeId),
                type: r.Type,
                status: r.Status,
                startDate: formatDateYYYYMMDD(r.StartDate)
            };
            console.log('Sample Formatted Request (Backend Simulation):');
            console.log(JSON.stringify(formatted, null, 2));
            console.log('Types check:');
            console.log('- id type:', typeof formatted.id);
            console.log('- employeeId type:', typeof formatted.employeeId);
            console.log('- startDate format matches YYYY-MM-DD:', /^\d{4}-\d{2}-\d{2}$/.test(formatted.startDate));
        }

        await pool.close();
    } catch (err) {
        console.error(err);
    }
}

verify();
