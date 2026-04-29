require('dotenv').config();
const { poolPromise } = require('../src/config/database');
async function checkUsage() {
  try {
    const pool = await poolPromise;
    const tasks = await pool.request().query("SELECT COUNT(*) as cnt FROM Tarefas WHERE ResponsavelId = 1");
    const demands = await pool.request().query("SELECT COUNT(*) as cnt FROM Demandas WHERE ResponsavelId = 1");
    console.log('Tasks for Admin:', tasks.recordset[0].cnt);
    console.log('Demands for Admin:', demands.recordset[0].cnt);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkUsage();
