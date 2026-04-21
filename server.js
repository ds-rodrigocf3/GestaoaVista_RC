const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// 1. LOGGER GLOBAL (Captura tudo primeiro)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const path = require('path');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'gestaobi-secret-2026-change-in-prod';
const JWT_EXPIRES = '8h';

// LÓGICA DE CONEXÃO HÍBRIDA (AZURE vs LOCAL)
const isAzure = process.env.WEBSITE_SITE_NAME || process.env.AZURE_FUNCTIONS_ENVIRONMENT;
const serverAddressRaw = process.env.DB_SERVER || process.env.LOCAL_DB_SERVER || '127.0.0.1';
const serverAddress = serverAddressRaw.split('\\')[0]; // Remove \SQLEXPRESS01 se houver

const databaseName = process.env.DB_DATABASE || process.env.LOCAL_DB_NAME || process.env.DB_NAME;

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: databaseName,
    server: serverAddress,
    port: parseInt(process.env.DB_PORT || 1433),
    options: {
        encrypt: true,
        trustServerCertificate: true, // Importante para local
        useUTC: false // Força o driver a usar horários locais sem conversões automáticas para UTC
    }
};

// Nova forma de conectar (mais estável para o ambiente Linux)
const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log(`✅ Conectado ao SQL Server (${isAzure ? 'Azure' : 'Local'}) com sucesso!`);
        return pool;
    })
    .catch(err => {
        console.error('❌ Erro de conexão:', err);
        process.exit(1);
    });

// ============================================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ============================================================
function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    const payload = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

function adminMiddleware(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Acesso restrito ao administrador' });
  next();
}

// ============================================================
// AUTH ENDPOINTS
// ============================================================

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ error: 'Email e senha são obrigatórios' });

    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });

    const result = await pool.request()
      .input('Email', sql.NVARCHAR(200), email.toLowerCase().trim())
      .query(`
        SELECT u.Id, u.Email, u.SenhaHash, u.IsAdmin, u.Ativo, u.ColaboradorId,
               c.Nome, c.Cargo, c.NivelHierarquia, c.Color, c.AvatarUrl, c.AreaId,
               c.Gestor, c.Tp_contrato,
               nh.Descricao as NivelDescricao
        FROM BI_Usuarios u
        LEFT JOIN BI_Colaboradores c ON u.ColaboradorId = c.Id
        LEFT JOIN NiveisHierarquia nh ON c.NivelHierarquia = nh.Id
        WHERE LOWER(u.Email) = LOWER(@Email)
      `);

    if (!result.recordset.length) return res.status(401).json({ error: 'Credenciais inválidas' });
    const user = result.recordset[0];
    if (!user.Ativo) return res.status(403).json({ error: 'Usuário inativo' });

    const valid = await bcrypt.compare(senha, user.SenhaHash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

    // Update last login
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
        nivelHierarquia: user.NivelHierarquia,
        nivelDescricao: user.NivelDescricao,
        color: user.Color,
        avatarUrl: user.AvatarUrl
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  try {
    const { senhaAtual, novaSenha, targetUserId } = req.body;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });

    // Admin pode trocar senha de qualquer um; usuário comum só pode trocar a própria
    const userId = req.user.isAdmin && targetUserId ? targetUserId : req.user.userId;

    if (!req.user.isAdmin) {
      // Validate current password
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
});

