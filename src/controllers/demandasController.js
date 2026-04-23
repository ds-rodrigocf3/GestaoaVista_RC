const { poolPromise, sql } = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: 'Banco indisponível' });
    const result = await pool.request().query(`
      SELECT d.Id, d.Titulo, d.Descricao, d.ResponsavelId, d.Status, d.Prioridade, 
             d.InicioPlanjado, d.FimPlanejado, d.InicioRealizado, d.FimRealizado,
             d.ComentarioStatus, d.DataCriacao, d.DataModificacao, c.Nome as ResponsavelNome,
             (SELECT COUNT(*) FROM Tarefas WHERE DemandaId = d.Id AND Ativo = 1) as TotalTarefas,
             (SELECT COUNT(*) FROM Tarefas WHERE DemandaId = d.Id AND Status = 'Concluído' AND Ativo = 1) as TarefasConcluidas
      FROM Demandas d
      LEFT JOIN BI_Colaboradores c ON d.ResponsavelId = c.Id
      ORDER BY d.DataModificacao DESC
    `);
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
      totalTarefas: d.TotalTarefas,
      tarefasConcluidas: d.TarefasConcluidas
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
      .query(`INSERT INTO Demandas (Titulo, Descricao, ResponsavelId, Status, Prioridade, InicioPlanjado, FimPlanejado, DataCriacao, DataModificacao)
              OUTPUT Inserted.Id VALUES (@Titulo, @Descricao, @ResponsavelId, @Status, @Prioridade, @InicioPlanjado, @FimPlanejado, GETDATE(), GETDATE())`);
    res.json({ 
      id: result.recordset[0].Id, 
      titulo, 
      descricao, 
      responsavelId, 
      status, 
      prioridade, 
      inicioPlanjado: inicioPlanjado ? new Date(inicioPlanjado).toISOString().slice(0, 10) : null, 
      fimPlanejado: fimPlanejado ? new Date(fimPlanejado).toISOString().slice(0, 10) : null,
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
              ComentarioStatus=@ComentarioStatus, DataModificacao=GETDATE() WHERE Id=@Id`);

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
    await pool.request()
      .input('Id', sql.INT, id)
      .query('DELETE FROM Tarefas WHERE DemandaId = @Id');
    await pool.request()
      .input('Id', sql.INT, id)
      .query('DELETE FROM Demandas WHERE Id = @Id');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
