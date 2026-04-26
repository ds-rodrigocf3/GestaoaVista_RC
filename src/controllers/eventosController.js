const { poolPromise, sql } = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        e.Id as id, 
        e.Titulo as titulo, 
        e.Descricao as descricao, 
        e.DataInicio as dataInicio, 
        e.DataFim as dataFim, 
        e.Tipo as tipo, 
        e.AreaId as areaId, 
        e.ResponsavelId as responsavelId,
        e.CriadoPor as criadorId,
        c.Nome as responsavelNome
      FROM BI_Eventos e
      LEFT JOIN BI_Colaboradores c ON e.ResponsavelId = c.Id
      ORDER BY e.DataInicio
    `);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
  try {
    const { titulo, descricao, dataInicio, dataFim, tipo, areaId, responsavelId } = req.body;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('Titulo', sql.NVARCHAR(200), titulo)
      .input('Desc', sql.NVARCHAR(2000), descricao || null)
      .input('Inicio', sql.DATETIME, dataInicio)
      .input('Fim', sql.DATETIME, dataFim || null)
      .input('Tipo', sql.NVARCHAR(100), tipo || 'Reunião')
      .input('AreaIds', sql.NVARCHAR(500), areaId ? String(areaId) : null)
      .input('RespId', sql.INT, responsavelId || null)
      .input('CriadoPor', sql.INT, req.user.colaboradorId)
      .query(`INSERT INTO BI_Eventos (Titulo, Descricao, DataInicio, DataFim, Tipo, AreaId, ResponsavelId, CriadoPor, DataCriacao, DataModificacao)
              OUTPUT Inserted.Id as id VALUES (@Titulo, @Desc, @Inicio, @Fim, @Tipo, @AreaIds, @RespId, @CriadoPor, GETDATE(), GETDATE())`);
    res.json({ id: result.recordset[0].id, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descricao, dataInicio, dataFim, tipo, areaId, responsavelId } = req.body;
    const pool = await poolPromise;
    await pool.request()
      .input('Id', sql.INT, id)
      .input('Titulo', sql.NVARCHAR(200), titulo)
      .input('Desc', sql.NVARCHAR(2000), descricao || null)
      .input('Inicio', sql.DATETIME, dataInicio)
      .input('Fim', sql.DATETIME, dataFim || null)
      .input('Tipo', sql.NVARCHAR(100), tipo)
      .input('AreaIds', sql.NVARCHAR(500), areaId ? String(areaId) : null)
      .input('RespId', sql.INT, responsavelId || null)
      .query(`UPDATE BI_Eventos SET Titulo=@Titulo, Descricao=@Desc, DataInicio=@Inicio, DataFim=@Fim, 
              Tipo=@Tipo, AreaId=@AreaIds, ResponsavelId=@RespId, DataModificacao=GETDATE() WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    await pool.request()
      .input('Id', sql.INT, id)
      .query('DELETE FROM BI_Eventos WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
