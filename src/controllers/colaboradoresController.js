const { poolPromise, sql } = require('../config/database');
const bcrypt = require('bcryptjs');
const { formatDateYYYYMMDD, toServerDate } = require('../utils/dateFormatters');

exports.getAll = async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request().query(`
      SELECT c.*, a.Nome as AreaNome, nh.Descricao as NivelDescricao, car.Nome as CargoNome, g.Nome as GestorNome,
             CASE WHEN c.AvatarUrl IS NOT NULL AND DATALENGTH(c.AvatarUrl) > 0 THEN 1 ELSE 0 END as HasAvatar
      FROM BI_Colaboradores c
      LEFT JOIN BI_Areas a ON c.AreaId = a.Id
      LEFT JOIN NiveisHierarquia nh ON c.NivelHierarquia = nh.Id
      LEFT JOIN BI_Cargos car ON c.CargoId = car.Id
      LEFT JOIN BI_Colaboradores g ON c.GestorId = g.Id
      WHERE c.Ativo = 1 AND c.Nome <> 'Administrador Local'
      ORDER BY c.Nome
    `);
    
    console.log(`📊 Query BI_Colaboradores retornou ${result.recordset.length} linhas.`);

    const formatted = result.recordset.map(c => {
      // Remover campos pesados para não sobrecarregar o tráfego da árvore/dashboard
      delete c.ResumoProfissional;
      delete c.TimelineRealizacoes;
      delete c.Formacoes;
      delete c.MeritosPromocoes;
      delete c.AvatarFull;
      
      return {
        // Campos base mapeados explicitamente para camelCase para o frontend
        id: c.Id,
        name: c.Nome,
        email: c.Email,
        cargoId: c.CargoId,
        areaId: c.AreaId,
        nivelHierarquia: c.NivelHierarquia,
        gestorId: c.GestorId,
        tp_contrato: c.Tp_contrato,
        color: c.Color || '#33cccc',
        avatarUrl: c.HasAvatar ? `/api/colaboradores/${c.Id}/avatar` : null,
        dataNascimento: formatDateYYYYMMDD(c.DataNascimento),
        dataAdmissao: formatDateYYYYMMDD(c.DataAdmissao),
        exibirIdade: c.ExibirIdade === true || c.ExibirIdade === 1,
        ativo: c.Ativo === true || c.Ativo === 1,
        
        // Campos de Junção (Aliases)
        areaNome: c.AreaNome,
        nivelDescricao: c.NivelDescricao,
        cargoNome: c.CargoNome,
        gestorNome: c.GestorNome,
        
        // Campos legados/extras
        cargo: c.Cargo,
        gestor: c.Gestor,
        equipe: c.Equipe,
        delegadoId: c.DelegadoId,
        delegacaoInicio: c.DelegacaoInicio,
        delegacaoFim: c.DelegacaoFim,
        delegacaoAtiva: c.DelegacaoAtiva
      };
    });
    
    res.json(formatted);
  } catch (err) { 
    console.error('❌ Erro em getAll Colaboradores:', err);
    res.status(500).json({ error: err.message }); 
  }
};

