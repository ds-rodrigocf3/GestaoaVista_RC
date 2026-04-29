const { poolPromise, sql } = require('../config/database');
const bcrypt = require('bcryptjs');
const { formatDateYYYYMMDD, toServerDate } = require('../utils/dateFormatters');

exports.getAll = async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request().query(`
      SELECT c.*, a.Nome as AreaNome, nh.Descricao as NivelDescricao, car.Nome as CargoNome, g.Nome as GestorNome
      FROM BI_Colaboradores c
      LEFT JOIN BI_Areas a ON c.AreaId = a.Id
      LEFT JOIN NiveisHierarquia nh ON c.NivelHierarquia = nh.Id
      LEFT JOIN BI_Cargos car ON c.CargoId = car.Id
      LEFT JOIN BI_Colaboradores g ON c.GestorId = g.Id
      WHERE c.Ativo = 1 AND c.Nome <> 'Administrador Local'
      ORDER BY c.Nome
    `);
    
    // Format to match frontend expectations if necessary
    const formatted = result.recordset.map(c => ({
      id: c.Id,
      name: c.Nome,
      email: c.Email,
      cargo: c.Cargo,
      cargoId: c.CargoId,
      cargoNome: c.CargoNome,
      gestor: c.Gestor,
      gestorId: c.GestorId,
      gestorNome: c.GestorNome,
      tp_contrato: c.Tp_contrato,
      color: c.Color,
      avatarUrl: c.AvatarUrl,
      nivelHierarquia: c.NivelHierarquia,
      nivelDescricao: c.NivelDescricao,
      areaId: c.AreaId,
      areaNome: c.AreaNome,
      dataNascimento: formatDateYYYYMMDD(c.DataNascimento),
      ativo: c.Ativo
    }));
    
    res.json(formatted);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('Id', sql.INT, id)
      .query('SELECT * FROM BI_Colaboradores WHERE Id = @Id');
    if (!result.recordset.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(result.recordset[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  try {
    const { nome, email, cargoId, areaId, nivelHierarquia, gestorId, tp_contrato, color, avatarUrl, dataNascimento } = req.body;
    
    await transaction.begin();
    
    const request = new sql.Request(transaction);
    const result = await request
      .input('Nome', sql.NVARCHAR(100), nome)
      .input('Email', sql.NVARCHAR(200), email)
      .input('CargoId', sql.INT, cargoId || null)
      .input('AreaId', sql.INT, areaId || null)
      .input('Nivel', sql.INT, nivelHierarquia || 6)
      .input('GestorId', sql.INT, gestorId || null)
      .input('Contrato', sql.NVARCHAR(20), tp_contrato || 'CLT')
      .input('Color', sql.NVARCHAR(20), color || '#33CCCC')
      .input('Avatar', sql.NVARCHAR(500), avatarUrl || null)
      .input('DataNascimento', sql.DATE, toServerDate(dataNascimento))
      .query(`INSERT INTO BI_Colaboradores (Nome, Email, CargoId, AreaId, NivelHierarquia, GestorId, Tp_contrato, Color, AvatarUrl, DataNascimento, Ativo)
              OUTPUT Inserted.Id VALUES (@Nome, @Email, @CargoId, @AreaId, @Nivel, @GestorId, @Contrato, @Color, @Avatar, @DataNascimento, 1)`);
    
    const newColabId = result.recordset[0].Id;
    
    // Create corresponding user with default password '123456'
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash('123456', salt);
    
    const userRequest = new sql.Request(transaction);
    await userRequest
      .input('ColabId', sql.INT, newColabId)
      .input('Email', sql.NVARCHAR(200), email.toLowerCase().trim())
      .input('Hash', sql.NVARCHAR(500), hash)
      .query(`INSERT INTO BI_Usuarios (ColaboradorId, Email, SenhaHash, IsAdmin, Ativo) 
              VALUES (@ColabId, @Email, @Hash, 0, 1)`);

    await transaction.commit();
    res.json({ id: newColabId, success: true });
  } catch (err) { 
    if (transaction) await transaction.rollback();
    res.status(500).json({ error: err.message }); 
  }
};

exports.update = async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  try {
    const { id } = req.params;
    const { nome, email, cargoId, areaId, nivelHierarquia, gestorId, tp_contrato, color, avatarUrl, dataNascimento, ativo } = req.body;
    
    await transaction.begin();
    
    const request = new sql.Request(transaction);
    await request
      .input('Id', sql.INT, id)
      .input('Nome', sql.NVARCHAR(100), nome)
      .input('Email', sql.NVARCHAR(200), email)
      .input('CargoId', sql.INT, cargoId || null)
      .input('AreaId', sql.INT, areaId || null)
      .input('Nivel', sql.INT, nivelHierarquia)
      .input('GestorId', sql.INT, gestorId || null)
      .input('Contrato', sql.NVARCHAR(20), tp_contrato)
      .input('Color', sql.NVARCHAR(20), color)
      .input('Avatar', sql.NVARCHAR(500), avatarUrl)
      .input('DataNascimento', sql.DATE, toServerDate(dataNascimento))
      .input('Ativo', sql.BIT, ativo !== false ? 1 : 0)
      .query(`UPDATE BI_Colaboradores SET Nome=@Nome, Email=@Email, CargoId=@CargoId, AreaId=@AreaId, 
              NivelHierarquia=@Nivel, GestorId=@GestorId, Tp_contrato=@Contrato, Color=@Color, 
              AvatarUrl=@Avatar, DataNascimento=@DataNascimento, Ativo=@Ativo WHERE Id=@Id`);
    
    // Sync email in BI_Usuarios
    const userRequest = new sql.Request(transaction);
    await userRequest
      .input('Id', sql.INT, id)
      .input('Email', sql.NVARCHAR(200), email.toLowerCase().trim())
      .input('Ativo', sql.BIT, ativo !== false ? 1 : 0)
      .query('UPDATE BI_Usuarios SET Email=@Email, Ativo=@Ativo WHERE ColaboradorId=@Id');

    await transaction.commit();
    res.json({ success: true });
  } catch (err) { 
    if (transaction) await transaction.rollback();
    res.status(500).json({ error: err.message }); 
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    await pool.request()
      .input('Id', sql.INT, id)
      .query('UPDATE BI_Colaboradores SET Ativo = 0 WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
