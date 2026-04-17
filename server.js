const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const path = require('path');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const JWT_SECRET = process.env.JWT_SECRET || 'gestaobi-secret-2026-change-in-prod';
const JWT_EXPIRES = '8h';

// Este objeto substitui a connectionString antiga e usa as variáveis da Azure
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: true, // Obrigatório para Azure SQL
        trustServerCertificate: false
    }
};

// Nova forma de conectar (mais estável para o ambiente Linux)
const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('✅ Conectado ao Azure SQL com sucesso!');
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
               c.Nome, c.Cargo, c.NivelHierarquia, c.Color, c.AvatarUrl,
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
      nome: user.Nome
    }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.json({
      token,
      user: {
        id: user.Id,
        email: user.Email,
        isAdmin: !!user.IsAdmin,
        colaboradorId: user.ColaboradorId,
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

    res.json({ success: true, message: 'Colaborador adicionado e conta de usuário criada' });
  } catch (err) {
    console.error('Erro ao adicionar colaborador:', err);
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
    if (areaId !== undefined) { updates.push('AreaId = @AreaId'); request.input('AreaId', sql.INT, areaId); }
    if (cargoId !== undefined) { updates.push('CargoId = @CargoId'); request.input('CargoId', sql.INT, cargoId); }
    if (gestorId !== undefined) { updates.push('GestorId = @GestorId'); request.input('GestorId', sql.INT, gestorId ? parseInt(gestorId, 10) : null); }
    
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

app.get('/api/areas', async (req, res) => {
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
    let query = 'UPDATE BI_Areas SET ';
    const request = pool.request().input('Id', sql.INT, id);
    const updates = [];
    if (nome !== undefined) { updates.push('Nome = @Nome'); request.input('Nome', sql.NVARCHAR(100), nome); }
    if (ativo !== undefined) { 
        updates.push('Ativo = @Ativo, DataInativacao = @DataInativacao'); 
        request.input('Ativo', sql.BIT, ativo ? 1 : 0);
        request.input('DataInativacao', sql.DATETIME, ativo ? null : new Date());
    }
    await request.query(`${query} ${updates.join(', ')} WHERE Id = @Id`);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// TASKS ENDPOINTS
// ============================================================

app.get('/api/tasks', async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request().query(`
      SELECT t.Id, t.Titulo as Title, t.ResponsavelId as OwnerId,
             t.Status, t.Prioridade as Priority,
             t.Inicio as StartDate, t.Final as EndDate,
             t.DemandaId, t.ComentarioStatus,
             t.InicioRealizado, t.FimRealizado,
             d.Titulo as DemandaTitulo
      FROM Tarefas t
      LEFT JOIN Demandas d ON t.DemandaId = d.Id
      WHERE t.Ativo = 1
      ORDER BY t.Id
    `);
    res.json(result.recordset.map(t => ({
      ...t,
      startDate: t.StartDate ? new Date(t.StartDate).toISOString().slice(0, 10) : '',
      endDate: t.EndDate ? new Date(t.EndDate).toISOString().slice(0, 10) : '',
      inicioRealizado: t.InicioRealizado ? new Date(t.InicioRealizado).toISOString().slice(0, 10) : null,
      fimRealizado: t.FimRealizado ? new Date(t.FimRealizado).toISOString().slice(0, 10) : null
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const { title, ownerId, status, priority, startDate, endDate, demandaId, comentarioStatus } = req.body;
    const result = await pool.request()
      .input('Title', sql.NVARCHAR(200), title || '')
      .input('OwnerId', sql.INT, ownerId || null)
      .input('Status', sql.NVARCHAR(50), status || 'Não Iniciado')
      .input('Priority', sql.NVARCHAR(50), priority || 'Baixa')
      .input('StartDate', sql.DATE, startDate || null)
      .input('EndDate', sql.DATE, endDate || null)
      .input('DemandaId', sql.INT, demandaId || null)
      .input('ComentarioStatus', sql.NVARCHAR(1000), comentarioStatus || null)
      .query(`
        INSERT INTO Tarefas (Titulo, ResponsavelId, Status, Prioridade, Inicio, Final, DemandaId, ComentarioStatus)
        OUTPUT Inserted.Id
        VALUES (@Title, @OwnerId, @Status, @Priority, @StartDate, @EndDate, @DemandaId, @ComentarioStatus)
      `);
    res.json({ id: result.recordset[0].Id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, ownerId, status, priority, startDate, endDate, demandaId, comentarioStatus, registrarHistorico, usuarioId, statusAnterior } = req.body;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });

    // Update task
    await pool.request()
      .input('Id', sql.INT, id)
      .input('Title', sql.NVARCHAR(200), title)
      .input('OwnerId', sql.INT, ownerId)
      .input('Status', sql.NVARCHAR(50), status)
      .input('Priority', sql.NVARCHAR(50), priority)
      .input('StartDate', sql.DATE, startDate || null)
      .input('EndDate', sql.DATE, endDate || null)
      .input('DemandaId', sql.INT, demandaId || null)
      .input('ComentarioStatus', sql.NVARCHAR(1000), comentarioStatus || null)
      .query(`
        UPDATE Tarefas
        SET Titulo = @Title, ResponsavelId = @OwnerId, Status = @Status,
            Prioridade = @Priority, Inicio = @StartDate, Final = @EndDate,
            DemandaId = @DemandaId, ComentarioStatus = @ComentarioStatus
        WHERE Id = @Id
      `);

    // Register status history if status changed
    if (registrarHistorico && status !== statusAnterior) {
      // Close previous open status record
      await pool.request()
        .input('EntidadeId', sql.INT, id)
        .query(`
          UPDATE StatusHistorico SET DataFim = GETDATE()
          WHERE TipoEntidade = 'Tarefa' AND EntidadeId = @EntidadeId AND DataFim IS NULL
        `);
      // Insert new status record
      await pool.request()
        .input('EntidadeId', sql.INT, id)
        .input('StatusAnterior', sql.NVARCHAR(50), statusAnterior || null)
        .input('StatusNovo', sql.NVARCHAR(50), status)
        .input('Comentario', sql.NVARCHAR(1000), comentarioStatus || null)
        .input('UsuarioId', sql.INT, usuarioId || null)
        .query(`
          INSERT INTO StatusHistorico (TipoEntidade, EntidadeId, StatusAnterior, StatusNovo, Comentario, UsuarioId)
          VALUES ('Tarefa', @EntidadeId, @StatusAnterior, @StatusNovo, @Comentario, @UsuarioId)
        `);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { colaboradorId, isAdmin } = req.user;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });

    // Check ownership if not admin
    if (!isAdmin) {
      const task = await pool.request()
        .input('Id', sql.INT, id)
        .query('SELECT ResponsavelId FROM Tarefas WHERE Id = @Id');
      if (!task.recordset.length) return res.status(404).json({ error: 'Tarefa não encontrada' });
      if (task.recordset[0].ResponsavelId !== colaboradorId) {
        return res.status(403).json({ error: 'Sem permissão para excluir esta tarefa' });
      }
    }

    await pool.request().input('Id', sql.INT, id).query('UPDATE Tarefas SET Ativo = 0 WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DEMANDAS ENDPOINTS
// ============================================================

app.get('/api/demandas', async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request().query(`
      SELECT d.Id, d.Titulo, d.Descricao, d.ResponsavelId,
             d.Status, d.Prioridade, d.InicioPlanjado, d.FimPlanejado,
             d.InicioRealizado, d.FimRealizado,
             d.ComentarioStatus, d.DataCriacao, d.DataModificacao,
             c.Nome as ResponsavelNome,
             (SELECT COUNT(*) FROM Tarefas WHERE DemandaId = d.Id) as TotalTarefas,
             (SELECT COUNT(*) FROM Tarefas WHERE DemandaId = d.Id AND Status = 'Feito') as TarefasConcluidas
      FROM Demandas d
      LEFT JOIN BI_Colaboradores c ON d.ResponsavelId = c.Id
      ORDER BY d.DataModificacao DESC
    `);
    res.json(result.recordset.map(d => ({
      ...d,
      inicioPlanjado: d.InicioPlanjado ? new Date(d.InicioPlanjado).toISOString().slice(0, 10) : null,
      fimPlanejado: d.FimPlanejado ? new Date(d.FimPlanejado).toISOString().slice(0, 10) : null,
      inicioRealizado: d.InicioRealizado ? new Date(d.InicioRealizado).toISOString().slice(0, 10) : null,
      fimRealizado: d.FimRealizado ? new Date(d.FimRealizado).toISOString().slice(0, 10) : null
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/demandas', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const { titulo, descricao, responsavelId, status, prioridade, inicioPlanjado, fimPlanejado } = req.body;
    const result = await pool.request()
      .input('Titulo', sql.NVARCHAR(300), titulo)
      .input('Descricao', sql.NVARCHAR(2000), descricao || null)
      .input('ResponsavelId', sql.INT, responsavelId || null)
      .input('Status', sql.NVARCHAR(50), status || 'Não Iniciado')
      .input('Prioridade', sql.NVARCHAR(50), prioridade || 'Média')
      .input('InicioPlanjado', sql.DATE, inicioPlanjado || null)
      .input('FimPlanejado', sql.DATE, fimPlanejado || null)
      .query(`
        INSERT INTO Demandas (Titulo, Descricao, ResponsavelId, Status, Prioridade, InicioPlanjado, FimPlanejado)
        OUTPUT Inserted.Id, Inserted.DataCriacao
        VALUES (@Titulo, @Descricao, @ResponsavelId, @Status, @Prioridade, @InicioPlanjado, @FimPlanejado)
      `);
    res.json({ id: result.recordset[0].Id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/demandas/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descricao, responsavelId, status, prioridade, inicioPlanjado, fimPlanejado, comentarioStatus, statusAnterior, registrarHistorico, responsavelAnterior, inicioAnterior, fimAnterior, justificativa } = req.body;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });

    const rId = responsavelId && responsavelId !== "" ? parseInt(responsavelId) : null;

    await pool.request()
      .input('Id', sql.INT, id)
      .input('Titulo', sql.NVARCHAR(300), titulo)
      .input('Descricao', sql.NVARCHAR(2000), descricao || null)
      .input('ResponsavelId', sql.INT, rId)
      .input('Status', sql.NVARCHAR(50), status)
      .input('Prioridade', sql.NVARCHAR(50), prioridade)
      .input('InicioPlanjado', sql.DATE, inicioPlanjado || null)
      .input('FimPlanejado', sql.DATE, fimPlanejado || null)
      .input('ComentarioStatus', sql.NVARCHAR(1000), justificativa || comentarioStatus || null)
      .query(`
        UPDATE Demandas
        SET Titulo = @Titulo, Descricao = @Descricao, ResponsavelId = @ResponsavelId,
            Status = @Status, Prioridade = @Prioridade, InicioPlanjado = @InicioPlanjado,
            FimPlanejado = @FimPlanejado, ComentarioStatus = @ComentarioStatus,
            DataModificacao = GETDATE()
        WHERE Id = @Id
      `);

    // Record Significant Changes in History
    const hasStatusChange = registrarHistorico && status !== statusAnterior;
    const hasRespChange = responsavelAnterior && rId !== parseInt(responsavelAnterior);
    const hasDateChange = (inicioAnterior && inicioPlanjado !== inicioAnterior.slice(0,10)) || (fimAnterior && fimPlanejado !== fimAnterior.slice(0,10));

    if (hasStatusChange || hasRespChange || hasDateChange) {
      const logPool = await poolPromise;
      // Close previous records if it's a status change
      if (hasStatusChange) {
        await logPool.request()
          .input('EntidadeId', sql.INT, id)
          .query(`UPDATE StatusHistorico SET DataFim = GETDATE() WHERE TipoEntidade = 'Demanda' AND EntidadeId = @EntidadeId AND DataFim IS NULL`);
      }

      let summary = '';
      if (hasStatusChange) summary += `Status: ${statusAnterior} -> ${status}. `;
      if (hasRespChange) summary += `Resp: ${responsavelAnterior} -> ${rId}. `;
      if (hasDateChange) summary += `Prazo: ${inicioAnterior?.slice(0,10)}/${fimAnterior?.slice(0,10)} -> ${inicioPlanjado}/${fimPlanejado}. `;

      await logPool.request()
        .input('EntidadeId', sql.INT, id)
        .input('StatusAnterior', sql.NVARCHAR(50), statusAnterior || 'Original')
        .input('StatusNovo', sql.NVARCHAR(50), status || 'Atualizado')
        .input('Comentario', sql.NVARCHAR(1000), (summary + (justificativa || '')).trim())
        .input('UsuarioId', sql.INT, req.user.userId)
        .query(`INSERT INTO StatusHistorico (TipoEntidade, EntidadeId, StatusAnterior, StatusNovo, Comentario, UsuarioId) VALUES ('Demanda', @EntidadeId, @StatusAnterior, @StatusNovo, @Comentario, @UsuarioId)`);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/demandas/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Apenas administradores podem excluir demandas' });
    // Unlink tasks first
    await pool.request().input('Id', sql.INT, id).query('UPDATE Tarefas SET DemandaId = NULL WHERE DemandaId = @Id');
    await pool.request().input('Id', sql.INT, id).query('DELETE FROM StatusHistorico WHERE TipoEntidade = \'Demanda\' AND EntidadeId = @Id');
    await pool.request().input('Id', sql.INT, id).query('DELETE FROM Demandas WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// STATUS HISTÓRICO ENDPOINTS
// ============================================================

app.get('/api/status-historico/:tipo/:id', async (req, res) => {
  try {
    const { tipo, id } = req.params;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request()
      .input('Tipo', sql.NVARCHAR(20), tipo)
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// REQUESTS ENDPOINTS
// ============================================================

app.get('/api/requests', async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request().query('SELECT * FROM Requests ORDER BY StartDate');
    const formatted = result.recordset.map(r => ({
      id: r.Id,
      employeeId: r.EmployeeId,
      type: r.Type,
      status: r.Status,
      startDate: r.StartDate ? new Date(r.StartDate).toISOString().slice(0, 10) : null,
      endDate: r.EndDate ? new Date(r.EndDate).toISOString().slice(0, 10) : null,
      note: r.Note,
      coverage: r.Coverage,
      priority: r.Priority,
      localTrabalho: r.LocalTrabalho,
      dataCriacao: r.DataCriacao,
      dataModificacao: r.DataModificacao
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/requests', authMiddleware, async (req, res) => {
  try {
    const { employeeId, type, startDate, endDate, note, coverage, priority, status, localTrabalho } = req.body;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });

    // Restrict access: only owner or admin can create requests (scales or vacations)
    const empId = Number(employeeId);
    if (!req.user.isAdmin && req.user.colaboradorId !== empId) {
      return res.status(403).json({ error: 'Você só pode criar agendamentos e escalas para si mesmo.' });
    }

    const result = await pool.request()
      .input('EmployeeId', sql.INT, empId)
      .input('Type', sql.NVARCHAR(100), type)
      .input('Status', sql.NVARCHAR(50), status || 'Pendente')
      .input('StartDate', sql.DATE, startDate || null)
      .input('EndDate', sql.DATE, endDate || null)
      .input('Note', sql.NVARCHAR(500), note || '')
      .input('Coverage', sql.NVARCHAR(100), coverage || '')
      .input('Priority', sql.NVARCHAR(50), priority || 'Baixa')
      .input('LocalTrabalho', sql.NVARCHAR(50), localTrabalho || null)
      .query(`
        INSERT INTO Requests (EmployeeId, Type, Status, StartDate, EndDate, Note, Coverage, Priority, LocalTrabalho, DataCriacao, DataModificacao)
        OUTPUT Inserted.Id, Inserted.DataCriacao, Inserted.DataModificacao
        VALUES (@EmployeeId, @Type, @Status, @StartDate, @EndDate, @Note, @Coverage, @Priority, @LocalTrabalho, GETDATE(), GETDATE())
      `);
    res.json({ id: result.recordset[0].Id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/requests/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, localTrabalho, reviewedBy, aprovadorId, aprovadorNivel, motivoAjuste } = req.body;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });

    // Fetch original request to check ownership
    const currentReqQuery = await pool.request()
      .input('Id', sql.INT, id)
      .query('SELECT EmployeeId, DataCriacao, DataModificacao, Type FROM Requests WHERE Id = @Id');
    
    if (currentReqQuery.recordset.length === 0) return res.status(404).json({ error: 'Solicitação não encontrada' });
    const originalRequest = currentReqQuery.recordset[0];

    // Ownership check: must be admin or the owner of the request to modify non-approval fields
    const isOwner = req.user.colaboradorId === originalRequest.EmployeeId;
    
    // If it's a field modification (like localTrabalho) and not an admin approval/rejection
    if (!status || (status !== 'Aprovado' && status !== 'Rejeitado')) {
      if (!req.user.isAdmin && !isOwner) {
        return res.status(403).json({ error: 'Você não tem permissão para alterar esta solicitação.' });
      }
    }

    // Hierarchy validation for approval
    if ((status === 'Aprovado' || status === 'Rejeitado') && aprovadorId && aprovadorNivel) {
      const requestEmpl = await pool.request()
        .input('Id', sql.INT, id)
        .query(`
          SELECT r.EmployeeId, c.NivelHierarquia
          FROM Requests r
          JOIN BI_Colaboradores c ON r.EmployeeId = c.Id
          WHERE r.Id = @Id
        `);
      if (requestEmpl.recordset.length > 0) {
        const solicitanteNivel = requestEmpl.recordset[0].NivelHierarquia;
        if (aprovadorNivel >= solicitanteNivel) {
          return res.status(403).json({ error: 'Nível hierárquico insuficiente para aprovar esta solicitação' });
        }
      }
    }

    // --- Regra de 24h para Escala de Trabalho ---
    let registrarModificacao = true;
    if (localTrabalho) {
      const referenceDate = originalRequest.DataModificacao || originalRequest.DataCriacao;
      if (referenceDate) {
        const diffMs = Date.now() - new Date(referenceDate).getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        registrarModificacao = diffHours >= 24;
      }
    }

    // Se for aprovação de um 'Ajuste de Escala', aplicar a mudança na escala
    if (status === 'Aprovado') {
      const reqData = await pool.request().input('Id', sql.INT, id)
        .query('SELECT Type, EmployeeId, StartDate, Note FROM Requests WHERE Id = @Id');
      if (reqData.recordset.length > 0 && reqData.recordset[0].Type === 'Ajuste de Escala') {
        const ajuste = reqData.recordset[0];
        const dateKey = ajuste.StartDate ? new Date(ajuste.StartDate).toISOString().slice(0, 10) : null;
        const novoLocal = ajuste.Note ? ajuste.Note.split('|')[0].trim() : 'Presencial';
        if (dateKey) {
          const existingScale = await pool.request()
            .input('EmpId', sql.INT, ajuste.EmployeeId)
            .input('DateKey', sql.DATE, dateKey)
            .query("SELECT Id FROM Requests WHERE EmployeeId = @EmpId AND Type = 'Escala de Trabalho' AND StartDate = @DateKey");
          if (existingScale.recordset.length > 0) {
            await pool.request()
              .input('ScaleId', sql.INT, existingScale.recordset[0].Id)
              .input('Local', sql.NVARCHAR(50), novoLocal)
              .query('UPDATE Requests SET LocalTrabalho = @Local, DataModificacao = GETDATE() WHERE Id = @ScaleId');
          } else {
            await pool.request()
              .input('EmpId', sql.INT, ajuste.EmployeeId)
              .input('DateKey', sql.DATE, dateKey)
              .input('Local', sql.NVARCHAR(50), novoLocal)
              .query("INSERT INTO Requests (EmployeeId, Type, Status, StartDate, EndDate, LocalTrabalho, Priority, DataCriacao, DataModificacao) VALUES (@EmpId, 'Escala de Trabalho', 'Aprovado', @DateKey, @DateKey, @Local, 'Baixa', GETDATE(), GETDATE())");
          }
        }
      }
    }

    await pool.request()
      .input('Id', sql.INT, id)
      .input('Status', sql.NVARCHAR(50), status || null)
      .input('LocalTrabalho', sql.NVARCHAR(50), localTrabalho || null)
      .query(`
        UPDATE Requests
        SET Status = ISNULL(@Status, Status),
            LocalTrabalho = ISNULL(@LocalTrabalho, LocalTrabalho),
            DataModificacao = ${registrarModificacao ? 'GETDATE()' : 'DataModificacao'}
        WHERE Id = @Id
      `);
    res.json({ success: true, registrarModificacao });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/requests/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });

    // Check ownership
    const currentReqQuery = await pool.request()
      .input('Id', sql.INT, id)
      .query('SELECT EmployeeId FROM Requests WHERE Id = @Id');
    
    if (currentReqQuery.recordset.length === 0) return res.status(404).json({ error: 'Solicitação não encontrada' });
    
    if (!req.user.isAdmin && req.user.colaboradorId !== currentReqQuery.recordset[0].EmployeeId) {
      return res.status(403).json({ error: 'Você não tem permissão para excluir esta solicitação.' });
    }

    await pool.request().input('Id', sql.INT, id).query('DELETE FROM Requests WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/cargos', async (req, res) => {
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
// EVENTOS (CALENDAR) ENDPOINTS
// ============================================================

app.get('/api/eventos', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    // Try to use BI_Eventos table; create it if it doesn't exist
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BI_Eventos' AND xtype='U')
        CREATE TABLE BI_Eventos (
          Id INT IDENTITY(1,1) PRIMARY KEY,
          Titulo NVARCHAR(200) NOT NULL,
          Descricao NVARCHAR(1000),
          DataInicio DATETIME NOT NULL,
          DataFim DATETIME,
          Tipo NVARCHAR(50) DEFAULT 'Reunião',
          CriadoPor INT,
          DataCriacao DATETIME DEFAULT GETDATE(),
          DataModificacao DATETIME DEFAULT GETDATE()
        )
      `);
    } catch(tblErr) { /* table may already exist */ }
    const result = await pool.request().query(`
      SELECT e.Id, e.Titulo, e.Descricao, e.DataInicio, e.DataFim, e.Tipo, e.CriadoPor,
             c.Nome as CriadoPorNome
      FROM BI_Eventos e
      LEFT JOIN BI_Colaboradores c ON e.CriadoPor = c.Id
      ORDER BY e.DataInicio DESC
    `);
    res.json(result.recordset.map(ev => ({
      ...ev,
      dataInicio: ev.DataInicio ? new Date(ev.DataInicio).toISOString().slice(0, 16) : null,
      dataFim: ev.DataFim ? new Date(ev.DataFim).toISOString().slice(0, 16) : null
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/eventos', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { titulo, descricao, dataInicio, dataFim, tipo } = req.body;
    if (!titulo || !dataInicio) return res.status(400).json({ error: 'Título e data de início obrigatórios' });
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request()
      .input('Titulo', sql.NVARCHAR(200), titulo)
      .input('Descricao', sql.NVARCHAR(1000), descricao || null)
      .input('DataInicio', sql.DATETIME, new Date(dataInicio))
      .input('DataFim', sql.DATETIME, dataFim ? new Date(dataFim) : null)
      .input('Tipo', sql.NVARCHAR(50), tipo || 'Reunião')
      .input('CriadoPor', sql.INT, req.user.colaboradorId || null)
      .query(`INSERT INTO BI_Eventos (Titulo, Descricao, DataInicio, DataFim, Tipo, CriadoPor)
              OUTPUT Inserted.Id VALUES (@Titulo, @Descricao, @DataInicio, @DataFim, @Tipo, @CriadoPor)`);
    res.json({ id: result.recordset[0].Id, ...req.body });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/eventos/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descricao, dataInicio, dataFim, tipo } = req.body;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    await pool.request()
      .input('Id', sql.INT, id)
      .input('Titulo', sql.NVARCHAR(200), titulo)
      .input('Descricao', sql.NVARCHAR(1000), descricao || null)
      .input('DataInicio', sql.DATETIME, new Date(dataInicio))
      .input('DataFim', sql.DATETIME, dataFim ? new Date(dataFim) : null)
      .input('Tipo', sql.NVARCHAR(50), tipo || 'Reunião')
      .query(`UPDATE BI_Eventos SET Titulo=@Titulo, Descricao=@Descricao, DataInicio=@DataInicio,
              DataFim=@DataFim, Tipo=@Tipo, DataModificacao=GETDATE() WHERE Id=@Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/eventos/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    await pool.request().input('Id', sql.INT, id).query('DELETE FROM BI_Eventos WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// STATUS TIPOS ENDPOINTS (custom demand/task statuses)
// ============================================================

app.get('/api/status-tipos', authMiddleware, async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BI_StatusTipos' AND xtype='U')
        CREATE TABLE BI_StatusTipos (
          Id INT IDENTITY(1,1) PRIMARY KEY,
          Nome NVARCHAR(50) NOT NULL,
          Cor NVARCHAR(20) DEFAULT '#c4c4c4',
          Aplicacao NVARCHAR(20) DEFAULT 'Ambos',
          Ativo BIT DEFAULT 1,
          Ordem INT DEFAULT 99
        )
      `);
    } catch(tblErr) { /* table may already exist */ }
    const result = await pool.request().query('SELECT Id, Nome, Cor, Aplicacao, Ativo, Ordem FROM BI_StatusTipos ORDER BY Ordem, Nome');
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/status-tipos', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { nome, cor, aplicacao, ordem } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request()
      .input('Nome', sql.NVARCHAR(50), nome)
      .input('Cor', sql.NVARCHAR(20), cor || '#c4c4c4')
      .input('Aplicacao', sql.NVARCHAR(20), aplicacao || 'Ambos')
      .input('Ordem', sql.INT, ordem || 99)
      .query('INSERT INTO BI_StatusTipos (Nome, Cor, Aplicacao, Ordem) OUTPUT Inserted.Id VALUES (@Nome, @Cor, @Aplicacao, @Ordem)');
    res.json({ id: result.recordset[0].Id, nome, cor, aplicacao, ordem, ativo: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/status-tipos/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, cor, aplicacao, ativo, ordem } = req.body;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const updates = [];
    const request = pool.request().input('Id', sql.INT, id);
    if (nome !== undefined) { updates.push('Nome = @Nome'); request.input('Nome', sql.NVARCHAR(50), nome); }
    if (cor !== undefined) { updates.push('Cor = @Cor'); request.input('Cor', sql.NVARCHAR(20), cor); }
    if (aplicacao !== undefined) { updates.push('Aplicacao = @Aplicacao'); request.input('Aplicacao', sql.NVARCHAR(20), aplicacao); }
    if (ativo !== undefined) { updates.push('Ativo = @Ativo'); request.input('Ativo', sql.BIT, ativo ? 1 : 0); }
    if (ordem !== undefined) { updates.push('Ordem = @Ordem'); request.input('Ordem', sql.INT, ordem); }
    if (!updates.length) return res.status(400).json({ error: 'Nada a atualizar' });
    await request.query(`UPDATE BI_StatusTipos SET ${updates.join(', ')} WHERE Id = @Id`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/status-tipos/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    await pool.request().input('Id', sql.INT, id).query('DELETE FROM BI_StatusTipos WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// START SERVER
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`   http://localhost:${PORT}`);
});
