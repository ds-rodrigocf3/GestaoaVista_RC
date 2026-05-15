function RequestView({
  form,
  setForm,
  employees,
  requests,
  formEmployee,
  formConflicts,
  formConflictLevel,
  formConflictDetails,
  selectedDuration,
  submitRequest,
  currentUser,
  editingRequestId,
  setEditingRequestId,
  deleteRequest,
  setToast,
  eventos
}) {
  const [requestMonthOffset, setRequestMonthOffset] = React.useState(0);
  const [substituteAlert, setSubstituteAlert] = React.useState(null);
  const todayStr = formatDateLocal(new Date());

  const displayMonth = React.useMemo(() => {
    const baseDate = form.startDate ? new Date(form.startDate + 'T12:00:00') : new Date(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01T12:00:00`);
    baseDate.setMonth(baseDate.getMonth() + requestMonthOffset);
    return baseDate;
  }, [form.startDate, requestMonthOffset]);

  const monthDays = React.useMemo(() => getMonthMatrix(displayMonth), [displayMonth]);
  const holidays = React.useMemo(() => getBrazilianHolidays(displayMonth.getFullYear()), [displayMonth]);

  const pendingTeamMembers = React.useMemo(() => {
    if (!formEmployee) return [];
    const absenceTypes = ['Férias integrais', 'Férias fracionadas', 'Banco de horas', 'Licença programada', 'Day-off', 'Saúde (Exames/Consultas)'];
    return (requests || []).filter((request) => 
      request.employee?.team === formEmployee?.team && 
      request.status !== 'Rejeitado' &&
      absenceTypes.includes(request.type)
    );
  }, [formEmployee, requests]);

  const myRequests = React.useMemo(() => {
    if (!currentUser) return [];
    return (requests || [])
      .filter(r => Number(r.employeeId) === Number(currentUser.colaboradorId) && r.type !== 'Escala de Trabalho' && r.type !== 'Ajuste de Escala')
      .sort((a,b) => new Date(b.startDate) - new Date(a.startDate));
  }, [requests, currentUser]);

  const updateField = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      // Se alterou a data inicial e a final estiver vazia, sugere a mesma data para facilitar
      if (key === 'startDate' && !current.endDate) {
        next.endDate = value;
      }
      return next;
    });

    if (key === 'coverage' && value && form.startDate && form.endDate) {
      // Definir apenas tipos que representam ausência (ignorar Escala Mensal)
      const absenceTypes = ['Férias integrais', 'Férias fracionadas', 'Banco de horas', 'Licença programada', 'Day-off', 'Saúde (Exames/Consultas)'];
      
      // Procurar TODOS os agendamentos do suplente que sobrepõem o período atual e são ausências
      const overlaps = (requests || [])
        .filter(r => 
          (r.employee?.name === value || r.employeeName === value) &&
          r.status !== 'Rejeitado' &&
          absenceTypes.includes(r.type) &&
          rangesOverlap(form.startDate, form.endDate, r.startDate, r.endDate)
        )
        .map(r => getOverlapDescription(form.startDate, form.endDate, r.startDate, r.endDate));
      
      if (overlaps.length > 0) {
        setSubstituteAlert({ 
          name: value,
          periods: overlaps
        });
      }
    }

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
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const safeColor = isLight ? '#06b6d4' : 'var(--primary)';
  const alertColor = isLight ? '#ea580c' : '#f59e0b';

  return (
    <div className="dashboard-grid requests-page-container" style={{ gap: '24px' }}>

      <section className="form-grid-layout requests-layout-grid" style={{ display: 'grid', gap: '24px', alignItems: 'start' }}>
        {/* Bloco de Parâmetros da Solicitação */}
        <div className="card glass-card" style={{ padding: '24px', borderRadius: 'var(--radius-lg)', background: 'var(--surface)', border: '1px solid var(--line)', height: '100%' }}>
          <div className="section-title" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: '20px' }}>person</span>
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--title)' }}>Informações do Colaborador</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Identificação do solicitante.</p>
              </div>
            </div>
          </div>

          <div className="form-grid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {currentUser?.isAdmin ? (
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px', letterSpacing: '0.05em' }}>Selecionar Colaborador (Admin)</label>
                <select 
                  className="custom-input"
                  value={form.employeeId} 
                  onChange={(e) => updateField('employeeId', e.target.value)} 
                  style={{ width: '100%', height: '42px' }}
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} · {emp.areaNome || emp.team}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', background: 'var(--bg-soft)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)' }}>
                <div className="info-item">
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>Colaborador</label>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--title)' }}>{formEmployee?.name || 'Carregando...'}</div>
                </div>
                <div className="info-item">
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>Área</label>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--title)' }}>{formEmployee?.areaNome || formEmployee?.team || '-'}</div>
                </div>
                <div className="info-item">
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>Gestor</label>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--title)' }}>{formEmployee?.manager || formEmployee?.gestorNome || '-'}</div>
                </div>
              </div>
            )}

            <div style={{ height: '1px', background: 'var(--line)', margin: '10px 0' }}></div>

            <div className="section-title" style={{ marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: '20px' }}>event_note</span>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--title)' }}>Parâmetros da Solicitação</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Preencha os detalhes do seu período de ausência.</p>
                </div>
              </div>
            </div>
            {formConflictLevel !== 'Nenhum' && (() => {
              const isCritico = formConflictLevel === 'Crítico';
              const isAlto = formConflictLevel === 'Alto';
              const icon = isCritico ? 'error' : 'warning';
              const alertClass = isCritico ? 'danger' : 'warning';
              
              return (
                <div className={`alert-box glass ${alertClass}`} style={{ padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', marginBottom: '8px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{icon}</span>
                    Atenção: Impacto {formConflictLevel} Detectado
                  </strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(formConflictDetails || []).map((detail, idx) => (
                      <div key={idx} style={{ fontSize: '0.75rem', opacity: 0.9, display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                        <span style={{ color: detail.level === 'Crítico' || detail.level === 'Alto' ? '#ef4444' : '#f59e0b', fontWeight: 900 }}>•</span>
                        <div>
                          <strong>{detail.level} ({detail.period}):</strong> {detail.name} — {detail.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px', letterSpacing: '0.05em' }}>Tipo de Ausência / Agendamento</label>
              <select 
                className="custom-input"
                value={form.type} 
                onChange={(e) => updateField('type', e.target.value)} 
                style={{ width: '100%', height: '42px' }}
              >
                <option>Férias integrais</option>
                <option>Férias fracionadas</option>
                <option>Banco de horas</option>
                <option>Licença programada</option>
                <option>Day-off</option>
                <option>Saúde (Exames/Consultas)</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', position: 'relative' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px', letterSpacing: '0.05em' }}>Data Inicial</label>
                <input type="date" className="custom-input" value={form.startDate} onChange={e => updateField('startDate', e.target.value)} style={{ width: '100%', height: '42px' }} />
              </div>
              <div className="form-group" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em' }}>Data Final</label>
                  {selectedDuration > 0 && (
                    <div style={{ 
                      fontSize: '0.65rem', 
                      fontWeight: 900, 
                      color: 'var(--primary)', 
                      background: 'rgba(51, 204, 204, 0.1)', 
                      padding: '2px 8px', 
                      borderRadius: '12px',
                      border: '1px solid rgba(51, 204, 204, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>schedule</span>
                      {selectedDuration} {selectedDuration === 1 ? 'dia' : 'dias'}
                    </div>
                  )}
                </div>
                <input type="date" className="custom-input" value={form.endDate} onChange={e => updateField('endDate', e.target.value)} style={{ width: '100%', height: '42px' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px', letterSpacing: '0.05em' }}>Suplente (Cobertura)</label>
                <select 
                  className="custom-input"
                  value={form.coverage} 
                  onChange={(e) => updateField('coverage', e.target.value)} 
                  style={{ width: '100%', height: '42px' }} 
                >
                  <option value="">Selecione quem assume...</option>
                  {employees
                    .filter(emp => Number(emp.id) !== Number(form.employeeId))
                    .map(emp => (
                      <option key={emp.id} value={emp.name}>
                        {emp.name}
                      </option>
                    ))
                  }
                </select>
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px', letterSpacing: '0.05em' }}>Área do Suplente</label>
                <div 
                  className="custom-input"
                  style={{ 
                    width: '100%', 
                    background: 'rgba(51, 204, 204, 0.05)', 
                    color: 'var(--primary)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '0 12px',
                    height: '42px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--primary)30',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    opacity: 0.9,
                    cursor: 'default'
                  }}
                >
                  {(() => {
                    const coverageEmp = employees.find(e => e.name === form.coverage);
                    return coverageEmp ? (coverageEmp.areaNome || coverageEmp.team) : 'Selecione um suplente...';
                  })()}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px', letterSpacing: '0.05em' }}>Observações e Contexto</label>
              <textarea 
                className="custom-input" 
                rows="3" 
                placeholder="Informe sobre handoff, pendências críticas..." 
                value={form.note} 
                onChange={e => updateField('note', e.target.value)}
                style={{ width: '100%', resize: 'none' }}
              ></textarea>
            </div>

            <button className="btn-primary" onClick={submitRequest} style={{ width: '100%', padding: '14px', borderRadius: 'var(--radius-md)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {editingRequestId ? 'Atualizar Agendamento' : 'Enviar para aprovação'}
            </button>
          </div>
        </div>

        {/* Bloco do Calendário de Conflitos */}
        <div className="card glass-card" style={{ padding: '24px', borderRadius: 'var(--radius-lg)', background: 'var(--panel-strong)', border: '1px solid var(--line)', minWidth: '320px' }}>
          <div className="section-title" style={{ marginBottom: '16px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(51, 204, 204, 0.1)', borderRadius: '20px', border: '1px solid rgba(51, 204, 204, 0.2)' }}>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                background: (formConflictLevel === 'Crítico' || formConflictLevel === 'Alto') ? '#ef4444' : (formConflictLevel === 'Médio' ? '#f59e0b' : '#10b981') 
              }}></div>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--title)' }}>Conflitos: {formConflictLevel}</span>
            </div>
          </div>

          <div className="calendar-mini-container">
            <div className="calendar-month-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '16px', padding: '8px', background: 'var(--bg-soft)', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)' }}>
              <button className="icon-btn-premium" onClick={() => setRequestMonthOffset(o => o - 1)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>chevron_left</span>
              </button>
              <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900, color: 'var(--title)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Outfit, sans-serif', minWidth: '130px', textAlign: 'center' }}>
                {displayMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h2>
              <button className="icon-btn-premium" onClick={() => setRequestMonthOffset(o => o + 1)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>chevron_right</span>
              </button>
            </div>

            <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px' }}>
              {weekdayLabels.map(l => (
                <div key={l} className="calendar-label" style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', textAlign: 'center', paddingBottom: '8px' }}>{l}</div>
              ))}

              {monthDays.map((day, idx) => {
                if (!day) return <div key={`e-${idx}`} style={{ aspectRatio: '1/1' }}></div>;
                
                const dateKey = formatDateLocal(day);
                const isSelected = isWithinRange(dateKey, form.startDate, form.endDate);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const isHoliday = holidays[dateKey];
                const dateToday = formatDateLocal(new Date());

                // Filtragem de Eventos (Ignorando Escala Mensal e Ausências)
                const dayEvents = (eventos || []).filter(ev => {
                  const evStart = ev.startDate || ev.DataInicio || ev.data;
                  const evEnd = ev.endDate || ev.DataFim || evStart;
                  if (!evStart) return false;
                  const type = ev.type || ev.Tipo || '';
                  if (type === 'Escala de Trabalho' || type === 'Ajuste de Escala' || type === 'Escala Mensal') return false;
                  return isWithinRange(dateKey, evStart, evEnd);
                });

                const teamBookings = (requests || []).filter(r => {
                  if (r.status === 'Rejeitado' || !isWithinRange(dateKey, r.startDate, r.endDate)) return false;
                  const absenceTypes = ['Férias integrais', 'Férias fracionadas', 'Banco de horas', 'Licença programada', 'Day-off', 'Saúde (Exames/Consultas)', 'Folga', 'Férias', 'Saúde'];
                  if (!absenceTypes.includes(r.type)) return false;
                  
                  const rEmp = r.employee || {};
                  const fEmp = formEmployee || {};
                  const rLevel = Number(rEmp.nivelHierarquia);
                  const fLevel = Number(fEmp.nivelHierarquia);
                  
                  const isAdjacentLevel = rLevel === fLevel || rLevel === fLevel - 1 || rLevel === fLevel + 1;
                  const isDirectRelation = Number(rEmp.id) === Number(fEmp.gestorId) || Number(rEmp.gestorId) === Number(fEmp.id);
                  const isSameRoleAndArea = Number(rEmp.cargoId) === Number(fEmp.cargoId) && Number(rEmp.areaId) === Number(fEmp.areaId);

                  return isAdjacentLevel || isDirectRelation || isSameRoleAndArea;
                });

                const approvedConflicts = teamBookings.filter(r => r.status === 'Aprovado');
                const pendingConflicts = teamBookings.filter(r => r.status === 'Pendente');
                const hasConflict = approvedConflicts.length > 0 || pendingConflicts.length > 0;
                const booked = teamBookings.length > 0;
                const conflictDetails = teamBookings.map(r => `${shortenName(r.employee?.name) || 'Colega'} (${r.type}${r.status === 'Pendente' ? ' - Pendente' : ''})`).join(', ');
                const eventDetails = dayEvents.map(ev => ev.titulo || ev.Titulo || ev.type).join(', ');

                return (
                  <div 
                    key={dateKey} 
                    className={`calendar-day glass ${isSelected ? 'selected' : ''} ${isWeekend ? 'weekend' : ''} ${isHoliday ? 'holiday' : ''} ${dateKey === dateToday ? 'today' : ''}`}
                    onClick={() => {
                      if (hasConflict || dayEvents.length > 0) {
                        let msg = '';
                        if (hasConflict) msg += `Agendamentos: ${conflictDetails}. `;
                        if (dayEvents.length > 0) msg += `Eventos: ${eventDetails}.`;
                        setToast({ title: 'Informações do Dia', message: msg, type: hasConflict ? 'warning' : 'info' });
                      } else if (isHoliday) {
                        setToast({ title: 'Feriado', message: holidays[dateKey] });
                      }
                    }}
                    style={{ 
                      position: 'relative',
                      aspectRatio: '1/1',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: '0.2s',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--line)',
                      background: isSelected ? 'rgba(51, 204, 204, 0.15)' : (booked ? 'rgba(245, 158, 11, 0.08)' : 'var(--card)'),
                      boxSizing: 'border-box',
                      padding: '2px'
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isSelected ? 'var(--primary)' : 'var(--title)', zIndex: 2, marginTop: dayEvents.length > 0 ? '-4px' : '0' }}>{day.getDate()}</span>
                    
                    {dayEvents.length > 0 && (
                      <div style={{ display: 'flex', gap: '2px', marginTop: '2px', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxHeight: '14px', overflow: 'hidden' }}>
                        {dayEvents.slice(0, 3).map((ev, i) => (
                          <span key={i} className="material-symbols-outlined" style={{ fontSize: '10px', color: 'var(--primary)', opacity: 0.8 }}>
                            {ev.icon || 'event'}
                          </span>
                        ))}
                        {dayEvents.length > 3 && <span style={{ fontSize: '7px', fontWeight: 800, color: 'var(--muted)' }}>+{dayEvents.length - 3}</span>}
                      </div>
                    )}

                    {(hasConflict || isHoliday) && (
                      <div style={{ 
                        position: 'absolute', 
                        top: '4px', 
                        right: '4px', 
                        width: '4.5px', 
                        height: '4.5px', 
                        borderRadius: '50%', 
                        background: approvedConflicts.length > 0 ? '#ef4444' : (pendingConflicts.length > 0 ? '#f59e0b' : 'var(--primary)'),
                        boxShadow: hasConflict ? '0 0 4px rgba(0,0,0,0.1)' : 'none'
                      }}></div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="calendar-legend" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }}></div>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Aprovado</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }}></div>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Pendente</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '3px', border: '1.5px solid var(--primary)', background: 'rgba(51, 204, 204, 0.1)' }}></div>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Sua Seleção</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="minhas-solicitacoes-anchor" className="management-section" style={{ marginTop: '12px' }}>
          <div className="card glass-card" style={{ padding: '24px', borderRadius: 'var(--radius-lg)', background: 'var(--surface)', border: '1px solid var(--line)' }}>
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
                           <td style={{ fontWeight: 600 }}>
                               <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {req.type}
                                  {req.comentarioAprovacao && req.comentarioAprovacao.trim() !== '' && (
                                     <span 
                                       className="material-symbols-outlined" 
                                       title={`Parecer do Gestor: ${req.comentarioAprovacao}`} 
                                       style={{ fontSize: '16px', color: 'var(--primary)', cursor: 'help', background: 'var(--primary)15', padding: '2px', borderRadius: '4px' }}
                                     >
                                        chat_bubble
                                     </span>
                                  )}
                               </div>
                            </td>
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

      {/* Aviso de Ciência de Conflito de Suplente (Canto Inferior Direito) */}
      {substituteAlert && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          maxWidth: '380px',
          width: 'calc(100% - 48px)',
          animation: 'slideUp 0.3s ease-out'
        }}>
          <div className="glass-card" style={{
            padding: '24px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--card)',
            border: '1px solid var(--line)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                minWidth: '44px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>warning</span>
              </div>
              
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--title)', marginBottom: '4px' }}>Suplente Indisponível</h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: '1.5' }}>
                  <strong>{substituteAlert.name}</strong> possui ausência programada:
                  <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                    {substituteAlert.periods.map((p, i) => (
                      <li key={i} style={{ marginBottom: '2px' }}><strong>{p}</strong></li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '16px', padding: '10px', background: 'var(--bg-soft)', borderRadius: '8px', border: '1px solid var(--line)' }}>
              Ao prosseguir, você assume a ciência de que haverá um gap de cobertura nesse intervalo.
            </p>

            <button 
              onClick={() => setSubstituteAlert(null)}
              className="btn btn-primary" 
              style={{ width: '100%', padding: '10px', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Estou ciente do conflito
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
