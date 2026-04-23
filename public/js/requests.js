function RequestView({
  form,
  setForm,
  employees,
  requests,
  formEmployee,
  formConflicts,
  formConflictLevel,
  selectedDuration,
  submitRequest,
  currentUser,
  editingRequestId,
  setEditingRequestId,
  deleteRequest
}) {
  const [requestMonthOffset, setRequestMonthOffset] = useState(0);

  const displayMonth = useMemo(() => {
    const baseDate = form.startDate ? new Date(form.startDate + 'T12:00:00') : new Date(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01T12:00:00`);
    baseDate.setMonth(baseDate.getMonth() + requestMonthOffset);
    return baseDate;
  }, [form.startDate, requestMonthOffset]);

  const monthDays = useMemo(() => getMonthMatrix(displayMonth), [displayMonth]);
  const holidays = useMemo(() => getBrazilianHolidays(displayMonth.getFullYear()), [displayMonth]);

  const pendingTeamMembers = useMemo(() => {
    if (!formEmployee) return [];
    return (requests || []).filter((request) => request.employee?.team === formEmployee?.team && request.status !== 'Rejeitado');
  }, [formEmployee, requests]);

  const myRequests = useMemo(() => {
    if (!currentUser) return [];
    return (requests || [])
      .filter(r => Number(r.employeeId) === Number(currentUser.colaboradorId) && r.type !== 'Escala de Trabalho' && r.type !== 'Ajuste de Escala')
      .sort((a,b) => new Date(b.startDate) - new Date(a.startDate));
  }, [requests, currentUser]);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === 'startDate') setRequestMonthOffset(0);
  };

  const startEditing = (req) => {
    setEditingRequestId(req.id);
    setForm({
      employeeId: req.employeeId,
      type: req.type,
      startDate: req.startDate,
      endDate: req.endDate,
      coverage: req.coverage || '',
      note: req.note || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingRequestId(null);
    setForm({
      employeeId: currentUser?.colaboradorId || '',
      type: 'Férias integrais',
      startDate: '',
      endDate: '',
      coverage: '',
      note: ''
    });
  };

  const weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="dashboard-grid requests-page-container" style={{ gap: '24px' }}>
      <header className="page-header">
        <div>
          <h2>{editingRequestId ? 'Editar agendamento' : 'Novo agendamento'}</h2>
          <p>Planeje ausências com inteligência de dados e visibilidade total do time.</p>
        </div>
        <div className="badge-row" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {editingRequestId && <span className="status-pill warning" style={{ cursor: 'pointer', height: 'fit-content' }} onClick={cancelEdit}>Modo Edição (Cancelar)</span>}
          <span className="dash-micro-badge glass">Visualização Unificada</span>
        </div>
      </header>

      <section className="form-grid-layout" style={{ display: 'grid', gap: '24px' }}>
        <div className="form-panel">
          <div className={`card glass-card ${editingRequestId ? 'editing-pulse' : ''}`} style={{ padding: '28px', borderRadius: '24px', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
            <div className="section-title" style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-2) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(51, 204, 204, 0.2)' }}>
                  <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: '22px' }}>event_note</span>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--title)' }}>Parâmetros da Solicitação</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 500 }}>Detalhamento total para aprovação rápida</p>
                </div>
              </div>
            </div>

            <div className="field-grid" style={{ display: 'grid', gap: '20px' }}>
              <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Colaborador</label>
                <select
                  className="modern-selector"
                  value={form.employeeId}
                  onChange={(e) => updateField('employeeId', e.target.value)}
                  disabled={!currentUser?.isAdmin}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--title)', fontWeight: 500, fontSize: '0.88rem', outline: 'none' }}
                >
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo de Ausência</label>
                <select 
                  className="modern-selector"
                  value={form.type} 
                  onChange={(e) => updateField('type', e.target.value)} 
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--title)', fontWeight: 500, fontSize: '0.88rem', outline: 'none' }}
                >
                  <option>Férias integrais</option>
                  <option>Férias fracionadas</option>
                  <option>Banco de horas</option>
                  <option>Licença programada</option>
                  <option>Day-off</option>
                  <option>Saúde (Exames/Consultas)</option>
                </select>
              </div>
              <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data Inicial</label>
                <input type="date" value={form.startDate} onChange={(e) => updateField('startDate', e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--title)', fontWeight: 500, fontSize: '0.88rem', outline: 'none' }} />
              </div>
              <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data Final</label>
                <input type="date" value={form.endDate} onChange={(e) => updateField('endDate', e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--title)', fontWeight: 500, fontSize: '0.88rem', outline: 'none' }} />
              </div>
              <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suplente (Cobertura)</label>
                <input 
                  list="coverage-employees-list"
                  value={form.coverage} 
                  onChange={(e) => updateField('coverage', e.target.value)} 
                  onFocus={(e) => { if(form.coverage) updateField('coverage', ''); }}
                  placeholder="Quem assume?" 
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--title)', fontWeight: 500, fontSize: '0.88rem', outline: 'none' }} 
                />
                <datalist id="coverage-employees-list">
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.name}>
                      {emp.areaNome || emp.team} · {emp.cargoNome || emp.cargo}
                    </option>
                  ))}
                </datalist>
              </div>
              <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Área</label>
                <input 
                  value={(() => {
                    const coverageEmp = employees.find(e => e.name === form.coverage);
                    return coverageEmp ? (coverageEmp.areaNome || coverageEmp.team) : 'Selecione um suplente';
                  })()} 
                  readOnly 
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--panel-strong)', color: 'var(--primary)', fontWeight: 600, fontSize: '0.88rem', outline: 'none', cursor: 'not-allowed', opacity: 0.9 }} 
                />
              </div>
            </div>

            <div className="field" style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Observações e Contexto</label>
              <textarea 
                value={form.note} 
                onChange={(e) => updateField('note', e.target.value)} 
                placeholder="Informe sobre handoff, pendências críticas ou links de apoio." 
                style={{ width: '100%', minHeight: '120px', padding: '16px', borderRadius: '16px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--title)', fontWeight: 500, outline: 'none' }}
              />
            </div>

            <div className="action-row" style={{ marginTop: '36px', display: 'flex', gap: '16px' }}>
              <button
                className="btn-primary"
                onClick={submitRequest}
                style={{ flex: 1 }}
              >
                {editingRequestId ? 'Atualizar Agendamento' : 'Enviar para aprovação'}
              </button>
              {editingRequestId && (
                <button className="btn-secondary" onClick={cancelEdit} style={{ height: '54px', borderRadius: '16px', padding: '0 28px', background: 'var(--panel-strong)', border: '1px solid var(--line)', color: 'var(--title)', fontWeight: 600, cursor: 'pointer' }}>
                   Cancelar
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="form-panel">
          <div className="card glass-card" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--line)' }}>
            <div className="section-title">
              <h3 style={{ fontSize: '1.05rem' }}>Análise de Impacto</h3>
            </div>

            <div className="summary-cards-row" style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
              <div className="summary-card glass" style={{ padding: '16px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(37,99,235,0.05) 100%)', border: '1px solid rgba(59,130,246,0.1)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duração Total</span>
                <p style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '4px' }}>{selectedDuration ? `${selectedDuration} dia(s)` : '---'}</p>
              </div>
              
              <div className={`alert-box glass ${formConflictLevel === 'Alto' ? 'danger' : formConflictLevel === 'Médio' ? 'warning' : 'info'}`} style={{ margin: 0, padding: '16px', borderRadius: '12px' }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    {formConflictLevel === 'Alto' ? 'error' : formConflictLevel === 'Médio' ? 'warning' : 'verified_user'}
                  </span>
                  Protocolo: {formConflictLevel === 'Nenhum' ? 'Seguro' : `Alerta ${formConflictLevel}`}
                </strong>
                <div style={{ fontSize: '0.8rem', marginTop: '4px', opacity: 0.9 }}>
                  {formConflictLevel === 'Alto' && 'Requer mediação do gestor.'}
                  {formConflictLevel === 'Médio' && 'Sugerido alinhar cobertura.'}
                  {formConflictLevel === 'Nenhum' && 'Sem conflitos operacionais.'}
                </div>
              </div>
            </div>

            <div className="calendar-mini-container" style={{ marginTop: '24px', padding: '20px', background: 'var(--panel-strong)', borderRadius: '18px', border: '1px solid var(--line)' }}>
              <div className="section-title" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--title)', textTransform: 'capitalize' }}>{displayMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                   <button className="icon-btn" onClick={() => setRequestMonthOffset(o => o - 1)} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '8px', padding: '4px' }}><span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--title)' }}>chevron_left</span></button>
                   <button className="icon-btn" onClick={() => setRequestMonthOffset(o => o + 1)} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '8px', padding: '4px' }}><span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--title)' }}>chevron_right</span></button>
                </div>
              </div>
              <div className="calendar-grid small">
                {weekdayLabels.map(l => <div key={l} className="calendar-label">{l[0]}</div>)}
                {monthDays.map((day, idx) => {
                  if (!day) return <div key={`e-${idx}`} className="calendar-day empty"></div>;
                  const dateKey = day.toISOString().slice(0, 10);
                  const isSelected = isWithinRange(dateKey, form.startDate, form.endDate);
                  const teamBookings = pendingTeamMembers.filter(r => isWithinRange(dateKey, r.startDate, r.endDate));
                  const hasConflict = teamBookings.some(r => r.employeeId !== Number(form.employeeId));
                  const booked = teamBookings.length > 0;
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isHoliday = holidays[dateKey];
                  return (
                    <div key={dateKey} className={`calendar-day mini ${isSelected ? 'selected' : ''} ${isWeekend ? 'weekend' : ''} ${isHoliday ? 'holiday' : ''} ${booked ? (hasConflict ? 'conflict' : 'booked') : ''}`}>
                      {day.getDate()}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="management-section" style={{ marginTop: '12px' }}>
          <div className="card glass-card" style={{ padding: '24px', borderRadius: '20px', background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <div className="section-title" style={{ marginBottom: '20px' }}>
               <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Minhas Solicitações</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Histórico de férias e afastamentos declarados por você.</p>
               </div>
            </div>

            <div className="requests-table-container" style={{ overflowX: 'auto' }}>
               <table className="custom-table">
                  <thead>
                      <tr>
                        <th style={{ background: 'var(--table-header-bg)', color: 'var(--title)', fontWeight: 800, fontSize: '.7rem', textTransform: 'uppercase' }}>Tipo</th>
                        <th style={{ background: 'var(--table-header-bg)', color: 'var(--title)', fontWeight: 800, fontSize: '.7rem', textTransform: 'uppercase' }}>Período</th>
                        <th style={{ background: 'var(--table-header-bg)', color: 'var(--title)', fontWeight: 800, fontSize: '.7rem', textTransform: 'uppercase' }}>Duração</th>
                        <th style={{ background: 'var(--table-header-bg)', color: 'var(--title)', fontWeight: 800, fontSize: '.7rem', textTransform: 'uppercase' }}>Status</th>
                        <th style={{ background: 'var(--table-header-bg)', color: 'var(--title)', fontWeight: 800, fontSize: '.7rem', textTransform: 'uppercase', textAlign: 'right' }}>Ações</th>
                      </tr>
                  </thead>
                  <tbody>
                     {myRequests.map(req => (
                        <tr key={req.id}>
                           <td style={{ fontWeight: 600 }}>{req.type}</td>
                           <td style={{ fontSize: '0.85rem' }}>{formatDate(req.startDate)} → {formatDate(req.endDate)}</td>
                           <td>{diffDays(req.startDate, req.endDate)} dias</td>
                           <td><span className={`status-pill ${req.status === 'Aprovado' ? 'done' : req.status === 'Rejeitado' ? 'rejected' : 'working'}`}>{req.status}</span></td>
                           <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                 {req.status === 'Pendente' && (
                                    <button className="icon-btn" onClick={() => startEditing(req)} title="Editar"><span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#60a5fa' }}>edit</span></button>
                                 )}
                                 <button className="icon-btn" onClick={() => deleteRequest(req.id)} title="Excluir"><span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#f87171' }}>delete</span></button>
                              </div>
                           </td>
                        </tr>
                     ))}
                     {myRequests.length === 0 && (
                        <tr>
                           <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>Você ainda não criou nenhuma solicitação.</td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </section>
    </div>
  );
}
