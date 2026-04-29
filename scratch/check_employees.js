require('dotenv').config();
const { poolPromise } = require('../src/config/database');
async function checkEmployees() {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT Id, Nome, Email FROM BI_Colaboradores');
    console.log(JSON.stringify(result.recordset, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkEmployees();
