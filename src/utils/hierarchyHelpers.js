const { sql } = require('../config/database');

async function canApproveFor(pool, user, targetEmpId) {
  if (user.isAdmin) return true;
  
  try {
    const userResult = await pool.request()
      .input('Id', sql.INT, user.colaboradorId)
      .query('SELECT NivelHierarquia, GestorId FROM BI_Colaboradores WHERE Id = @Id');
    
    if (userResult.recordset.length === 0) return false;
    const userData = userResult.recordset[0];

    const targetResult = await pool.request()
      .input('Id', sql.INT, targetEmpId)
      .query('SELECT NivelHierarquia, GestorId FROM BI_Colaboradores WHERE Id = @Id');
    
    if (targetResult.recordset.length === 0) return false;
    const targetData = targetResult.recordset[0];

    const isSelf = Number(user.colaboradorId) === Number(targetEmpId);

    // Regra de Exceção: Se o colaborador não tem gestor (topo da hierarquia), ele pode aprovar a própria solicitação
    if (isSelf && targetData.GestorId === null) return true;

    // Regra Geral: Não pode aprovar para si próprio se tiver gestor
    if (isSelf) return false;

    // Regra 1: Superior Direto (mesmo que horizontal)
    if (Number(user.colaboradorId) === Number(targetData.GestorId)) return true;

    // Regra de Delegação: O usuário logado é o delegado ativo do gestor da pessoa?
    if (targetData.GestorId) {
      const gestorResult = await pool.request()
        .input('GestorId', sql.INT, targetData.GestorId)
        .query('SELECT DelegadoId, DelegacaoInicio, DelegacaoFim, DelegacaoAtiva FROM BI_Colaboradores WHERE Id = @GestorId');
      
      if (gestorResult.recordset.length > 0) {
        const gData = gestorResult.recordset[0];
        if (gData.DelegacaoAtiva && Number(gData.DelegadoId) === Number(user.colaboradorId)) {
          const now = new Date();
          const start = gData.DelegacaoInicio ? new Date(gData.DelegacaoInicio) : null;
          const end = gData.DelegacaoFim ? new Date(gData.DelegacaoFim) : null;
          
          if (start && end) {
            // Ajustar o fim para o final do dia
            end.setHours(23, 59, 59, 999);
            start.setHours(0, 0, 0, 0);
            if (now >= start && now <= end) {
              return true; // Delegação válida e dentro do prazo
            }
          } else if (!start && !end) {
            return true; // Delegação válida sem restrição de datas (fallback)
          }
        }
      }
    }

    // Regra 2: Superior Hierárquico (Nível menor = Hierarquia maior)
    if (userData.NivelHierarquia && targetData.NivelHierarquia && userData.NivelHierarquia < targetData.NivelHierarquia) {
      return true;
    }

    return false;
  } catch (err) {
    console.error('Error in canApproveFor:', err);
    return false;
  }
}

module.exports = { canApproveFor };
