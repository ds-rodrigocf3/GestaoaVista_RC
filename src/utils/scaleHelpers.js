const { sql } = require('../config/database');

async function syncScaleRequest(pool, empId, dateStr, localTrabalho) {
  try {
    const result = await pool.request()
      .input('EmployeeId', sql.INT, empId)
      .input('StartDate', sql.DATE, dateStr)
      .input('Type', sql.NVARCHAR, 'Escala de Trabalho')
      .query(`
        SELECT Id FROM Requests 
        WHERE EmployeeId = @EmployeeId 
        AND StartDate = @StartDate 
        AND Type = @Type
      `);

    if (result.recordset.length > 0) {
      await pool.request()
        .input('Id', sql.INT, result.recordset[0].Id)
        .input('LocalTrabalho', sql.NVARCHAR, localTrabalho)
        .query(`UPDATE Requests SET LocalTrabalho = @LocalTrabalho WHERE Id = @Id`);
    } else {
      await pool.request()
        .input('EmployeeId', sql.INT, empId)
        .input('StartDate', sql.DATE, dateStr)
        .input('EndDate', sql.DATE, dateStr)
        .input('Type', sql.NVARCHAR, 'Escala de Trabalho')
        .input('Status', sql.NVARCHAR, 'Aprovado')
        .input('LocalTrabalho', sql.NVARCHAR, localTrabalho)
        .query(`
          INSERT INTO Requests (EmployeeId, Type, Status, StartDate, EndDate, LocalTrabalho)
          VALUES (@EmployeeId, @Type, @Status, @StartDate, @EndDate, @LocalTrabalho)
        `);
    }
  } catch (err) {
    console.error('Erro ao sincronizar escala:', err);
  }
}

module.exports = { syncScaleRequest };