// POST /api/auth/profile
app.put('/api/auth/profile', authMiddleware, (req, res, next) => {
  upload.single('avatarFile')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'Erro de arquivo bruto: ' + err.message });
    } else if (err) {
      return res.status(500).json({ error: 'Falha durante o upload: ' + err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    let avatarUrl = req.body ? req.body.avatarUrl : null;
    
    if (req.file) {
      avatarUrl = 'data:' + req.file.mimetype + ';base64,' + req.file.buffer.toString('base64');
    } else if (!avatarUrl) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada e URL vazia.' });
    }

    const { colaboradorId } = req.user;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });

    await pool.request()
      .input('ColabId', sql.INT, colaboradorId)
      .input('AvatarUrl', sql.VarChar(sql.MAX), avatarUrl || null)
      .query('UPDATE BI_Colaboradores SET AvatarUrl = @AvatarUrl WHERE Id = @ColabId');

    res.json({ success: true, avatarUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// HIERARQUIA ENDPOINTS
// ============================================================

app.get('/api/hierarquia', async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request().query('SELECT Id, Descricao FROM NiveisHierarquia ORDER BY Id');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/hierarquia', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { descricao } = req.body;
    if (!descricao) return res.status(400).json({ error: 'Descrição obrigatória' });
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request()
      .input('Descricao', sql.NVARCHAR(100), descricao)
      .query('INSERT INTO NiveisHierarquia (Descricao) OUTPUT Inserted.Id VALUES (@Descricao)');
    res.json({ id: result.recordset[0].Id, descricao });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/hierarquia/:id', authMiddleware, adminMiddleware, async (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/hierarquia/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    // Check if any collaborator uses this level
    const check = await pool.request().input('Id', sql.INT, id)
      .query('SELECT COUNT(*) as cnt FROM BI_Colaboradores WHERE NivelHierarquia = @Id');
    if (check.recordset[0].cnt > 0) return res.status(400).json({ error: 'Nível em uso por colaboradores. Remova a associação antes de excluir.' });
    await pool.request().input('Id', sql.INT, id).query('DELETE FROM NiveisHierarquia WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// EMPLOYEES ENDPOINTS
// ============================================================

app.get('/api/employees', async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request().query(`
      SELECT c.Id as id, c.Nome as name, c.Cargo as teamStr, cg.Nome as cargoNome,
             c.Gestor as managerStr, c.GestorId as gestorId, a.Nome as areaNome,
             c.Tp_contrato as tipoContrato, c.Color as color, c.AvatarUrl as avatarUrl,
             c.NivelHierarquia as nivelHierarquia, c.Email as email,
             c.AreaId, c.CargoId, c.Ativo,
             nh.Descricao as nivelDescricao
      FROM BI_Colaboradores c
      LEFT JOIN NiveisHierarquia nh ON c.NivelHierarquia = nh.Id
      LEFT JOIN BI_Cargos cg ON c.CargoId = cg.Id
      LEFT JOIN BI_Areas a ON c.AreaId = a.Id
      ORDER BY c.NivelHierarquia, c.Nome
    `);
    
    const formatted = result.recordset.map(row => ({
        ...row,
        team: row.cargoNome || row.teamStr,
        manager: row.areaNome || row.managerStr, // fallback to manager str for backwards compatibility
        ativo: row.Ativo !== false // Ensure it defaults to true if null
    }));
    
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/cargos', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request().query('SELECT Id, Nome FROM BI_Cargos ORDER BY Nome');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// USUARIOS ENDPOINTS (Admin only)
// ============================================================

app.get('/api/usuarios', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request().query(`
      SELECT u.Id, u.Email, u.IsAdmin, u.Ativo, u.DataCriacao, u.UltimoLogin,
             c.Nome as colaboradorNome, c.NivelHierarquia
      FROM BI_Usuarios u
      LEFT JOIN BI_Colaboradores c ON u.ColaboradorId = c.Id
      ORDER BY u.IsAdmin DESC, u.Email
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/usuarios/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { isAdmin, ativo, novaSenha } = req.body;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });

    let query = 'UPDATE BI_Usuarios SET ';
    const request = pool.request().input('Id', sql.INT, id);
    const updates = [];

    if (isAdmin !== undefined) { updates.push('IsAdmin = @IsAdmin'); request.input('IsAdmin', sql.BIT, isAdmin ? 1 : 0); }
    if (ativo !== undefined) { 
        updates.push('Ativo = @Ativo, DataInativacao = @DataInativacao'); 
        request.input('Ativo', sql.BIT, ativo ? 1 : 0); 
        if (ativo) request.input('DataInativacao', sql.DATETIME, null);
        else request.input('DataInativacao', sql.DATETIME, new Date());
    }
    if (novaSenha) {
      const hash = await bcrypt.hash(novaSenha, 12);
      updates.push('SenhaHash = @Hash');
      request.input('Hash', sql.NVARCHAR(500), hash);
    }

    if (!updates.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    await request.query(`${query} ${updates.join(', ')} WHERE Id = @Id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/colaboradores', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request().query(`
      SELECT c.Id as id, c.Nome as name, c.Email as email, c.NivelHierarquia as nivelHierarquia,
             c.AreaId as areaId, c.CargoId as cargoId, c.GestorId as gestorId, c.Ativo as ativo,
             a.Nome as areaNome, cr.Nome as cargoNome
      FROM BI_Colaboradores c
      LEFT JOIN BI_Areas a ON c.AreaId = a.Id
      LEFT JOIN BI_Cargos cr ON c.CargoId = cr.Id
      ORDER BY c.Nome
    `);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/colaboradores', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { nome, email, nivelHierarquia, cargoId, areaId, isAdmin, gestorId } = req.body;
    if (!nome || !email || !nivelHierarquia) return res.status(400).json({ error: 'Nome, e-mail e nível são obrigatórios' });

    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });

    // Ensure email is unique
    const checkEmail = await pool.request().input('Email', sql.NVARCHAR(200), email.toLowerCase().trim()).query('SELECT Id FROM BI_Usuarios WHERE LOWER(Email) = @Email');
    if (checkEmail.recordset.length > 0) return res.status(400).json({ error: 'E-mail já está em uso' });

    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    
    // Insert Colaborador
    const colabReq = pool.request()
      .input('Nome', sql.NVARCHAR(100), nome)
      .input('Email', sql.NVARCHAR(200), email.trim())
      .input('NivelHierarquia', sql.INT, typeof nivelHierarquia === 'string' ? parseInt(nivelHierarquia, 10) : nivelHierarquia)
      .input('CargoId', sql.INT, cargoId ? (typeof cargoId === 'string' ? parseInt(cargoId, 10) : cargoId) : null)
      .input('AreaId', sql.INT, areaId ? (typeof areaId === 'string' ? parseInt(areaId, 10) : areaId) : null)
      .input('GestorId', sql.INT, gestorId ? parseInt(gestorId, 10) : null)
      .input('Color', sql.NVARCHAR(20), randomColor)
      .input('AvatarUrl', sql.NVARCHAR(500), 'https://i.pravatar.cc/150?u=' + Math.floor(Math.random()*1000));
      
    const colabRes = await colabReq.query(`
      INSERT INTO BI_Colaboradores (Nome, Email, NivelHierarquia, CargoId, AreaId, GestorId, Color, AvatarUrl)
      OUTPUT Inserted.Id
      VALUES (@Nome, @Email, @NivelHierarquia, @CargoId, @AreaId, @GestorId, @Color, @AvatarUrl)
    `);
    const novoColaboradorId = colabRes.recordset[0].Id;

    // Insert Login
    const defaultPassHash = await bcrypt.hash('Mudar@123', 12);
    await pool.request()
      .input('ColaboradorId', sql.INT, novoColaboradorId)
      .input('Email', sql.NVARCHAR(200), email.toLowerCase().trim())
      .input('Senha', sql.NVARCHAR(500), defaultPassHash)
      .input('IsAdmin', sql.BIT, !!isAdmin)
      .query(`
        INSERT INTO BI_Usuarios (ColaboradorId, Email, SenhaHash, IsAdmin, Ativo)
        VALUES (@ColaboradorId, @Email, @Senha, @IsAdmin, 1)
      `);

    res.json({ id: novoColaboradorId, success: true });
  } catch (err) {
    console.error('[POST /api/colaboradores ERROR]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/colaboradores/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, nivelHierarquia, areaId, cargoId, ativo, gestorId } = req.body;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });

    let query = 'UPDATE BI_Colaboradores SET ';
    const request = pool.request().input('Id', sql.INT, id);
    const updates = [];

    if (nome !== undefined) { updates.push('Nome = @Nome'); request.input('Nome', sql.NVARCHAR(100), nome); }
    if (email !== undefined) { updates.push('Email = @Email'); request.input('Email', sql.NVARCHAR(200), email); }
    if (nivelHierarquia !== undefined) { updates.push('NivelHierarquia = @NivelHierarquia'); request.input('NivelHierarquia', sql.INT, typeof nivelHierarquia === 'string' ? parseInt(nivelHierarquia, 10) : nivelHierarquia); }
    if (areaId !== undefined) { updates.push('AreaId = @AreaId'); request.input('AreaId', sql.INT, (areaId && areaId !== '') ? parseInt(areaId, 10) : null); }
    if (cargoId !== undefined) { updates.push('CargoId = @CargoId'); request.input('CargoId', sql.INT, (cargoId && cargoId !== '') ? parseInt(cargoId, 10) : null); }
    if (gestorId !== undefined) { updates.push('GestorId = @GestorId'); request.input('GestorId', sql.INT, (gestorId && gestorId !== '') ? parseInt(gestorId, 10) : null); }
    
    if (ativo !== undefined) { 
        updates.push('Ativo = @Ativo, DataInativacao = @DataInativacao'); 
        request.input('Ativo', sql.BIT, ativo ? 1 : 0); 
        request.input('DataInativacao', sql.DATETIME, ativo ? null : new Date());
        
        // Também atualizar o status do usuário na tabela de login se houver
        const userReq = pool.request();
        userReq.input('ColabId', sql.INT, id);
        userReq.input('Ativo', sql.BIT, ativo ? 1 : 0);
        userReq.input('DataInat', sql.DATETIME, ativo ? null : new Date());
        await userReq.query('UPDATE BI_Usuarios SET Ativo = @Ativo, DataInativacao = @DataInat WHERE ColaboradorId = @ColabId');
    }

    if (!updates.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    await request.query(`${query} ${updates.join(', ')} WHERE Id = @Id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ============================================================
// ÁREAS ENDPOINTS
// ============================================================
app.get('/api/areas', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM BI_Areas ORDER BY Nome');
    res.json(result.recordset.map(row => ({
      id: row.Id, nome: row.Nome, cor: row.Cor, ativo: row.Ativo !== false
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/areas', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    const { nome, cor } = req.body;
    const result = await pool.request()
      .input('Nome', sql.NVARCHAR(100), nome)
      .input('Cor', sql.NVARCHAR(20), cor || '#33CCCC')
      .query('INSERT INTO BI_Areas (Nome, Cor) OUTPUT Inserted.Id VALUES (@Nome, @Cor)');
    res.json({ id: result.recordset[0].Id, nome, ativo: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/areas/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, ativo } = req.body;
    const pool = await poolPromise;
    const request = pool.request().input('Id', sql.INT, id);
    const updates = [];
    if (nome !== undefined) { updates.push('Nome = @Nome'); request.input('Nome', sql.NVARCHAR(100), nome); }
    if (ativo !== undefined) { 
        updates.push('Ativo = @Ativo, DataInativacao = @DataInativacao'); 
        request.input('Ativo', sql.BIT, ativo ? 1 : 0);
        request.input('DataInativacao', sql.DATETIME, ativo ? null : new Date());
    }
    if (!updates.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    await request.query(`UPDATE BI_Areas SET ${updates.join(', ')} WHERE Id = @Id`);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});



// ============================================================
// CARGOS ENDPOINTS
// ============================================================
app.get('/api/cargos', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request().query('SELECT Id, Nome FROM BI_Cargos ORDER BY Nome');
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/cargos', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request().input('Nome', sql.NVARCHAR(100), req.body.nome)
      .query('INSERT INTO BI_Cargos (Nome) OUTPUT Inserted.Id VALUES (@Nome)');
    res.json({ id: result.recordset[0].Id, nome: req.body.nome });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/cargos/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome } = req.body;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    await pool.request()
      .input('Id', sql.INT, id)
      .input('Nome', sql.NVARCHAR(100), nome)
      .query('UPDATE BI_Cargos SET Nome = @Nome WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/cargos/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    // Disassociate collaborators before deleting
    await pool.request().input('Id', sql.INT, id)
      .query('UPDATE BI_Colaboradores SET CargoId = NULL WHERE CargoId = @Id');
    await pool.request().input('Id', sql.INT, id)
      .query('DELETE FROM BI_Cargos WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// DEMANDAS ENDPOINTS
// ============================================================
app.get('/api/demandas', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request().query(`
      SELECT d.Id, d.Titulo, d.Descricao, d.ResponsavelId, d.Status, d.Prioridade, 
             d.InicioPlanjado, d.FimPlanejado, d.InicioRealizado, d.FimRealizado,
             d.ComentarioStatus, d.DataCriacao, d.DataModificacao, c.Nome as ResponsavelNome,
             (SELECT COUNT(*) FROM Tarefas WHERE DemandaId = d.Id AND Ativo = 1) as TotalTarefas,
             (SELECT COUNT(*) FROM Tarefas WHERE DemandaId = d.Id AND Status = 'Feito' AND Ativo = 1) as TarefasConcluidas
      FROM Demandas d
      LEFT JOIN BI_Colaboradores c ON d.ResponsavelId = c.Id
      ORDER BY d.DataModificacao DESC
    `);
    res.json(result.recordset.map(d => ({
      ...d,
      inicioPlanjado: d.InicioPlanjado ? new Date(d.InicioPlanjado).toISOString().slice(0, 10) : null,
      fimPlanejado: d.FimPlanejado ? new Date(d.FimPlanejado).toISOString().slice(0, 10) : null
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/demandas', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { titulo, descricao, responsavelId, status, prioridade, inicioPlanjado, fimPlanejado } = req.body;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request()
      .input('Titulo', sql.NVARCHAR(300), titulo)
      .input('Descricao', sql.NVARCHAR(2000), descricao || null)
      .input('ResponsavelId', sql.INT, (responsavelId && responsavelId !== '') ? parseInt(responsavelId, 10) : null)
      .input('Status', sql.NVARCHAR(50), status || 'Pendente')
      .input('Prioridade', sql.NVARCHAR(50), prioridade || 'Média')
      .input('InicioPlanjado', sql.DATE, inicioPlanjado || null)
      .input('FimPlanejado', sql.DATE, fimPlanejado || null)
      .query(`INSERT INTO Demandas (Titulo, Descricao, ResponsavelId, Status, Prioridade, InicioPlanjado, FimPlanejado, DataCriacao, DataModificacao)
              OUTPUT Inserted.Id VALUES (@Titulo, @Descricao, @ResponsavelId, @Status, @Prioridade, @InicioPlanjado, @FimPlanejado, GETDATE(), GETDATE())`);
    res.json({ id: result.recordset[0].Id, ...req.body });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/demandas/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descricao, responsavelId, status, prioridade, inicioPlanjado, fimPlanejado, comentarioStatus, statusAnterior, registrarHistorico } = req.body;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });

    await pool.request()
      .input('Id', sql.INT, id)
      .input('Titulo', sql.NVARCHAR(300), titulo)
      .input('Descricao', sql.NVARCHAR(2000), descricao || null)
      .input('ResponsavelId', sql.INT, (responsavelId && responsavelId !== '') ? parseInt(responsavelId, 10) : null)
      .input('Status', sql.NVARCHAR(50), status)
      .input('Prioridade', sql.NVARCHAR(50), prioridade)
      .input('InicioPlanjado', sql.DATE, inicioPlanjado || null)
      .input('FimPlanejado', sql.DATE, fimPlanejado || null)
      .input('ComentarioStatus', sql.NVARCHAR(1000), comentarioStatus || null)
      .query(`UPDATE Demandas SET Titulo=@Titulo, Descricao=@Descricao, ResponsavelId=@ResponsavelId, 
              Status=@Status, Prioridade=@Prioridade, InicioPlanjado=@InicioPlanjado, FimPlanejado=@FimPlanejado, 
              ComentarioStatus=@ComentarioStatus, DataModificacao=GETDATE() WHERE Id=@Id`);

    if (registrarHistorico && status !== statusAnterior) {
      await pool.request().input('Id', sql.INT, id).query("UPDATE StatusHistorico SET DataFim = GETDATE() WHERE TipoEntidade='Demanda' AND EntidadeId=@Id AND DataFim IS NULL");
      await pool.request()
        .input('Id', sql.INT, id).input('Prev', sql.NVARCHAR(50), statusAnterior).input('Next', sql.NVARCHAR(50), status)
        .input('User', sql.INT, req.user.userId).input('Msg', sql.NVARCHAR(1000), comentarioStatus || null)
        .query("INSERT INTO StatusHistorico (TipoEntidade, EntidadeId, StatusAnterior, StatusNovo, Comentario, UsuarioId) VALUES ('Demanda', @Id, @Prev, @Next, @Msg, @User)");
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/demandas/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    // Unlink tasks
    await pool.request().input('Id', sql.INT, id).query('UPDATE Tarefas SET DemandaId = NULL WHERE DemandaId = @Id');
    await pool.request().input('Id', sql.INT, id).query("DELETE FROM StatusHistorico WHERE TipoEntidade='Demanda' AND EntidadeId=@Id");
    await pool.request().input('Id', sql.INT, id).query('DELETE FROM Demandas WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// TAREFAS (TASKS) ENDPOINTS
// ============================================================
app.get('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request().query(`
      SELECT t.Id, t.Titulo as Title, t.ResponsavelId as OwnerId, t.Status, t.Prioridade as Priority,
             t.Inicio as StartDate, t.Final as EndDate, t.DemandaId, t.ComentarioStatus, d.Titulo as DemandaTitulo,
             t.InicioRealizado, t.FimRealizado
      FROM Tarefas t LEFT JOIN Demandas d ON t.DemandaId = d.Id WHERE t.Ativo = 1
    `);
    res.json(result.recordset.map(t => ({
      ...t,
      startDate: t.StartDate ? new Date(t.StartDate).toISOString().slice(0, 10) : '',
      endDate: t.EndDate ? new Date(t.EndDate).toISOString().slice(0, 10) : '',
      inicioRealizado: t.InicioRealizado ? new Date(t.InicioRealizado).toISOString().slice(0, 10) : null,
      fimRealizado: t.FimRealizado ? new Date(t.FimRealizado).toISOString().slice(0, 10) : null
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const { title, ownerId, status, priority, startDate, endDate, demandaId, comentarioStatus } = req.body;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request()
      .input('Title', sql.NVARCHAR(200), title || '').input('OwnerId', sql.INT, ownerId || null)
      .input('Status', sql.NVARCHAR(50), status || 'Não Iniciado').input('Priority', sql.NVARCHAR(50), priority || 'Baixa')
      .input('StartDate', sql.DATE, startDate || null).input('EndDate', sql.DATE, endDate || null)
      .input('DemandaId', sql.INT, (demandaId && demandaId !== '') ? parseInt(demandaId, 10) : null)
      .input('ComentarioStatus', sql.NVARCHAR(1000), comentarioStatus || null)
      .query(`INSERT INTO Tarefas (Titulo, ResponsavelId, Status, Prioridade, Inicio, Final, DemandaId, ComentarioStatus, Ativo) 
              OUTPUT Inserted.Id VALUES (@Title, @OwnerId, @Status, @Priority, @StartDate, @EndDate, @DemandaId, @ComentarioStatus, 1)`);
    res.json({ id: result.recordset[0].Id, ...req.body });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, ownerId, status, priority, startDate, endDate, demandaId, comentarioStatus, registrarHistorico, statusAnterior } = req.body;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });

    await pool.request()
      .input('Id', sql.INT, id).input('Title', sql.NVARCHAR(200), title).input('OwnerId', sql.INT, ownerId)
      .input('Status', sql.NVARCHAR(50), status).input('Priority', sql.NVARCHAR(50), priority)
      .input('StartDate', sql.DATE, startDate || null).input('EndDate', sql.DATE, endDate || null)
      .input('DemandaId', sql.INT, (demandaId && demandaId !== '') ? parseInt(demandaId, 10) : null).input('ComentarioStatus', sql.NVARCHAR(1000), comentarioStatus || null)
      .query(`UPDATE Tarefas SET Titulo=@Title, ResponsavelId=@OwnerId, Status=@Status, Prioridade=@Priority, 
              Inicio=@StartDate, Final=@EndDate, DemandaId=@DemandaId, ComentarioStatus=@ComentarioStatus WHERE Id=@Id`);

    if (registrarHistorico && status !== statusAnterior) {
      await pool.request().input('Id', sql.INT, id).query("UPDATE StatusHistorico SET DataFim = GETDATE() WHERE TipoEntidade='Tarefa' AND EntidadeId=@Id AND DataFim IS NULL");
      await pool.request()
        .input('Id', sql.INT, id).input('Prev', sql.NVARCHAR(50), statusAnterior).input('Next', sql.NVARCHAR(50), status)
        .input('User', sql.INT, req.user.userId).input('Msg', sql.NVARCHAR(1000), comentarioStatus || null)
        .query("INSERT INTO StatusHistorico (TipoEntidade, EntidadeId, StatusAnterior, StatusNovo, Comentario, UsuarioId) VALUES ('Tarefa', @Id, @Prev, @Next, @Msg, @User)");
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    await pool.request().input('Id', sql.INT, req.params.id).query('UPDATE Tarefas SET Ativo = 0 WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// SOLICITAÇÕES (REQUESTS) ENDPOINTS
// ============================================================
app.get('/api/requests', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request().query('SELECT * FROM Requests ORDER BY DataModificacao DESC');
    res.json(result.recordset.map(r => ({
      ...r,
      startDate: r.StartDate ? new Date(r.StartDate).toISOString().slice(0, 10) : null,
      endDate: r.EndDate ? new Date(r.EndDate).toISOString().slice(0, 10) : null
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// STATUS HISTÓRICO ENDPOINTS
// ============================================================
app.get('/api/status-historico/:tipo/:id', authMiddleware, async (req, res) => {
  try {
    const { tipo, id } = req.params;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request()
      .input('Tipo', sql.NVARCHAR(50), tipo)
      .input('Id', sql.INT, id)
      .query(`
        SELECT sh.Id, sh.StatusAnterior, sh.StatusNovo, sh.Comentario,
               sh.DataInicio, sh.DataFim, u.Email as UsuarioEmail,
               DATEDIFF(minute, sh.DataInicio, ISNULL(sh.DataFim, GETDATE())) as DuracaoMinutos
        FROM StatusHistorico sh
        LEFT JOIN BI_Usuarios u ON sh.UsuarioId = u.Id
        WHERE sh.TipoEntidade = @Tipo AND sh.EntidadeId = @Id
        ORDER BY sh.DataInicio DESC
      `);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// REQUESTS (SOLICITAÇÕES/ESCALA) ENDPOINTS
// ============================================================
app.get('/api/requests', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM Requests ORDER BY StartDate');
    res.json(result.recordset.map(r => ({
      ...r,
      startDate: r.StartDate ? new Date(r.StartDate).toISOString().slice(0, 10) : null,
      endDate: r.EndDate ? new Date(r.EndDate).toISOString().slice(0, 10) : null
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/requests', authMiddleware, async (req, res) => {
  try {
    const { employeeId, type, startDate, endDate, note, coverage, priority, status, localTrabalho } = req.body;
    const empId = Number(employeeId);
    if (!req.user.isAdmin && req.user.colaboradorId !== empId) return res.status(403).json({ error: 'Acesso negado' });
    const pool = await poolPromise;
    const result = await pool.request()
      .input('EmpId', sql.INT, empId).input('Type', sql.NVARCHAR(100), type).input('Status', sql.NVARCHAR(50), status || 'Pendente')
      .input('Start', sql.DATE, startDate || null).input('End', sql.DATE, endDate || null).input('Note', sql.NVARCHAR(500), note || '')
      .input('Cov', sql.NVARCHAR(100), coverage || '').input('Pri', sql.NVARCHAR(50), priority || 'Baixa').input('Loc', sql.NVARCHAR(50), localTrabalho || null)
      .query(`INSERT INTO Requests (EmployeeId, Type, Status, StartDate, EndDate, Note, Coverage, Priority, LocalTrabalho, DataCriacao, DataModificacao)
              OUTPUT Inserted.Id VALUES (@EmpId, @Type, @Status, @Start, @End, @Note, @Cov, @Pri, @Loc, GETDATE(), GETDATE())`);
    res.json({ id: result.recordset[0].Id, ...req.body });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/requests/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, localTrabalho } = req.body;
    const pool = await poolPromise;
    const current = await pool.request().input('Id', sql.INT, id).query('SELECT EmployeeId, Type, StartDate, Note FROM Requests WHERE Id = @Id');
    if (!current.recordset.length) return res.status(404).json({ error: 'Não encontrado' });
    const original = current.recordset[0];
    if (!req.user.isAdmin && req.user.colaboradorId !== original.EmployeeId) return res.status(403).json({ error: 'Sem permissão' });

    // Business Logic: Auto-apply adjustment to scale if approved
    if (status === 'Aprovado' && original.Type === 'Ajuste de Escala') {
      const dateKey = original.StartDate ? new Date(original.StartDate).toISOString().slice(0, 10) : null;
      const novoLocal = original.Note ? original.Note.split('|')[0].trim() : 'Presencial';
      if (dateKey) {
        await pool.request().input('Emp', sql.INT, original.EmployeeId).input('Date', sql.DATE, dateKey).input('Loc', sql.NVARCHAR(50), novoLocal)
          .query(`IF EXISTS (SELECT 1 FROM Requests WHERE EmployeeId=@Emp AND Type='Escala de Trabalho' AND StartDate=@Date)
                  UPDATE Requests SET LocalTrabalho=@Loc, DataModificacao=GETDATE() WHERE EmployeeId=@Emp AND Type='Escala de Trabalho' AND StartDate=@Date
                  ELSE INSERT INTO Requests (EmployeeId, Type, Status, StartDate, EndDate, LocalTrabalho, DataCriacao, DataModificacao) 
                  VALUES (@Emp, 'Escala de Trabalho', 'Aprovado', @Date, @Date, @Loc, GETDATE(), GETDATE())`);
      }
    }

    await pool.request().input('Id', sql.INT, id).input('Status', sql.NVARCHAR(50), status || null).input('Loc', sql.NVARCHAR(50), localTrabalho || null)
      .query('UPDATE Requests SET Status = ISNULL(@Status, Status), LocalTrabalho = ISNULL(@Loc, LocalTrabalho), DataModificacao = GETDATE() WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/requests/:id', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    const current = await pool.request().input('Id', sql.INT, req.params.id).query('SELECT EmployeeId FROM Requests WHERE Id = @Id');
    if (current.recordset.length && !req.user.isAdmin && req.user.colaboradorId !== current.recordset[0].EmployeeId) return res.status(403).json({ error: 'Negado' });
    await pool.request().input('Id', sql.INT, req.params.id).query('DELETE FROM Requests WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// EVENTOS (CALENDAR) ENDPOINTS
// ============================================================
app.get('/api/eventos', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT e.Id as id, e.Titulo as titulo, e.Descricao as descricao, e.DataInicio as dataInicio, e.DataFim as dataFim,
             e.Tipo as tipo, e.AreaId as areaId, e.ResponsavelId as responsavelId, a.Nome as areaNome, r.Nome as responsavelNome
      FROM BI_Eventos e LEFT JOIN BI_Areas a ON e.AreaId = a.Id LEFT JOIN BI_Colaboradores r ON e.ResponsavelId = r.Id
      ORDER BY e.DataInicio DESC
    `);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/eventos', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { titulo, descricao, dataInicio, dataFim, tipo, areaId, responsavelId } = req.body;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('Tit', sql.NVARCHAR(200), titulo).input('Des', sql.NVARCHAR(1000), descricao || null)
      .input('Start', sql.DATETIME, new Date(dataInicio)).input('End', sql.DATETIME, dataFim ? new Date(dataFim) : null)
      .input('Tipo', sql.NVARCHAR(50), tipo || 'Reunião').input('Area', sql.INT, (areaId && areaId !== '') ? areaId : null)
      .input('Resp', sql.INT, (responsavelId && responsavelId !== '') ? responsavelId : null).input('User', sql.INT, req.user.colaboradorId || null)
      .query(`INSERT INTO BI_Eventos (Titulo, Descricao, DataInicio, DataFim, Tipo, AreaId, ResponsavelId, CriadoPor)
              OUTPUT Inserted.Id VALUES (@Tit, @Des, @Start, @End, @Tipo, @Area, @Resp, @User)`);
    res.json({ id: result.recordset[0].Id, ...req.body });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/eventos/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descricao, dataInicio, dataFim, tipo, areaId, responsavelId } = req.body;
    const pool = await poolPromise;
    await pool.request()
      .input('Id', sql.INT, id).input('Tit', sql.NVARCHAR(200), titulo).input('Des', sql.NVARCHAR(1000), descricao || null)
      .input('Start', sql.DATETIME, new Date(dataInicio)).input('End', sql.DATETIME, dataFim ? new Date(dataFim) : null)
      .input('Tipo', sql.NVARCHAR(50), tipo || 'Reunião').input('Area', sql.INT, (areaId && areaId !== '') ? areaId : null)
      .input('Resp', sql.INT, (responsavelId && responsavelId !== '') ? responsavelId : null)
      .query(`UPDATE BI_Eventos SET Titulo=@Tit, Descricao=@Des, DataInicio=@Start, DataFim=@End, Tipo=@Tipo, 
              AreaId=@Area, ResponsavelId=@Resp, DataModificacao=GETDATE() WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/eventos/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('Id', sql.INT, req.params.id).query('DELETE FROM BI_Eventos WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// STATUS TIPOS ENDPOINTS
// ============================================================
app.get('/api/status-tipos', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM BI_StatusTipos ORDER BY Ordem, Nome');
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/status-tipos', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { nome, cor, aplicacao, ordem } = req.body;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('Nom', sql.NVARCHAR(50), nome).input('Cor', sql.NVARCHAR(20), cor || '#c4c4c4')
      .input('App', sql.NVARCHAR(20), aplicacao || 'Ambos').input('Ord', sql.INT, ordem || 99)
      .query('INSERT INTO BI_StatusTipos (Nome, Cor, Aplicacao, Ordem) OUTPUT Inserted.Id VALUES (@Nom, @Cor, @App, @Ord)');
    res.json({ id: result.recordset[0].Id, ...req.body, ativo: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/status-tipos/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, cor, aplicacao, ativo, ordem } = req.body;
    const pool = await poolPromise;
    await pool.request()
      .input('Id', sql.INT, id).input('Nom', sql.NVARCHAR(50), nome).input('Cor', sql.NVARCHAR(20), cor).input('App', sql.NVARCHAR(20), aplicacao)
      .input('Ativ', sql.BIT, ativo ? 1 : 0).input('Ord', sql.INT, ordem)
      .query('UPDATE BI_StatusTipos SET Nome=@Nom, Cor=@Cor, Aplicacao=@App, Ativo=@Ativ, Ordem=@Ord WHERE Id=@Id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// SERVING & START
app.use(express.static(__dirname));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Internal Server Error' }); });
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log('📡 Rotas de API Ativas:');
  const routes = app._router ? app._router.stack : [];
  routes.forEach(r => { if (r.route && r.route.path) console.log(`   - ${Object.keys(r.route.methods).join(',').toUpperCase().padEnd(7)} ${r.route.path}`); });
});

