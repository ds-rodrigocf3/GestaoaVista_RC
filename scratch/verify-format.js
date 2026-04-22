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

function formatDateDDMMYYYY(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}
function formatDateYYYYMMDD(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

async function verify() {
    try {
        const pool = await sql.connect(config);
        console.log('✅ Connected');

        const result = await pool.request().query('SELECT TOP 1 * FROM Requests');
        const r = result.recordset[0];
        
        if (r) {
            const formatted = {
                id: r.Id,
                employeeId: r.EmployeeId,
                type: r.Type,
                status: r.Status,
                startDate: formatDateDDMMYYYY(r.StartDate),
                endDate: formatDateDDMMYYYY(r.EndDate),
                startDateISO: formatDateYYYYMMDD(r.StartDate),
                endDateISO: formatDateYYYYMMDD(r.EndDate),
                localTrabalho: r.LocalTrabalho
            };
            console.log('Sample Formatted Request:');
            console.log(JSON.stringify(formatted, null, 2));
        } else {
            console.log('No requests found in DB.');
        }

        await pool.close();
    } catch (err) {
        console.error(err);
    }
}

verify();
