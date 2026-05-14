function ApprovalView({ pendingRequests, allRequests, handleApproval, currentUser, processingApprovalId, dbEmployees, authToken, fetchAll, setToast }) {
  const [localNotes, setLocalNotes] = React.useState({}); // { requestId: comment }
  const [isSavingDelegation, setIsSavingDelegation] = React.useState(false);
  
  // Helper to format date for input[type="date"] (YYYY-MM-DD)
  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  // Find the current user in the fresh database list to ensure we have the latest delegation data
  const currentEmployeeData = React.useMemo(() => {
    return (dbEmployees || []).find(e => String(e.id) === String(currentUser?.colaboradorId)) || null;
  }, [dbEmployees, currentUser]);

  // Initialize delegation state
  const [delegationState, setDelegationState] = React.useState({
    delegadoId: currentEmployeeData?.delegadoId || '',
    delegacaoInicio: formatDateForInput(currentEmployeeData?.delegacaoInicio),
    delegacaoFim: formatDateForInput(currentEmployeeData?.delegacaoFim),
    delegacaoAtiva: !!currentEmployeeData?.delegacaoAtiva
  });

  // Sync state when fresh employee data arrives (e.g. after fetchAll or page load)
  React.useEffect(() => {
    if (currentEmployeeData) {
      setDelegationState({
        delegadoId: currentEmployeeData.delegadoId || '',
        delegacaoInicio: formatDateForInput(currentEmployeeData.delegacaoInicio),
        delegacaoFim: formatDateForInput(currentEmployeeData.delegacaoFim),
        delegacaoAtiva: !!currentEmployeeData.delegacaoAtiva
      });
    }
  }, [currentEmployeeData]);

  const [historyFilters, setHistoryFilters] = React.useState({
    scope: 'all', // 'all' (hierarquia) ou 'direct' (diretos)
    status: 'all', // 'all', 'Aprovado', 'Rejeitado', 'Pendente'
    startDate: '',
    endDate: ''
  });

  const [showHistoryModal, setShowHistoryModal] = React.useState(false);

  // Regra Global: Apenas Admin ou Nível 5 (Coordenador) para cima
  const hasMinApprovalLevel = currentUser && (currentUser.isAdmin || (currentUser.nivelHierarquia && currentUser.nivelHierarquia <= 5));
  const hasSubordinates = dbEmployees && currentUser && dbEmployees.some(e => String(e.gestorId) === String(currentUser.colaboradorId));

  const saveDelegation = async () => {
    if (delegationState.delegacaoAtiva && (!delegationState.delegadoId || !delegationState.delegacaoInicio || !delegationState.delegacaoFim)) {
      setToast({ title: 'Campos incompletos', message: 'Preencha o delegado e as datas para ativar a delegação.', type: 'warning' });
      return;
    }
    
    setIsSavingDelegation(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/delegation`, {
        method: 'PUT',
        headers: apiHeaders(authToken),
        body: JSON.stringify(delegationState)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar delegação');
      
      setToast({ title: 'Sucesso', message: 'Configurações de delegação salvas.' });
      
      // Update session storage immediately
      const savedUser = JSON.parse(sessionStorage.getItem('gbi_user'));
      if (savedUser) {
        const updatedUser = { ...savedUser, ...delegationState };
        sessionStorage.setItem('gbi_user', JSON.stringify(updatedUser));
        
        // Se o fetchAll for disparado, ele deve trazer os dados novos. 
        // Mas para garantir visual imediato, mantemos o delegationState atual.
        fetchAll({ silent: true });
      }
    } catch (err) {
      setToast({ title: 'Erro', message: err.message, type: 'error' });
    } finally {
      setIsSavingDelegation(false);
    }
  };



    return (
        <div className="dashboard-grid">

      {/* Bloco de Delegação - Compacto e Discreto */}
      {hasSubordinates && (
        <section className="card delegation-config-card" style={{ 
          marginBottom: '16px', 
          borderLeft: '2px solid var(--primary)', 
          padding: '16px 20px',
          background: 'var(--surface-light)'
        }}>
          <div className="section-title" style={{ marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--title)' }}>Delegação de Aprovações</h3>
              <p style={{ fontSize: '0.78rem', opacity: 0.8 }}>Gestão de responsabilidade temporária para aprovações.</p>
            </div>
          </div>
          
          <div className="form-grid" style={{ 
            display: 'grid',
            gridTemplateColumns: '1.5fr 1fr 1fr 1fr auto', 
            gap: '12px', 
            alignItems: 'flex-end'
          }}>
            <div className="field">
              <label style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px', display: 'block' }}>Delegar para</label>
              <select 
                value={delegationState.delegadoId} 
                onChange={e => setDelegationState({...delegationState, delegadoId: e.target.value})}
                disabled={delegationState.delegacaoAtiva}
                style={{ height: '36px', fontSize: '0.8rem', padding: '0 10px', borderRadius: 'var(--radius-sm)' }}
              >
                <option value="">Selecione...</option>
                {dbEmployees.filter(e => e.ativo && e.nivelHierarquia <= 5 && String(e.id) !== String(currentUser.colaboradorId)).map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px', display: 'block' }}>Início</label>
              <input 
                type="date" 
                value={delegationState.delegacaoInicio} 
                onChange={e => setDelegationState({...delegationState, delegacaoInicio: e.target.value})}
                disabled={delegationState.delegacaoAtiva}
                style={{ height: '36px', fontSize: '0.8rem', padding: '0 8px', borderRadius: 'var(--radius-sm)' }}
              />
            </div>
            <div className="field">
              <label style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px', display: 'block' }}>Fim</label>
              <input 
                type="date" 
                value={delegationState.delegacaoFim} 
                onChange={e => setDelegationState({...delegationState, delegacaoFim: e.target.value})}
                disabled={delegationState.delegacaoAtiva}
                style={{ height: '36px', fontSize: '0.8rem', padding: '0 8px', borderRadius: 'var(--radius-sm)' }}
              />
            </div>
            <div className="field" style={{ display: 'flex', alignItems: 'center', height: '36px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                <input 
                  type="checkbox" 
                  checked={delegationState.delegacaoAtiva} 
                  onChange={e => setDelegationState({...delegationState, delegacaoAtiva: e.target.checked})}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: delegationState.delegacaoAtiva ? 'var(--primary)' : 'var(--text)' }}>
                  {delegationState.delegacaoAtiva ? 'Ativo' : 'Inativo'}
                </span>
              </label>
            </div>
            <div className="field">
              <button 
                className="btn btn-primary" 
                onClick={saveDelegation} 
                disabled={isSavingDelegation}
                style={{ height: '36px', padding: '0 16px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap' }}
              >
                {isSavingDelegation ? '...' : 'Salvar'}
              </button>
            </div>
          </div>

          <div className="alert-box" style={{ 
            marginTop: '12px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '8px 12px',
            background: 'rgba(var(--primary-rgb), 0.03)',
            borderRadius: 'var(--radius-sm)',
            border: '1px dashed rgba(var(--primary-rgb), 0.2)'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--primary)' }}>info</span>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-soft)', lineHeight: '1.2' }}>
              Delegação automática via calendário é prioritária caso não haja configuração manual.
            </div>
          </div>
        </section>
      )}

      <section className="content-grid">
        <div className="card">
          <div className="section-title">
            <div>
              <h3>Fila pendente</h3>
              <p>Pedidos pendentes com visão do impacto operacional.</p>
            </div>
          </div>

          <div className="queue-list">
            {pendingRequests.length ? pendingRequests.map((request) => {
              const absenceTypes = ['Férias integrais', 'Férias fracionadas', 'Banco de horas', 'Licença programada', 'Day-off', 'Saúde (Exames/Consultas)'];

              // 1. Sobreposições hierárquicas (regra original)
              const relatedConflicts = allRequests.filter((item) => {
                if (item.id === request.id) return false;
                if (item.status === 'Rejeitado') return false;
                if (!absenceTypes.includes(item.type)) return false;
                
                const rLevel = Number(item.employee?.nivelHierarquia);
                const fLevel = Number(request.employee?.nivelHierarquia);
                
                const isAdjacentLevel = rLevel === fLevel || rLevel === fLevel - 1 || rLevel === fLevel + 1;
                const isMyDirectManager = Number(item.employee?.id) === Number(request.employee?.gestorId);
                const isMyDirectSubordinate = Number(item.employee?.gestorId) === Number(request.employee?.id);
                
                if (!isAdjacentLevel && !isMyDirectManager && !isMyDirectSubordinate) return false;

                return rangesOverlap(item.startDate, item.endDate, request.startDate, request.endDate);
              });

              // 2. Cobertura de cargo por área: colegas com mesmo cargoId e areaId
              const requesterCargoId = request.employee?.cargoId;
              const requesterAreaId = request.employee?.areaId;
              const allColleagues = (dbEmployees || []).filter(e =>
                Number(e.id) !== Number(request.employeeId) &&
                e.ativo !== false &&
                requesterCargoId && Number(e.cargoId) === Number(requesterCargoId) &&
                requesterAreaId && Number(e.areaId) === Number(requesterAreaId)
              );
              const absentColleagues = allColleagues.filter(col =>
                allRequests.some(r =>
                  Number(r.employeeId) === Number(col.id) &&
                  r.status !== 'Rejeitado' &&
                  absenceTypes.includes(r.type) &&
                  rangesOverlap(r.startDate, r.endDate, request.startDate, request.endDate)
                )
              );

              const level = getConflictLevel(relatedConflicts, {
                allColleagues,
                absentColleagues,
                coverageEmployeeName: request.coverage || '',
                allRequests,
                requesterId: request.employeeId
              });


              return (
                <div className="queue-card glass-card" key={request.id} style={{ padding: '24px', borderRadius: 'var(--radius-lg)', marginBottom: '20px' }}>
                  <div className="queue-meta" style={{ marginBottom: '20px' }}>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{shortenName(request.employee?.name) || 'Indefinido'}</h4>
                      <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{request.type} · <strong>{formatDate(request.startDate)}</strong> até <strong>{formatDate(request.endDate)}</strong></p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--muted)', fontStyle: 'italic', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>history</span>
                        Solicitado em {request.dataCriacao ? `${new Date(request.dataCriacao).toLocaleDateString('pt-BR')} às ${new Date(request.dataCriacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).trim()}` : 'Data não disponível'}
                      </p>
                      
                      {/* Indicador de Delegação */}
                      {currentUser && !currentUser.isAdmin && Number(request.employee?.gestorId) !== Number(currentUser.colaboradorId) && (
                        <div className="delegation-badge" style={{ 
                          fontSize: '0.72rem', 
                          color: 'var(--primary)', 
                          marginTop: '6px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px',
                          background: 'rgba(var(--primary-rgb), 0.1)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          width: 'fit-content',
                          fontWeight: 600
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>swap_horiz</span>
                          Solicitação delegada por {request.employee?.gestorNome || 'seu gestor'}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className={`conflict-badge-premium ${level.toLowerCase()}`} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        borderRadius: '24px',
                        fontSize: '0.72rem',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        border: '1px solid currentColor',
                        background: (level === 'Crítico' || level === 'Alto') ? 'rgba(239, 68, 68, 0.1)' : 
                                    level === 'Médio' ? 'rgba(245, 158, 11, 0.1)' : 
                                    'rgba(16, 185, 129, 0.1)',
                        color: (level === 'Crítico' || level === 'Alto') ? '#ef4444' : 
                               level === 'Médio' ? '#f59e0b' : '#10b981',
                        boxShadow: (level === 'Crítico' || level === 'Alto') ? '0 0 15px rgba(239, 68, 68, 0.2)' : 'none',
                        transition: 'all 0.3s ease'
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                          {level === 'Crítico' ? 'report' : level === 'Alto' ? 'priority_high' : level === 'Médio' ? 'warning' : 'check_circle'}
                        </span>
                        Conflito {level}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div className="glass" style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--glass-border)' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Cobertura Planejada</label>
                      <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{request.coverage || 'Não informada'}</span>
                    </div>
                    <div className="glass" style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--glass-border)' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Duração</label>
                      <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{request.totalDays} dia(s)</span>
                    </div>
                  </div>

                  {request.note && request.note !== 'Sem observações adicionais.' && (
                    <div className="requester-note" style={{ 
                      marginBottom: '20px', 
                      padding: '12px 16px', 
                      background: 'rgba(255,255,255,0.02)', 
                      borderRadius: 'var(--radius-md)', 
                      borderLeft: '2px solid rgba(255,255,255,0.1)',
                      fontStyle: 'italic'
                    }}>
                      <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Observações do Solicitante</label>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-soft)', lineHeight: '1.5' }}>"{request.note}"</p>
                    </div>
                  )}

                  {relatedConflicts.length > 0 && (
                    <div className="mini-list glass" style={{ margin: '0 0 20px 0', padding: '16px', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)' }}>
                       <h5 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>group_off</span>
                         Sobreposições Detectadas
                       </h5>
                       {relatedConflicts.map((conflict) => (
                         <div key={conflict.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                           <span style={{ fontSize: '0.85rem' }}>{shortenName(conflict.employee?.name)}</span>
                           <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{formatDate(conflict.startDate)} - {formatDate(conflict.endDate)}</span>
                         </div>
                       ))}
                    </div>
                  )}


                  {(() => {
                      const isOwner = Number(request.employeeId) === Number(currentUser.colaboradorId);
                      const canAction = !isOwner || currentUser.isAdmin;

                      if (canAction) {
                        return (
                          <div style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Parecer do Gestor (Opcional)</label>
                            <textarea 
                              placeholder="Adicione um comentário para esta decisão..." 
                              value={localNotes[request.id] || ''} 
                              onChange={(e) => setLocalNotes({ ...localNotes, [request.id]: e.target.value })}
                              style={{ width: '100%', minHeight: '80px', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: '12px', color: 'var(--text)', fontSize: '0.85rem', outline: 'none' }}
                            />
                          </div>
                        );
                      }
                      return null;
                  })()}

                  <div className="queue-actions" style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
                    {(() => {
                      const isOwner = Number(request.employeeId) === Number(currentUser.colaboradorId);
                      const canAction = !isOwner || currentUser.isAdmin;

                      if (canAction) {
                        return (
                          <>
                            <button className="btn btn-primary" onClick={() => handleApproval(request.id, 'Aprovado', localNotes[request.id] || '')} disabled={processingApprovalId === request.id} style={{ flex: 1, height: '48px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: processingApprovalId === request.id ? 0.7 : 1 }}>
                              {processingApprovalId === request.id ? <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite' }}>autorenew</span> : 'Aprovar Agora'}
                            </button>
                            <button className="btn btn-secondary" onClick={() => handleApproval(request.id, 'Rejeitado', localNotes[request.id] || '')} disabled={processingApprovalId === request.id} style={{ height: '48px', borderRadius: 'var(--radius-md)', padding: '0 24px', opacity: processingApprovalId === request.id ? 0.7 : 1 }}>
                              Rejeitar
                            </button>
                          </>
                        );
                      }

                      return (
                        <div style={{ color: 'var(--muted)', fontSize: '.85rem', padding: '8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#f59e0b' }}>
                            person_off
                          </span>
                          <span>Sua solicitação (Aguardando aprovação do seu gestor)</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            }) : (
              <div className="empty-state">Não há solicitações pendentes no momento.</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Histórico de Decisões</h3>
              <p>Últimas 5 solicitações processadas recentemente.</p>
            </div>
            <button 
              className="btn btn-icon" 
              onClick={() => setShowHistoryModal(true)}
              style={{ background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', width: '40px', height: '40px', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }}
              title="Pesquisar no Histórico Completo"
            >
              <span className="material-symbols-outlined">search</span>
            </button>
          </div>

          <div className="history-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {allRequests
              .filter(r => r.type !== 'Escala de Trabalho' && r.type !== 'Ajuste de Escala' && r.status !== 'Pendente')
              // Hierarquia Direta ou Admin (simplificado para a tela principal)
              .filter(r => currentUser.isAdmin || (r.employee && (Number(r.employee.gestorId) === Number(currentUser.colaboradorId) || String(r.employee.gestor).includes(currentUser.name))))
              .slice(0, 5)
              .map(req => (
              <div key={req.id} className="glass-card" style={{ padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', background: 'var(--surface)', transition: 'all 0.2s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--title)' }}>{shortenName(req.employeeName)}</h5>
                    <p style={{ margin: '4px 0 2px', fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 500 }}>{req.type} · {formatDate(req.startDate)}</p>
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontStyle: 'italic', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>history</span>
                        Solicitado em {req.dataCriacao ? `${new Date(req.dataCriacao).toLocaleDateString('pt-BR')} às ${new Date(req.dataCriacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).trim()}` : 'Data não disponível'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: req.status === 'Aprovado' ? '#10b981' : '#ef4444' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                          {req.status === 'Aprovado' ? 'check_circle' : 'cancel'}
                        </span>
                        {(() => {
                          const statusText = req.status === 'Aprovado' ? 'Aprovado' : 'Reprovado';
                          // Regex flexível para capturar [Nome Verbo em nome de Nome]
                          const delegationMatch = req.comentarioAprovacao?.match(/\[(.*?) (?:Aprovou|Rejeitou) em nome de (.*?)\]/);
                          
                          const actionInfo = delegationMatch 
                            ? `${delegationMatch[1]} em nome de ${delegationMatch[2]}`
                            : (req.approverName || 'Gestor');
                          
                          return `${statusText} por ${actionInfo} em ${req.dataModificacao ? `${new Date(req.dataModificacao).toLocaleDateString('pt-BR')} às ${new Date(req.dataModificacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).trim()}` : '-'}`;
                        })()}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ 
                      fontSize: '0.7rem', 
                      fontWeight: 900, 
                      color: req.status === 'Aprovado' ? '#10b981' : '#ef4444',
                      background: req.status === 'Aprovado' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      padding: '6px 14px',
                      borderRadius: '16px',
                      border: '1px solid currentColor',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}>
                      {req.status}
                    </div>
                  </div>
                </div>
                {req.comentarioAprovacao && req.comentarioAprovacao.trim() !== '' && (
                  <div style={{ marginTop: '10px', padding: '10px 12px', background: 'var(--bg-soft)', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--text)', borderLeft: '3px solid var(--primary)', fontStyle: 'italic', opacity: 0.9 }}>
                    "{req.comentarioAprovacao}"
                  </div>
                )}
              </div>
            ))}
            {allRequests.filter(r => r.type !== 'Escala de Trabalho' && r.type !== 'Ajuste de Escala' && r.status !== 'Pendente').length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)', fontSize: '0.85rem' }}>Nenhuma decisão tomada recentemente.</div>
            )}
          </div>
        </div>


      </section>

      {/* History Search Modal */}
      {showHistoryModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content glass" style={{ width: '90%', maxWidth: '750px', maxHeight: '85vh', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            
            <div className="modal-header" style={{ padding: '20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '28px' }}>manage_search</span>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--title)' }}>Consulta de Histórico</h2>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>Pesquise todas as decisões tomadas</p>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setShowHistoryModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              <div className="history-filters" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px', background: 'rgba(var(--primary-rgb), 0.05)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(var(--primary-rgb), 0.1)' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Abrangência</label>
                  <select 
                    value={historyFilters.scope} 
                    onChange={e => setHistoryFilters({...historyFilters, scope: e.target.value})}
                    style={{ width: '100%', fontSize: '0.85rem', padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text)' }}
                  >
                    <option value="all">Hierarquia</option>
                    <option value="direct">Diretos</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Status</label>
                  <select 
                    value={historyFilters.status} 
                    onChange={e => setHistoryFilters({...historyFilters, status: e.target.value})}
                    style={{ width: '100%', fontSize: '0.85rem', padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text)' }}
                  >
                    <option value="all">Todos</option>
                    <option value="Aprovado">Aprovados</option>
                    <option value="Rejeitado">Rejeitados</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Data Inicial</label>
                  <input 
                    type="date" 
                    value={historyFilters.startDate} 
                    onChange={e => setHistoryFilters({...historyFilters, startDate: e.target.value})}
                    style={{ width: '100%', fontSize: '0.85rem', padding: '7px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text)' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Data Final</label>
                  <input 
                    type="date" 
                    value={historyFilters.endDate} 
                    onChange={e => setHistoryFilters({...historyFilters, endDate: e.target.value})}
                    style={{ width: '100%', fontSize: '0.85rem', padding: '7px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text)' }}
                  />
                </div>
              </div>

              <div className="history-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {allRequests
                  .filter(r => {
                    if (r.type === 'Escala de Trabalho' || r.type === 'Ajuste de Escala') return false;
                    if (historyFilters.status === 'all') {
                      if (r.status === 'Pendente') return false;
                    } else {
                      if (r.status !== historyFilters.status) return false;
                    }
                    if (historyFilters.scope === 'direct') {
                      if (Number(r.employee?.gestorId) !== Number(currentUser.colaboradorId)) return false;
                    } else if (!currentUser.isAdmin) {
                      const isSubordinate = dbEmployees.some(e => e.id === r.employeeId && (Number(e.gestorId) === Number(currentUser.colaboradorId) || String(e.gestor).includes(currentUser.name)));
                      if (!isSubordinate) return false;
                    }
                    const reqDate = new Date(r.dataCriacao || r.startDate);
                    if (historyFilters.startDate) {
                      const filterStart = new Date(historyFilters.startDate + 'T00:00:00');
                      if (reqDate < filterStart) return false;
                    }
                    if (historyFilters.endDate) {
                      const filterEnd = new Date(historyFilters.endDate + 'T23:59:59');
                      if (reqDate > filterEnd) return false;
                    }
                    return true;
                  })
                  .map(req => (
                  <div key={`modal-${req.id}`} className="glass-card" style={{ padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', background: 'var(--surface-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--title)' }}>{shortenName(req.employeeName)}</h5>
                        <p style={{ margin: '4px 0 2px', fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 500 }}>{req.type} · {formatDate(req.startDate)}</p>
                        <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontStyle: 'italic', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>history</span>
                            Solicitado em {req.dataCriacao ? `${new Date(req.dataCriacao).toLocaleDateString('pt-BR')} às ${new Date(req.dataCriacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).trim()}` : '-'}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: req.status === 'Aprovado' ? '#10b981' : '#ef4444' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                              {req.status === 'Aprovado' ? 'check_circle' : 'cancel'}
                            </span>
                            {(() => {
                              const statusText = req.status === 'Aprovado' ? 'Aprovado' : 'Reprovado';
                              const delegationMatch = req.comentarioAprovacao?.match(/\[(.*?) (?:Aprovou|Rejeitou) em nome de (.*?)\]/);
                              const actionInfo = delegationMatch ? `${delegationMatch[1]} em nome de ${delegationMatch[2]}` : (req.approverName || 'Gestor');
                              return `${statusText} por ${actionInfo} em ${req.dataModificacao ? `${new Date(req.dataModificacao).toLocaleDateString('pt-BR')} às ${new Date(req.dataModificacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).trim()}` : '-'}`;
                            })()}
                          </span>
                        </div>
                      </div>
                      <div style={{ 
                        fontSize: '0.65rem', 
                        fontWeight: 900, 
                        color: req.status === 'Aprovado' ? '#10b981' : '#ef4444',
                        background: req.status === 'Aprovado' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        padding: '4px 10px',
                        borderRadius: '16px',
                        border: '1px solid currentColor',
                        textTransform: 'uppercase'
                      }}>
                        {req.status}
                      </div>
                    </div>
                    {req.comentarioAprovacao && req.comentarioAprovacao.trim() !== '' && (
                      <div style={{ marginTop: '10px', padding: '10px 12px', background: 'var(--bg-soft)', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--text)', borderLeft: '3px solid var(--primary)', fontStyle: 'italic', opacity: 0.9 }}>
                        "{req.comentarioAprovacao}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="modal-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--line)', background: 'var(--surface-light)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowHistoryModal(false)} style={{ height: '36px', padding: '0 24px', fontSize: '0.85rem' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
