require('dotenv').config();
const { poolPromise } = require('../src/config/database');
async function checkGestor() {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT Nome FROM BI_Colaboradores WHERE GestorId = 1");
    console.log('Subordinates of Admin:', result.recordset);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkGestor();
