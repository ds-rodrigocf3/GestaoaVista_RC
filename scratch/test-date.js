const { poolPromise } = require('./database/setup');

async function run() {
  try {
    const pool = await poolPromise;
    const res = await pool.request().query(`
      SELECT 
        CAST('2026-04-23T16:01' AS DATETIME) as TestCastT,
        CAST('2026-04-23 16:01' AS DATETIME) as TestCastSpace,
        CONVERT(VARCHAR(20), GETDATE(), 126) as NowISO
    `);
    console.log('Result:', res.recordset[0]);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

run();
