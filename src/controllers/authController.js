const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { poolPromise, sql } = require('../config/database');
const { JWT_SECRET, JWT_EXPIRES } = require('../config/constants');

exports.login = async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ error: 'Email e senha são obrigatórios' });

    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });

    const result = await pool.request()
      .input('Email', sql.NVARCHAR(200), email.toLowerCase().trim())
      .query(`
        SELECT u.Id, u.Email, u.SenhaHash, u.IsAdmin, u.Ativo, u.ColaboradorId,
               c.Nome, c.Cargo, c.CargoId, c.NivelHierarquia, c.Color, c.AvatarUrl, c.AreaId,
               c.Gestor, c.Tp_contrato, c.ExibirIdade,
               nh.Descricao as NivelDescricao,
               car.Nome as CargoNome
        FROM BI_Usuarios u
        LEFT JOIN BI_Colaboradores c ON u.ColaboradorId = c.Id
        LEFT JOIN NiveisHierarquia nh ON c.NivelHierarquia = nh.Id
        LEFT JOIN BI_Cargos car ON c.CargoId = car.Id
        WHERE LOWER(u.Email) = LOWER(@Email)
      `);

    if (!result.recordset.length) return res.status(401).json({ error: 'Credenciais inválidas' });
    const user = result.recordset[0];
    if (!user.Ativo) return res.status(403).json({ error: 'Usuário inativo' });

    const valid = await bcrypt.compare(senha, user.SenhaHash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

    await pool.request()
      .input('Id', sql.INT, user.Id)
      .query('UPDATE BI_Usuarios SET UltimoLogin = GETDATE() WHERE Id = @Id');

    const token = jwt.sign({
      userId: user.Id,
      email: user.Email,
      isAdmin: !!user.IsAdmin,
      colaboradorId: user.ColaboradorId,
      nivelHierarquia: user.NivelHierarquia,
      nome: user.Nome,
      areaId: user.AreaId
    }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.json({
      token,
      user: {
        id: user.Id,
        email: user.Email,
        isAdmin: !!user.IsAdmin,
        colaboradorId: user.ColaboradorId,
        areaId: user.AreaId,
        nome: user.Nome,
        cargo: user.Cargo,
        cargoNome: user.CargoNome,
        nivelHierarquia: user.NivelHierarquia,
        nivelDescricao: user.NivelDescricao,
        color: user.Color,
        avatarUrl: user.AvatarUrl,
        exibirIdade: user.ExibirIdade === true
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { senhaAtual, novaSenha, targetUserId } = req.body;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });

    const userId = req.user.isAdmin && targetUserId ? targetUserId : req.user.userId;

    if (!req.user.isAdmin) {
      const current = await pool.request()
        .input('Id', sql.INT, userId)
        .query('SELECT SenhaHash FROM BI_Usuarios WHERE Id = @Id');
      if (!current.recordset.length) return res.status(404).json({ error: 'Usuário não encontrado' });
      const valid = await bcrypt.compare(senhaAtual, current.recordset[0].SenhaHash);
      if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    if (!novaSenha || novaSenha.length < 6) return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
    const hash = await bcrypt.hash(novaSenha, 12);

    await pool.request()
      .input('Id', sql.INT, userId)
      .input('Hash', sql.NVARCHAR(500), hash)
      .query('UPDATE BI_Usuarios SET SenhaHash = @Hash WHERE Id = @Id');

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    let avatarUrl = req.body ? req.body.avatarUrl : null;
    
    if (req.file) {
      avatarUrl = 'data:' + req.file.mimetype + ';base64,' + req.file.buffer.toString('base64');
    }
    
    const exibirIdade = req.body && req.body.exibirIdade !== undefined ? (req.body.exibirIdade === 'true' || req.body.exibirIdade === true) : null;


    const { colaboradorId } = req.user;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });

    const updates = [];
    const request = pool.request().input('ColabId', sql.INT, colaboradorId);
    
    if (avatarUrl) {
      request.input('AvatarUrl', sql.VarChar(sql.MAX), avatarUrl);
      updates.push('AvatarUrl = @AvatarUrl');
    }
    
    if (exibirIdade !== null) {
      request.input('ExibirIdade', sql.BIT, exibirIdade ? 1 : 0);
      updates.push('ExibirIdade = @ExibirIdade');
    }
    if (updates.length > 0) {
      const query = `UPDATE BI_Colaboradores SET ${updates.join(', ')} WHERE Id = @ColabId`;
      await request.query(query);
    }
    
    res.json({ success: true, avatarUrl, exibirIdade });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateDelegation = async (req, res) => {
  try {
    const { colaboradorId } = req.user;
    const { delegadoId, delegacaoInicio, delegacaoFim, delegacaoAtiva } = req.body;

    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });

    const query = `
      UPDATE BI_Colaboradores 
      SET DelegadoId = @DelegadoId,
          DelegacaoInicio = @DelegacaoInicio,
          DelegacaoFim = @DelegacaoFim,
          DelegacaoAtiva = @DelegacaoAtiva
      WHERE Id = @ColabId
    `;
    
    await pool.request()
      .input('DelegadoId', sql.INT, delegadoId || null)
      .input('DelegacaoInicio', sql.DATE, delegacaoInicio || null)
      .input('DelegacaoFim', sql.DATE, delegacaoFim || null)
      .input('DelegacaoAtiva', sql.BIT, delegacaoAtiva ? 1 : 0)
      .input('ColabId', sql.INT, colaboradorId)
      .query(query);

    res.json({ success: true, message: 'Delegação atualizada com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
