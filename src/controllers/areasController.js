const { poolPromise, sql } = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM BI_Areas ORDER BY Nome');
    res.json(result.recordset.map(row => ({
      id: row.Id, nome: row.Nome, cor: row.Cor, ativo: row.Ativo !== false
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { nome, cor } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });
    const pool = await poolPromise;
    const result = await pool.request()
      .input('Nome', sql.NVARCHAR(100), nome)
      .input('Cor', sql.NVARCHAR(20), cor || '#999999')
      .query('INSERT INTO BI_Areas (Nome, Cor, Ativo) OUTPUT Inserted.Id VALUES (@Nome, @Cor, 1)');
    res.json({ id: result.recordset[0].Id, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, cor, ativo } = req.body;
    const pool = await poolPromise;
    
    let query = 'UPDATE BI_Areas SET ';
    const request = pool.request().input('Id', sql.INT, id);
    const updates = [];

    if (nome !== undefined) { updates.push('Nome = @Nome'); request.input('Nome', sql.NVARCHAR(100), nome); }
    if (cor !== undefined) { updates.push('Cor = @Cor'); request.input('Cor', sql.NVARCHAR(20), cor); }
    if (ativo !== undefined) { updates.push('Ativo = @Ativo'); request.input('Ativo', sql.BIT, ativo ? 1 : 0); }

    if (!updates.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    await request.query(`${query} ${updates.join(', ')} WHERE Id = @Id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    await pool.request()
      .input('Id', sql.INT, id)
      .query('DELETE FROM BI_Areas WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
