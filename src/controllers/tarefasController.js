const { poolPromise, sql } = require('../config/database');
const { formatDateYYYYMMDD } = require('../utils/dateFormatters');

exports.getAll = async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request().query(`
      SELECT t.Id, t.DemandaId, t.Titulo, t.Descricao, t.ResponsavelId, 
             t.Status, t.Prioridade, t.Inicio, t.Final, t.DataCriacao, t.Ativo,
             c.Nome as ResponsavelNome
      FROM Tarefas t
      LEFT JOIN BI_Colaboradores c ON t.ResponsavelId = c.Id
      WHERE t.Ativo = 1
      ORDER BY t.DataCriacao DESC
    `);
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
    const { titulo, descricao, responsavelId, status, prioridade, inicio, final, demandaId, statusAnterior, registrarHistorico, comentarioStatus } = req.body;
    const pool = await poolPromise;
    
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
      .query(`UPDATE Tarefas SET DemandaId=@DemandaId, Titulo=@Titulo, Descricao=@Descricao, 
              ResponsavelId=@ResponsavelId, Status=@Status, Prioridade=@Prioridade, 
              Inicio=@Inicio, Final=@Final, DataModificacao=GETDATE() WHERE Id=@Id`);

    // Log History if status changed
    if (registrarHistorico || (statusAnterior && statusAnterior !== status)) {
      await pool.request()
        .input('Tipo', sql.NVARCHAR(20), 'Tarefa')
        .input('EntidadeId', sql.INT, id)
        .input('StatusAnt', sql.NVARCHAR(50), statusAnterior || null)
        .input('StatusNovo', sql.NVARCHAR(50), status)
        .input('Comentario', sql.NVARCHAR(1000), comentarioStatus || 'Transição de status')
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
    await pool.request()
      .input('Id', sql.INT, id)
      .query('UPDATE Tarefas SET Ativo = 0 WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
