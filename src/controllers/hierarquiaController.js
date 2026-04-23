const { poolPromise, sql } = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request().query('SELECT Id, Descricao FROM NiveisHierarquia ORDER BY Id');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { descricao } = req.body;
    if (!descricao) return res.status(400).json({ error: 'Descrição obrigatória' });
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request()
      .input('Descricao', sql.NVARCHAR(100), descricao)
      .query('INSERT INTO NiveisHierarquia (Descricao) OUTPUT Inserted.Id VALUES (@Descricao)');
    res.json({ id: result.recordset[0].Id, descricao });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { descricao } = req.body;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    await pool.request()
      .input('Id', sql.INT, id)
      .input('Descricao', sql.NVARCHAR(100), descricao)
      .query('UPDATE NiveisHierarquia SET Descricao = @Descricao WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    
    const check = await pool.request()
      .input('Id', sql.INT, id)
      .query('SELECT COUNT(*) as cnt FROM BI_Colaboradores WHERE NivelHierarquia = @Id');
    
    if (check.recordset[0].cnt > 0) {
      return res.status(400).json({ error: 'Nível em uso. Remova associações antes.' });
    }
    
    await pool.request()
      .input('Id', sql.INT, id)
      .query('DELETE FROM NiveisHierarquia WHERE Id = @Id');
    
    res.json({ success: true });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
};
