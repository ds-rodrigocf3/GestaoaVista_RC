const { poolPromise, sql } = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const isAdmin = req.user.isAdmin;
    const colabId = req.user.colaboradorId;

    let query = '';

    if (isAdmin) {
      query = `
        SELECT d.Id, d.Titulo, d.Descricao, d.ResponsavelId, d.Status, d.Prioridade, 
               d.InicioPlanjado, d.FimPlanejado, d.InicioRealizado, d.FimRealizado,
               d.ComentarioStatus, d.DataCriacao, d.DataModificacao, d.CriadoPor, c.Nome as ResponsavelNome,
               (SELECT COUNT(*) FROM Tarefas WHERE DemandaId = d.Id AND Ativo = 1) as TotalTarefas,
               (SELECT COUNT(*) FROM Tarefas WHERE DemandaId = d.Id AND Status = 'Concluído' AND Ativo = 1) as TarefasConcluidas
        FROM Demandas d
        LEFT JOIN BI_Colaboradores c ON d.ResponsavelId = c.Id
        ORDER BY d.DataModificacao DESC
      `;
    } else {
      query = `
        WITH HierarquiaCTE AS (
            SELECT Id, AreaId FROM BI_Colaboradores WHERE Id = @ColabId
            UNION ALL
            SELECT c.Id, c.AreaId FROM BI_Colaboradores c
            INNER JOIN HierarquiaCTE h ON c.GestorId = h.Id
        )
        SELECT d.Id, d.Titulo, d.Descricao, d.ResponsavelId, d.Status, d.Prioridade, 
               d.InicioPlanjado, d.FimPlanejado, d.InicioRealizado, d.FimRealizado,
               d.ComentarioStatus, d.DataCriacao, d.DataModificacao, d.CriadoPor, c.Nome as ResponsavelNome,
               (SELECT COUNT(*) FROM Tarefas WHERE DemandaId = d.Id AND Ativo = 1) as TotalTarefas,
               (SELECT COUNT(*) FROM Tarefas WHERE DemandaId = d.Id AND Status = 'Concluído' AND Ativo = 1) as TarefasConcluidas
        FROM Demandas d
        LEFT JOIN BI_Colaboradores c ON d.ResponsavelId = c.Id
        WHERE d.ResponsavelId IS NULL 
           OR c.AreaId IN (SELECT DISTINCT AreaId FROM HierarquiaCTE WHERE AreaId IS NOT NULL)
           OR d.ResponsavelId IN (SELECT Id FROM HierarquiaCTE)
        ORDER BY d.DataModificacao DESC
      `;
    }

    const result = await pool.request()
      .input('ColabId', sql.INT, colabId || null)
      .query(query);
    res.json(result.recordset.map(d => ({
      id: d.Id,
      titulo: d.Titulo,
      descricao: d.Descricao,
      responsavelId: d.ResponsavelId,
      responsavelNome: d.ResponsavelNome,
      status: d.Status,
      prioridade: d.Prioridade,
      inicioPlanjado: d.InicioPlanjado ? new Date(d.InicioPlanjado).toISOString().slice(0, 10) : null,
      fimPlanejado: d.FimPlanejado ? new Date(d.FimPlanejado).toISOString().slice(0, 10) : null,
      comentarioStatus: d.ComentarioStatus,
      dataCriacao: d.DataCriacao,
      dataModificacao: d.DataModificacao,
      criadorId: d.CriadoPor,
      totalTarefas: d.TotalTarefas,
      tarefasConcluidas: d.TarefasConcluidas,
      fimRealizado: d.FimRealizado ? new Date(d.FimRealizado).toISOString().slice(0, 10) : null
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
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
      .input('CriadoPor', sql.INT, req.user.colaboradorId || null)
      .query(`INSERT INTO Demandas (Titulo, Descricao, ResponsavelId, Status, Prioridade, InicioPlanjado, FimPlanejado, CriadoPor, DataCriacao, DataModificacao)
              OUTPUT Inserted.Id VALUES (@Titulo, @Descricao, @ResponsavelId, @Status, @Prioridade, @InicioPlanjado, @FimPlanejado, @CriadoPor, GETDATE(), GETDATE())`);
    res.json({ 
      id: result.recordset[0].Id, 
      titulo, 
      descricao, 
      responsavelId, 
      status, 
      prioridade, 
      inicioPlanjado: inicioPlanjado ? new Date(inicioPlanjado).toISOString().slice(0, 10) : null, 
      fimPlanejado: fimPlanejado ? new Date(fimPlanejado).toISOString().slice(0, 10) : null,
      criadorId: req.user.colaboradorId,
      totalTarefas: 0,
      tarefasConcluidas: 0
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descricao, responsavelId, status, prioridade, inicioPlanjado, fimPlanejado, comentarioStatus, statusAnterior, registrarHistorico } = req.body;
    const pool = await poolPromise;

    // Verificar permissão
    const checkRes = await pool.request().input('Id', sql.INT, id).query('SELECT CriadoPor FROM Demandas WHERE Id = @Id');
    const demanda = checkRes.recordset[0];
    if (!demanda) return res.status(404).json({ error: 'Demanda não encontrada' });
    
    if (!req.user.isAdmin && demanda.CriadoPor && String(demanda.CriadoPor) !== String(req.user.colaboradorId)) {
      return res.status(403).json({ error: 'Você não tem permissão para editar esta demanda. Somente o criador ou um administrador podem editá-la.' });
    }
    
    // Update Demanda
    await pool.request()
      .input('Id', sql.INT, id)
      .input('Titulo', sql.NVARCHAR(200), titulo)
      .input('Descricao', sql.NVARCHAR(sql.MAX), descricao || null)
      .input('ResponsavelId', sql.INT, responsavelId)
      .input('Status', sql.NVARCHAR(50), status)
      .input('Prioridade', sql.NVARCHAR(50), prioridade)
      .input('InicioPlanjado', sql.DATE, inicioPlanjado || null)
      .input('FimPlanejado', sql.DATE, fimPlanejado || null)
      .input('ComentarioStatus', sql.NVARCHAR(1000), comentarioStatus || null)
      .query(`UPDATE Demandas SET Titulo=@Titulo, Descricao=@Descricao, ResponsavelId=@ResponsavelId, 
              Status=@Status, Prioridade=@Prioridade, InicioPlanjado=@InicioPlanjado, FimPlanejado=@FimPlanejado, 
              ComentarioStatus=@ComentarioStatus, 
              FimRealizado = CASE WHEN @Status = 'Concluído' AND FimRealizado IS NULL THEN GETDATE() 
                                  WHEN @Status <> 'Concluído' THEN NULL 
                                  ELSE FimRealizado END,
              DataModificacao=GETDATE() WHERE Id=@Id`);

    // Log History if status changed or explicitly requested
    if (registrarHistorico || (statusAnterior && statusAnterior !== status)) {
      await pool.request()
        .input('Tipo', sql.NVARCHAR(20), 'Demanda')
        .input('EntidadeId', sql.INT, id)
        .input('StatusAnt', sql.NVARCHAR(50), statusAnterior || null)
        .input('StatusNovo', sql.NVARCHAR(50), status)
        .input('Comentario', sql.NVARCHAR(1000), comentarioStatus || 'Alteração manual')
        .input('UserId', sql.INT, req.user.userId)
        .query(`INSERT INTO StatusHistorico (TipoEntidade, EntidadeId, StatusAnterior, StatusNovo, Comentario, UsuarioId, DataInicio)
                VALUES (@Tipo, @EntidadeId, @StatusAnt, @StatusNovo, @Comentario, @UserId, GETDATE())`);
    }

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });

    // Verificar permissão
    const checkRes = await pool.request().input('Id', sql.INT, id).query('SELECT CriadoPor FROM Demandas WHERE Id = @Id');
    const demanda = checkRes.recordset[0];
    if (!demanda) return res.status(404).json({ error: 'Demanda não encontrada' });
    
    if (!req.user.isAdmin && demanda.CriadoPor && String(demanda.CriadoPor) !== String(req.user.colaboradorId)) {
      return res.status(403).json({ error: 'Você não tem permissão para excluir esta demanda. Somente o criador ou um administrador podem excluí-la.' });
    }
    await pool.request()
      .input('Id', sql.INT, id)
      .query('DELETE FROM Tarefas WHERE DemandaId = @Id');
    await pool.request()
      .input('Id', sql.INT, id)
      .query('DELETE FROM Demandas WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
