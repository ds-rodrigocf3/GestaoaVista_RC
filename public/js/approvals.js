function ApprovalView({ pendingRequests, allRequests, approvalNote, setApprovalNote, handleApproval, currentUser, processingApprovalId }) {
  // Regra Global: Apenas Admin ou Nível 5 (Coordenador) para cima
  const hasMinApprovalLevel = currentUser && (currentUser.isAdmin || (currentUser.nivelHierarquia && currentUser.nivelHierarquia <= 5));

  return (
    <div className="dashboard-grid">

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
              const relatedConflicts = allRequests.filter((item) => {
                if (item.id === request.id) return false;
                if (item.status === 'Rejeitado') return false;
                if (!absenceTypes.includes(item.type)) return false;
                if (item.employee?.team !== request.employee?.team) return false;
                return rangesOverlap(item.startDate, item.endDate, request.startDate, request.endDate);
              });
              const level = getConflictLevel(relatedConflicts);

              return (
                <div className="queue-card glass-card" key={request.id} style={{ padding: '24px', borderRadius: '20px', marginBottom: '20px' }}>
                  <div className="queue-meta" style={{ marginBottom: '20px' }}>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{request.employee?.name || 'Indefinido'}</h4>
                      <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{request.type} · <strong>{formatDate(request.startDate)}</strong> até <strong>{formatDate(request.endDate)}</strong></p>
                    </div>
                    <div>
                      <span className={`dash-micro-badge glass ${getConflictClass(level)}`} style={{ padding: '8px 16px', borderRadius: '12px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                          {level === 'Alto' ? 'error' : level === 'Médio' ? 'warning' : 'verified_user'}
                        </span>
                        Conflito {level}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div className="glass" style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--glass-border)' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Cobertura Planejada</label>
                      <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{request.coverage || 'Não informada'}</span>
                    </div>
                    <div className="glass" style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--glass-border)' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Duração</label>
                      <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{request.totalDays} dias úteis</span>
                    </div>
                  </div>

                  {relatedConflicts.length > 0 && (
                    <div className="mini-list glass" style={{ margin: '0 0 20px 0', padding: '16px', borderRadius: '12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)' }}>
                       <h5 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>group_off</span>
                         Sobreposições Detectadas
                       </h5>
                       {relatedConflicts.map((conflict) => (
                         <div key={conflict.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                           <span style={{ fontSize: '0.85rem' }}>{conflict.employee?.name}</span>
                           <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{formatDate(conflict.startDate)} - {formatDate(conflict.endDate)}</span>
                         </div>
                       ))}
                    </div>
                  )}

                  <div className="queue-actions" style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
                    {(() => {
                      const isOwner = Number(request.employeeId) === Number(currentUser.colaboradorId);
                      const isDirectManager = Number(request.employee?.gestorId) === Number(currentUser.colaboradorId);
                      const isSuperiorLevel = currentUser.nivelHierarquia < (request.employee?.nivelHierarquia || 7);
                      const hasNoManager = request.employee?.gestorId === null || !request.employee?.gestorId;
                      
                      const canAction = currentUser.isAdmin || (isOwner && hasNoManager) || (!isOwner && (isDirectManager || isSuperiorLevel));

                      if (canAction) {
                        return (
                          <>
                            <button className="btn btn-primary" onClick={() => handleApproval(request.id, 'Aprovado')} disabled={processingApprovalId === request.id} style={{ flex: 1, height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: processingApprovalId === request.id ? 0.7 : 1 }}>
                              {processingApprovalId === request.id ? <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite' }}>autorenew</span> : 'Aprovar Agora'}
                            </button>
                            <button className="btn btn-secondary" onClick={() => handleApproval(request.id, 'Rejeitado')} disabled={processingApprovalId === request.id} style={{ height: '48px', borderRadius: '12px', padding: '0 24px', opacity: processingApprovalId === request.id ? 0.7 : 1 }}>
                              Rejeitar
                            </button>
                          </>
                        );
                      }

                      return (
                        <div style={{ color: 'var(--muted)', fontSize: '.85rem', padding: '8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#f59e0b' }}>
                            {isOwner ? 'person_off' : 'lock'}
                          </span>
                          <span>
                            {isOwner 
                              ? 'Sua solicitação (apenas consulta)' 
                              : 'Sem permissão para este nível hierárquico'}
                          </span>
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
          <div className="section-title">
            <div>
              <h3>Parecer do gestor</h3>
              <p>Mensagem única aplicada na próxima decisão tomada.</p>
            </div>
          </div>

          <div className="field">
            <label>Comentário para aprovação ou rejeição</label>
            <textarea
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              placeholder="Ex.: aprovado com cobertura validada, ou rejeitado por conflito em entrega crítica."
            />
          </div>

          <div className="mini-list">
            <div className="mini-item">
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined icon-blue" style={{ fontSize: '16px' }}>checklist</span>
                Critérios sugeridos
              </h4>
              <p>Considere capacidade do time, janelas de entrega, cobertura definida e sobreposição com funções críticas.</p>
            </div>
            <div className="mini-item">
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined icon-orange" style={{ fontSize: '16px' }}>sort</span>
                Ordem recomendada
              </h4>
              <p>Priorize primeiro os pedidos com conflito alto, depois médio e por fim os sem sobreposição.</p>
            </div>
            <div className="mini-item">
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined icon-teal" style={{ fontSize: '16px' }}>history</span>
                Rastro de decisão
              </h4>
              <p>O comentário fica incorporado à observação do pedido para facilitar auditoria e histórico.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