exports.getProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('Id', sql.INT, id)
      .query(`SELECT * FROM BI_ColaboradorPerfis WHERE ColaboradorId = @Id`);
    
    const p = result.recordset[0] || {};
    res.json({
      resumoProfissional: p.ResumoProfissional || '',
      timelineRealizacoes: p.TimelineRealizacoes || '[]',
      formacoes: p.Formacoes || '[]',
      meritosPromocoes: p.MeritosPromocoes || '[]',
      avatarFull: p.AvatarFull || ''
    });
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
    const { nome, email, cargoId, areaId, nivelHierarquia, gestorId, tp_contrato, color, avatarUrl, dataNascimento, dataAdmissao, exibirIdade } = req.body;
    
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
      .input('DataAdmissao', sql.DATE, toServerDate(dataAdmissao))
      .input('ExibirIdade', sql.BIT, exibirIdade ? 1 : 0)
      .query(`INSERT INTO BI_Colaboradores (Nome, Email, CargoId, AreaId, NivelHierarquia, GestorId, Tp_contrato, Color, AvatarUrl, DataNascimento, DataAdmissao, ExibirIdade, Ativo)
              OUTPUT Inserted.Id VALUES (@Nome, @Email, @CargoId, @AreaId, @Nivel, @GestorId, @Contrato, @Color, @Avatar, @DataNascimento, @DataAdmissao, @ExibirIdade, 1)`);
    
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
    const { 
      nome, email, cargoId, areaId, nivelHierarquia, gestorId, tp_contrato, color, avatarUrl, 
      dataNascimento, dataAdmissao, exibirIdade, ativo,
      resumoProfissional, timelineRealizacoes, formacoes, meritosPromocoes
    } = req.body;

    // 1. Buscar registro atual para merge (evitar perda de dados em updates parciais)
    const currentResult = await pool.request()
      .input('Id', sql.INT, id)
      .query('SELECT * FROM BI_Colaboradores WHERE Id = @Id');
    
    const colab = currentResult.recordset[0];
    if (!colab) return res.status(404).json({ error: 'Colaborador não encontrado' });

    // 2. Verificação de Permissão
    const isSelf = String(req.user.colaboradorId) === String(id);
    const isAdmin = req.user.isAdmin === true;
    const isManager = colab && String(colab.GestorId) === String(req.user.colaboradorId);

    if (!isAdmin && !isSelf && !isManager) {
      return res.status(403).json({ error: 'Acesso negado: você não tem permissão para editar este perfil.' });
    }
    
    // 3. Preparação de Dados
    console.log(`📝 Processando atualização do colaborador ${id}...`);

    await transaction.begin();
    const request = new sql.Request(transaction);
    
    // Parâmetros base (sempre presentes ou fallback para o atual)
    request.input('Id', sql.INT, id);
    
    // Função auxiliar para garantir que valores grandes sejam tratados como NVarChar(MAX) pelo driver
    const addLargeInput = (req, name, value, fallback) => {
      const finalValue = value !== undefined ? value : fallback;
      // Para o driver mssql/tedious, usar sql.NVarChar sem tamanho para valores grandes costuma ativar o auto-detect correto
      req.input(name, sql.NVarChar, finalValue || '');
    };

    addLargeInput(request, 'Avatar', avatarUrl, colab.AvatarUrl);
    request.input('ExibirIdade', sql.BIT, exibirIdade !== undefined ? (exibirIdade ? 1 : 0) : (colab.ExibirIdade ? 1 : 0));
    addLargeInput(request, 'Resumo', resumoProfissional, colab.ResumoProfissional);
    addLargeInput(request, 'Timeline', timelineRealizacoes, colab.TimelineRealizacoes);
    addLargeInput(request, 'Formacoes', formacoes, colab.Formacoes);
    addLargeInput(request, 'Meritos', meritosPromocoes, colab.MeritosPromocoes);

    if (isAdmin) {
      // Admin pode editar campos estruturais
      request.input('Nome', sql.NVarChar(100), (nome || colab.Nome || '').substring(0, 100));
      request.input('Email', sql.NVarChar(200), (email || colab.Email || '').toLowerCase().trim().substring(0, 200));
      request.input('CargoId', sql.INT, cargoId !== undefined ? cargoId : colab.CargoId);
      request.input('AreaId', sql.INT, areaId !== undefined ? areaId : colab.AreaId);
      request.input('Nivel', sql.INT, nivelHierarquia !== undefined ? nivelHierarquia : colab.NivelHierarquia);
      request.input('GestorId', sql.INT, gestorId !== undefined ? gestorId : colab.GestorId);
      request.input('Contrato', sql.NVarChar(20), (tp_contrato || colab.Tp_contrato || '').substring(0, 20));
      request.input('Color', sql.NVarChar(20), (color || colab.Color || '').substring(0, 20));
      request.input('DataNasc', sql.DATE, dataNascimento ? toServerDate(dataNascimento) : colab.DataNascimento);
      request.input('DataAdm', sql.DATE, dataAdmissao ? toServerDate(dataAdmissao) : colab.DataAdmissao);
      request.input('Ativo', sql.BIT, ativo !== undefined ? (ativo ? 1 : 0) : (colab.Ativo ? 1 : 0));

      await request.query(`UPDATE BI_Colaboradores SET 
                Nome=@Nome, Email=@Email, CargoId=@CargoId, AreaId=@AreaId, 
                NivelHierarquia=@Nivel, GestorId=@GestorId, Tp_contrato=@Contrato, Color=@Color, 
                AvatarUrl=COALESCE(@Avatar, AvatarUrl), DataNascimento=@DataNasc, DataAdmissao=@DataAdm, 
                ExibirIdade=@ExibirIdade, Ativo=@Ativo
                WHERE Id=@Id`);

      // Sync em BI_Usuarios se e-mail mudou
      if (email && email.toLowerCase() !== colab.Email?.toLowerCase()) {
        const userRequest = new sql.Request(transaction);
        await userRequest
          .input('Id', sql.INT, id)
          .input('Email', sql.NVarChar(200), email.toLowerCase().trim().substring(0, 200))
          .input('Ativo', sql.BIT, ativo !== undefined ? (ativo ? 1 : 0) : (colab.Ativo ? 1 : 0))
          .query('UPDATE BI_Usuarios SET Email=@Email, Ativo=@Ativo WHERE ColaboradorId=@Id');
      }
    } else {
      // Self ou Manager: Apenas avatar e idade na tabela principal
      await request.query(`UPDATE BI_Colaboradores SET 
                AvatarUrl=COALESCE(@Avatar, AvatarUrl), ExibirIdade=@ExibirIdade
                WHERE Id=@Id`);
    }

    // SEMPRE salva no perfil dedicado
    const profileRequest = new sql.Request(transaction);
    profileRequest.input('Id', sql.INT, id);
    profileRequest.input('Resumo', sql.NVarChar, resumoProfissional !== undefined ? resumoProfissional : (colab.ResumoProfissional || ''));
    profileRequest.input('Timeline', sql.NVarChar, timelineRealizacoes !== undefined ? timelineRealizacoes : (colab.TimelineRealizacoes || '[]'));
    profileRequest.input('Formacoes', sql.NVarChar, formacoes !== undefined ? formacoes : (colab.Formacoes || '[]'));
    profileRequest.input('Meritos', sql.NVarChar, meritosPromocoes !== undefined ? meritosPromocoes : (colab.MeritosPromocoes || '[]'));
    profileRequest.input('AvatarFull', sql.NVarChar, avatarUrl !== undefined ? avatarUrl : (colab.AvatarUrl || ''));

    await profileRequest.query(`
      IF EXISTS (SELECT 1 FROM BI_ColaboradorPerfis WHERE ColaboradorId = @Id)
        UPDATE BI_ColaboradorPerfis SET 
          ResumoProfissional=@Resumo, TimelineRealizacoes=@Timeline, 
          Formacoes=@Formacoes, MeritosPromocoes=@Meritos, AvatarFull=@AvatarFull
          WHERE ColaboradorId=@Id
      ELSE
        INSERT INTO BI_ColaboradorPerfis (ColaboradorId, ResumoProfissional, TimelineRealizacoes, Formacoes, MeritosPromocoes, AvatarFull)
        VALUES (@Id, @Resumo, @Timeline, @Formacoes, @Meritos, @AvatarFull)
    `);

    await transaction.commit();
    res.json({ success: true });
  } catch (err) { 
    if (transaction) await transaction.rollback();
    console.error('❌ Erro no update do colaborador:', err);
    res.status(500).json({ error: `Erro no banco: ${err.message}` }); 
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

exports.getAvatar = async (req, res) => {
  try {
    const { id } = req.params;
    const { full } = req.query;
    const pool = await poolPromise;
    if (!pool) return res.status(500).send('Banco indisponível');

    const query = `
      SELECT ISNULL(NULLIF(cp.AvatarFull, ''), c.AvatarUrl) as AvatarUrl, c.Nome
      FROM BI_Colaboradores c
      LEFT JOIN BI_ColaboradorPerfis cp ON c.Id = cp.ColaboradorId
      WHERE c.Id = @Id
    `;

    const result = await pool.request()
      .input('Id', sql.INT, id)
      .query(query);

    if (!result.recordset.length || !result.recordset[0].AvatarUrl) {
      const name = result.recordset[0]?.Nome || '?';
      const initial = name.charAt(0).toUpperCase();
      const placeholderSvg = `
        <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" fill="#e2e8f0" />
          <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="45" fill="#94a3b8">${initial}</text>
        </svg>
      `;
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      return res.end(placeholderSvg);
    }

    const avatarData = result.recordset[0].AvatarUrl;
    
    // Se for base64, extrair o tipo e os dados
    if (avatarData.startsWith('data:')) {
      const parts = avatarData.split(',');
      const mime = parts[0].match(/:(.*?);/)[1];
      const img = Buffer.from(parts[1], 'base64');
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': img.length,
        'Cache-Control': 'public, max-age=86400' // Cache de 1 dia
      });
      res.end(img);
    } else {
      // Se for URL externa, redirecionar
      res.redirect(avatarData);
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
};
