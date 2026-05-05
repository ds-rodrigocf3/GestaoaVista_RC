const { poolPromise, sql } = require('../config/database');
const { formatDateYYYYMMDD } = require('../utils/dateFormatters');

exports.getAll = async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const isAdmin = req.user.isAdmin;
    const colabId = req.user.colaboradorId;

    let query = '';

    if (isAdmin) {
      query = `
        SELECT t.Id, t.DemandaId, t.Titulo, t.Descricao, t.ResponsavelId, 
               t.Status, t.Prioridade, t.Inicio, t.Final, t.InicioRealizado, t.FimRealizado, t.DataCriacao, t.Ativo,
               c.Nome as ResponsavelNome,
               (SELECT StatusNovo as status, DataInicio as startDate, DataFim as endDate, Comentario as comment FROM StatusHistorico WHERE TipoEntidade = 'Tarefa' AND EntidadeId = t.Id ORDER BY DataInicio ASC FOR JSON PATH) as StatusHistoryJson
        FROM Tarefas t
        LEFT JOIN BI_Colaboradores c ON t.ResponsavelId = c.Id
        WHERE t.Ativo = 1
        ORDER BY t.DataCriacao DESC
      `;
    } else {
      query = `
        WITH HierarquiaCTE AS (
            SELECT Id, AreaId FROM BI_Colaboradores WHERE Id = @ColabId
            UNION ALL
            SELECT c.Id, c.AreaId FROM BI_Colaboradores c
            INNER JOIN HierarquiaCTE h ON c.GestorId = h.Id
        )
        SELECT t.Id, t.DemandaId, t.Titulo, t.Descricao, t.ResponsavelId, 
               t.Status, t.Prioridade, t.Inicio, t.Final, t.InicioRealizado, t.FimRealizado, t.DataCriacao, t.Ativo,
               c.Nome as ResponsavelNome,
               (SELECT StatusNovo as status, DataInicio as startDate, DataFim as endDate, Comentario as comment FROM StatusHistorico WHERE TipoEntidade = 'Tarefa' AND EntidadeId = t.Id ORDER BY DataInicio ASC FOR JSON PATH) as StatusHistoryJson
        FROM Tarefas t
        LEFT JOIN BI_Colaboradores c ON t.ResponsavelId = c.Id
        WHERE t.Ativo = 1 
          AND (t.ResponsavelId IS NULL 
               OR c.AreaId IN (SELECT DISTINCT AreaId FROM HierarquiaCTE WHERE AreaId IS NOT NULL)
               OR t.ResponsavelId IN (SELECT Id FROM HierarquiaCTE))
        ORDER BY t.DataCriacao DESC
      `;
    }

    const result = await pool.request()
      .input('ColabId', sql.INT, colabId || null)
      .query(query);
    res.json(result.recordset.map(t => ({
      id: t.Id,
      demandaId: t.DemandaId,
      title: t.Titulo,
      description: t.Descricao,
      ownerId: t.ResponsavelId,
      status: t.Status,
      priority: t.Prioridade,
      startDate: t.Inicio ? formatDateYYYYMMDD(t.Inicio) : '',
      endDate: t.Final ? formatDateYYYYMMDD(t.Final) : '',
      inicioRealizado: t.InicioRealizado ? formatDateYYYYMMDD(t.InicioRealizado) : null,
      fimRealizado: t.FimRealizado ? formatDateYYYYMMDD(t.FimRealizado) : null,
      statusHistory: t.StatusHistoryJson ? JSON.parse(t.StatusHistoryJson) : [],
      dataCriacao: t.DataCriacao,
      ativo: t.Ativo,
      responsavelNome: t.ResponsavelNome
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
  try {
    const { demandaId, titulo, descricao, responsavelId, status, prioridade, inicio, final } = req.body;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request()
      .input('DemandaId', sql.INT, demandaId)
      .input('Titulo', sql.NVARCHAR(300), titulo)
      .input('Descricao', sql.NVARCHAR(2000), descricao || null)
      .input('ResponsavelId', sql.INT, (responsavelId && responsavelId !== '') ? parseInt(responsavelId, 10) : null)
      .input('Status', sql.NVARCHAR(50), status || 'Pendente')
      .input('Prioridade', sql.NVARCHAR(50), prioridade || 'Média')
      .input('Inicio', sql.DATE, inicio || null)
      .input('Final', sql.DATE, final || null)
      .query(`INSERT INTO Tarefas (DemandaId, Titulo, Descricao, ResponsavelId, Status, Prioridade, Inicio, Final, DataCriacao, Ativo)
              OUTPUT Inserted.Id VALUES (@DemandaId, @Titulo, @Descricao, @ResponsavelId, @Status, @Prioridade, @Inicio, @Final, GETDATE(), 1)`);
    res.json({ 
      id: result.recordset[0].Id, 
      demandaId, 
      title: titulo, 
      description: descricao, 
      ownerId: responsavelId, 
      status, 
      priority: prioridade, 
      startDate: inicio ? formatDateYYYYMMDD(inicio) : '', 
      endDate: final ? formatDateYYYYMMDD(final) : '',
      ativo: 1
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descricao, responsavelId, status, prioridade, inicio, final, demandaId, statusAnterior, registrarHistorico, comentarioStatus, statusDate } = req.body;
    const pool = await poolPromise;
    
    // Status date definition
    const resolvedStatusDate = statusDate || new Date().toISOString();
    
    // Update Tarefa
    await pool.request()
      .input('Id', sql.INT, id)
      .input('DemandaId', sql.INT, demandaId || null)
      .input('Titulo', sql.NVARCHAR(200), titulo)
      .input('Descricao', sql.NVARCHAR(sql.MAX), descricao || null)
      .input('ResponsavelId', sql.INT, responsavelId)
      .input('Status', sql.NVARCHAR(50), status)
      .input('Prioridade', sql.NVARCHAR(50), prioridade)
      .input('Inicio', sql.DATE, inicio || null)
      .input('Final', sql.DATE, final || null)
      .input('StatusDate', sql.DATETIME, resolvedStatusDate)
      .query(`UPDATE Tarefas SET DemandaId=@DemandaId, Titulo=@Titulo, Descricao=@Descricao, 
              ResponsavelId=@ResponsavelId, Status=@Status, Prioridade=@Prioridade, 
              Inicio=@Inicio, Final=@Final, 
              InicioRealizado = CASE WHEN @Status = 'Em Andamento' AND InicioRealizado IS NULL THEN @StatusDate ELSE InicioRealizado END,
              FimRealizado = CASE WHEN @Status = 'Concluído' AND FimRealizado IS NULL THEN @StatusDate 
                                  WHEN @Status <> 'Concluído' THEN NULL 
                                  ELSE FimRealizado END,
              DataModificacao=GETDATE() WHERE Id=@Id`);

    // Log History if status changed
    if (registrarHistorico || (statusAnterior && statusAnterior !== status)) {
      // Fecha o status anterior com a data informada
      await pool.request()
        .input('Id', sql.INT, id)
        .input('StatusDate', sql.DATETIME, resolvedStatusDate)
        .query(`UPDATE StatusHistorico SET DataFim = @StatusDate
                WHERE TipoEntidade = 'Tarefa' AND EntidadeId = @Id AND DataFim IS NULL`);

      // Inicia novo status
      await pool.request()
        .input('Tipo', sql.NVARCHAR(20), 'Tarefa')
        .input('EntidadeId', sql.INT, id)
        .input('StatusAnt', sql.NVARCHAR(50), statusAnterior || null)
        .input('StatusNovo', sql.NVARCHAR(50), status)
        .input('Comentario', sql.NVARCHAR(1000), comentarioStatus || 'Transição de status')
        .input('UserId', sql.INT, req.user.userId)
        .input('StatusDate', sql.DATETIME, resolvedStatusDate)
        .query(`INSERT INTO StatusHistorico (TipoEntidade, EntidadeId, StatusAnterior, StatusNovo, Comentario, UsuarioId, DataInicio)
                VALUES (@Tipo, @EntidadeId, @StatusAnt, @StatusNovo, @Comentario, @UserId, @StatusDate)`);
    }

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    await pool.request()
      .input('Id', sql.INT, id)
      .query('UPDATE Tarefas SET Ativo = 0 WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
