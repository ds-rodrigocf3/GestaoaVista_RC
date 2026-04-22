function DashboardView({ stats, requests, pendingRequests, rejectedRequests, timelineItems, tasks, workDays, employees, demandas, setDemandas, eventos, globalFilters, currentUser }) {

  if (!employees || employees.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px' }}>
        <div className="modern-spinner"></div>
        <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>Sincronizando dados operativos...</p>
      </div>
    );
  }
  const subordinateIds = React.useMemo(() => {
    if (!globalFilters?.gestorId) return null;
    const getSubIds = (managerId) => {
      const direct = (employees || []).filter(item => String(item.gestorId) === String(managerId));
      let all = direct.map(item => item.id);
      direct.forEach(sub => {
        all = [...all, ...getSubIds(sub.id)];
      });
      return Array.from(new Set(all));
    };
    return [parseInt(globalFilters.gestorId), ...getSubIds(globalFilters.gestorId)];
  }, [globalFilters?.gestorId, employees]);

  const isMatch = (e) => {
    if (!e) return false;
    const g = globalFilters || {};
    const colabId = g.colaboradorId ? String(g.colaboradorId) : null;
    if (colabId && String(e.id) !== colabId) return false;

    if (subordinateIds) {
      if (!subordinateIds.includes(parseInt(e.id))) return false;
    } else if (g.gestor) {
      if (e.areaNome !== g.gestor && e.manager !== g.gestor) return false;
    }

    if (g.cargo && e.teamStr !== g.cargo && e.team !== g.cargo && e.cargoNome !== g.cargo) return false;
    return true;
  };

  const filteredEmployees = React.useMemo(() => {
    if (!employees) return [];
    return employees
      .filter(e => e && e.name)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .filter(isMatch);
  }, [employees, globalFilters]);

  const empIds = React.useMemo(() => new Set(filteredEmployees.map(e => Number(e.id))), [filteredEmployees]);

  const scopedTasks = React.useMemo(() => tasks ? tasks.filter(t => t && t.ownerId && empIds.has(Number(t.ownerId))) : [], [tasks, empIds]);
  const scopedRequests = React.useMemo(() => requests ? requests.filter(r => r && r.employeeId && empIds.has(Number(r.employeeId)) && r.status !== 'Rejeitado') : [], [requests, empIds]);

  const scopedWorkDays = React.useMemo(() => {
    const obj = {};
    if (workDays) {
      Object.keys(workDays).forEach(key => {
        if (empIds.has(Number(key))) obj[key] = workDays[key];
      });
    }
    return obj;
  }, [workDays, empIds]);

  const priorityMap = {
    'Crítica': '#e2445c',
    'Alta': '#784bd1',
    'Média': '#579bfc',
    'Baixa': '#c4c4c4'
  };

  const kpis = React.useMemo(() => {
    const total = scopedTasks.length;
    const done = scopedTasks.filter(t => t.status === 'Concluído').length;
    const deliveryRate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, deliveryRate };
  }, [scopedTasks]);

  // Tabela 360 Groups
  const grupos360 = React.useMemo(() => {
    const baseTasks = (scopedTasks || []);
    const criticas = baseTasks.filter(t => t.status === 'Bloqueio' || t.status === 'Cancelado');
    const emAndamento = baseTasks.filter(t => t.status === 'Em Andamento');
    const pausadas = baseTasks.filter(t => t.status === 'Pausado');
    const backlog = baseTasks.filter(t => t.status === 'Não Iniciado');

    const attachDetails = (list) => (list || []).map(t => {
      if (!t) return null;
      const emp = (employees || []).find(e => e && e.id === Number(t.ownerId));
      const dem = (demandas || []).find(d => d && (d.Id || d.id) === t.demandaId);
      return {
        ...t,
        emp: emp || { name: 'Sem Responsável', team: 'N/A' },
        demandaNome: dem ? (dem.Titulo || dem.titulo || 'Demanda') : 'Demanda não identificada',
        corPrioridade: (priorityMap && t.priority) ? (priorityMap[t.priority] || '#c4c4c4') : '#c4c4c4'
      };
    }).filter(Boolean);

    return {
      criticas: attachDetails(criticas).sort((a, b) => new Date(a.endDate || 0) - new Date(b.endDate || 0)),
      emAndamento: attachDetails(emAndamento).sort((a, b) => new Date(a.endDate || 0) - new Date(b.endDate || 0)),
      pausadas: attachDetails(pausadas).sort((a, b) => new Date(a.endDate || 0) - new Date(b.endDate || 0)),
      backlog: attachDetails(backlog).sort((a, b) => new Date(a.endDate || 0) - new Date(b.endDate || 0))
    };
  }, [scopedTasks, employees, demandas]);

  // Grid 7 Dias (Datas)
  const proximos7Dias = React.useMemo(() => {
    const dias = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    let current = new Date(base);
    for (let i = 0; i < 7; i++) {
      dias.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dias;
  }, []);

  const getStatusDia = (empId, dateObj) => {
    if (!dateObj || isNaN(dateObj.getTime())) return { type: 'pendente', icon: 'help_outline', color: 'var(--line)', title: 'Indisponível' };
    const dStr = dateObj.toISOString().split('T')[0];
    const request = (scopedRequests || []).find(r => {
      if (!r || r.employeeId !== empId) return false;
      const type = r.type || '';
      if (type === 'Escala de Trabalho' || type === 'Banco de horas') return false;
      const s = new Date((r.startDate || '') + 'T00:00:00');
      const e = new Date((r.endDate || '') + 'T00:00:00');
      return dateObj >= s && dateObj <= e;
    });
    if (request) {
      const rt = request.type || '';
      if (rt.includes('Férias')) return { type: 'ferias', icon: 'beach_access', color: '#f59e0b', title: rt };
      if (rt.includes('Saúde')) return { type: 'saude', icon: 'medical_services', color: '#ef4444', title: rt };
      return { type: 'ausencia', icon: 'event_busy', color: '#f59e0b', title: rt };
    }
    // Prioridade 2: Escala
    const workDay = scopedWorkDays[empId] && scopedWorkDays[empId][dStr];
    if (workDay === 'Presencial') return { type: 'presencial', icon: 'check_circle', color: '#10b981', title: 'Presencial' };
    if (workDay === 'Home Office') return { type: 'homeoffice', icon: 'home', color: 'var(--muted)', title: 'Home Office' };

    const dw = dateObj.getDay();
    if (dw === 0 || dw === 6) return { type: 'fds', icon: 'weekend', color: 'var(--line)', title: 'Fim de Semana' };
    return { type: 'pendente', icon: 'help_outline', color: 'var(--line)', title: 'Não informado' };
  };

  const STATUS_COLORS = {
    'Não Iniciado': { bg: '#c4c4c4', color: '#555' },
    'Em Andamento': { bg: '#fdab3d', color: '#fff' },
    'Concluído':    { bg: '#00b461', color: '#fff' },
    'Pausado':      { bg: '#579bfc', color: '#fff' },
    'Bloqueio':     { bg: '#e2445c', color: '#fff' },
    'Cancelado':    { bg: '#94a3b8', color: '#fff' },
    'Pendente':     { bg: '#a78bfa', color: '#fff' },
    'Backlog':      { bg: '#64748b', color: '#fff' },
    'Crítico':      { bg: '#e2445c', color: '#fff' },
  };

  const EVENT_ICONS = {
    'Férias integrais': 'beach_access',
    'Férias fracionadas': 'beach_access',
    'Férias': 'beach_access',
    'Day-off': 'celebration',
    'Folga': 'celebration',
    'Saúde (Exames/Consultas)': 'medical_services',
    'Saúde': 'medical_services',
    'Reunião': 'groups',
    'Workshop': 'school',
    'Treinamento': 'menu_book',
    'Feedback': 'chat',
    'Aviso': 'priority_high',
    'Compromisso': 'event'
  };

  const workloadMap = React.useMemo(() => {
    return filteredEmployees.map(e => {
      const tarefasAtivas = scopedTasks.filter(t => t.ownerId === e.id && t.status !== 'Cancelado');
      const tarefasPendentes = tarefasAtivas.filter(t => t.status !== 'Concluído');
      const uniqueDemands = new Set(tarefasPendentes.map(t => t.demandaId).filter(id => id !== null));
      // Contagem dinâmica por status (todos os status presentes)
      const statusCount = {};
      tarefasAtivas.forEach(t => {
        if (t.status) statusCount[t.status] = (statusCount[t.status] || 0) + 1;
      });
      return {
        emp: e,
        taskCount: tarefasPendentes.length,
        demandaCount: uniqueDemands.size,
        statusCount,
      };
    }).sort((a, b) => b.taskCount - a.taskCount).slice(0, 50);
  }, [filteredEmployees, scopedTasks]);

  const timelineAusencias = React.useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    const parseDateSafe = (d) => {
      if (!d) return null;
      let dateObj = new Date(d);
      // Se falhou e for string, talvez seja formato "Apr 23 2026..."
      if (isNaN(dateObj.getTime()) && typeof d === 'string') {
        dateObj = new Date(d.replace(/-/g, '/')); 
      }
      return isNaN(dateObj.getTime()) ? null : dateObj;
    };

    const formatTime24h = (dateObj) => {
      if (!dateObj) return null;
      return dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    const formatDateBR = (dateObj) => {
      if (!dateObj) return '';
      return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // 1. Ausências (Férias, etc)
    const absences = (scopedRequests || [])
      .filter(r => r && r.status === 'Aprovado' && r.type !== 'Escala de Trabalho' && r.type !== 'Banco de horas')
      .filter(r => {
         const dEnd = r.endDateISO || r.endDate;
         return dEnd && dEnd >= todayStr;
      })
      .map(r => {
        const sIso = r.startDate;
        const eIso = r.endDate;
        const startObj = new Date(sIso + 'T12:00:00');
        const endObj = new Date(eIso + 'T12:00:00');
        const isMultiDay = sIso !== eIso;
        return {
          ...r,
          emp: (employees || []).find(e => e && e.id === Number(r.employeeId)),
          isEvent: false,
          formattedDate: formatDateBR(startObj),
          formattedEndDate: isMultiDay ? formatDateBR(endObj) : null,
          isMultiDay,
          sortDate: startObj
        };
      });

    // 2. Eventos (Reuniões, Workshops, etc)
    const events = (eventos || [])
      .filter(ev => {
         const d = parseDateSafe(ev.dataInicio || ev.DataInicio || ev.inicio);
         if (!d || d.toISOString().split('T')[0] < todayStr) return false;

         // Regras de Visibilidade (Atribuição)
         const evAreaId = ev.areaId || ev.AreaId;
         const evRespId = ev.responsavelId || ev.ResponsavelId;

         // Global (sem área e sem responsável específico) - Visível para todos
         if (!evAreaId && !evRespId) return true;
         
         // Por Área (Usuário pertence à área do evento)
         if (evAreaId && currentUser?.areaId && String(evAreaId) === String(currentUser.areaId)) return true;
         
         // Por Responsável (Usuário é o responsável direto)
         if (evRespId && currentUser?.colaboradorId && String(evRespId) === String(currentUser.colaboradorId)) return true;
         
         // Admin visualiza todos
         if (currentUser?.isAdmin) return true;

         return false;
      })
      .map(ev => {
        const startObj = parseDateSafe(ev.dataInicio || ev.DataInicio);
        const endObj = parseDateSafe(ev.dataFim || ev.DataFim);
        const isMultiDay = startObj && endObj && startObj.toISOString().split('T')[0] !== endObj.toISOString().split('T')[0];
        
        return {
          id: ev.id,
          type: ev.tipo || 'Reunião',
          startDate: formatDateBR(startObj),
          endDate: formatDateBR(endObj),
          startTime: formatTime24h(startObj),
          endTime: formatTime24h(endObj),
          title: ev.titulo || 'Sem título',
          note: ev.descricao || '',
          isEvent: true,
          areaNome: ev.areaNome,
          responsavelNome: ev.responsavelNome,
          isMultiDay,
          sortDate: startObj
        };
      });

    return [...absences, ...events]
      .sort((a, b) => (a.sortDate || 0) - (b.sortDate || 0))
      .slice(0, 20);
  }, [scopedRequests, employees, eventos, currentUser]);

  const formatDia = (d) => d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.,', '').toUpperCase();

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <header className="topbar glass" style={{ padding: '24px', borderRadius: '20px' }}>
        <div>
          <h2 className="premium-title" style={{ fontSize: '1.8rem' }}>Visão Executiva 360º</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Panorama estratégico: acompanhamento de entregas, capacidade técnica e escala tática.
          </p>
        </div>
      </header>

      <div className="dash-bento-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>
        <div className="dash-panel" style={{ gridColumn: 'span 12' }}>
          <div className="dash-header" style={{ marginBottom: '16px' }}>
            <h3><span className="material-symbols-outlined icon-orange">calendar_month</span> Agenda de Equipe (Próximas Férias e Agendas)</h3>
          </div>

          <div className="workload-list team-agenda-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {timelineAusencias.map(a => (
              <div className="workload-item glass-card" key={a.id || Math.random()} style={{ padding: '16px', border: '1px solid var(--line)', background: 'var(--card)', display: 'flex', gap: '12px', alignItems: 'center', borderRadius: '16px', transition: 'transform 0.2s ease' }}>
                {a.isEvent ? (
                  <div className="workload-avatar" style={{ background: 'var(--primary)', color: '#fff' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{EVENT_ICONS[a.type] || EVENT_ICONS['Compromisso']}</span>
                  </div>
                ) : (
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    {a.emp?.avatarUrl 
                      ? <img src={a.emp.avatarUrl} className="workload-avatar" /> 
                      : <div className="workload-avatar">{(a.emp?.name || 'A').charAt(0).toUpperCase()}</div>
                    }
                    <div style={{ 
                      position: 'absolute', bottom: '-4px', right: '-4px', 
                      background: 'var(--card)', borderRadius: '50%', padding: '2px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px solid var(--line)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '12px', color: '#f59e0b' }}>
                        {EVENT_ICONS[a.type] || EVENT_ICONS['Compromisso']}
                      </span>
                    </div>
                  </div>
                )}
                
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '.85rem', color: 'var(--title)' }}>
                    {a.isEvent ? a.title : a.emp?.name}
                  </div>
                  <div style={{ fontSize: '.72rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    {a.isEvent ? (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>groups</span>
                        {a.areaNome || 'Global'} • {a.type}
                      </>
                    ) : (
                      a.type
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <div style={{ 
                      display: 'flex', alignItems: 'center', gap: '4px', 
                      fontSize: '.72rem', fontWeight: 700, 
                      color: a.isEvent ? 'var(--primary)' : '#f59e0b', 
                      background: a.isEvent ? 'rgba(51,204,204,0.06)' : 'rgba(245,158,11,0.06)', 
                      padding: '2px 6px', borderRadius: '4px' 
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>calendar_today</span>
                      {a.isEvent 
                        ? (a.isMultiDay ? `${a.startDate} até ${a.endDate}` : a.startDate) 
                        : (a.isMultiDay ? `${a.formattedDate} até ${a.formattedEndDate}` : a.formattedDate)
                      }
                    </div>
                    {a.isEvent && (a.startTime || a.endTime) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '.72rem', color: 'var(--muted)', fontWeight: 600, borderLeft: '1px solid var(--line)', paddingLeft: '8px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>schedule</span>
                        {a.startTime || ''}{a.endTime && a.endTime !== a.startTime ? ` - ${a.endTime}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {timelineAusencias.length === 0 && <div className="empty-state" style={{ gridColumn: 'span 12', textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>Sem eventos ou ausências agendadas para o período.</div>}
          </div>
        </div>

        <div className="glass-card" style={{ gridColumn: 'span 12', padding: '28px', borderRadius: '24px' }}>
          <div className="section-title" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ color: '#fff' }}>calendar_view_week</span>
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Mapa de Escala (Próximos 7 Dias)</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Disponibilidade e localização da equipe em tempo real</p>
              </div>
            </div>
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="empty-state">Nenhum colaborador corresponde aos filtros.</div>
          ) : (
              <div className="requests-table-container glass" style={{ borderRadius: '16px', overflow: 'hidden', border: 'none', background: 'transparent', boxShadow: 'none' }}>
                <table className="custom-table" style={{ margin: 0, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--table-header-bg)', borderBottom: '2px solid var(--line)' }}>
                      <th style={{ width: '240px', color: 'var(--title)', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.75rem' }}>Colaborador</th>
                      {proximos7Dias.map((d, i) => (
                        <th key={i} style={{ textAlign: 'center', color: 'var(--title)', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.75rem' }}>{formatDia(d)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map(emp => (
                      <tr key={emp.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                             {emp.avatarUrl ? <img src={emp.avatarUrl} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid var(--line)' }} /> : <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--panel-strong)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', fontSize: '10px' }}>{emp.name.charAt(0)}</div>}
                             <span style={{ fontWeight: 600, color: 'var(--title)' }}>{emp.name}</span>
                          </div>
                        </td>
                        {proximos7Dias.map((d, i) => {
                          const st = getStatusDia(emp.id, d);
                          return (
                            <td key={i} style={{ textAlign: 'center', padding: '12px', borderLeft: '1px solid var(--line)' }}>
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <span className="material-symbols-outlined" style={{ color: st.color, fontSize: '22px' }} title={st.title}>
                                  {st.icon}
                                </span>
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          )}
        </div>

        <div className="glass-card" style={{ gridColumn: 'span 12', padding: '28px', borderRadius: '24px' }}>
          <div className="section-title" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-2) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary-txt)' }}>table_chart</span>
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Fila Operacional (Gestão 360)</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Visão dinâmica de blocos e andamento por colaborador</p>
              </div>
            </div>
            
            <div className="dash-inline-kpis" style={{ display: 'flex', gap: '12px' }}>
              <div className="dash-micro-badge glass" style={{ padding: '8px 16px', borderRadius: '12px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--muted)' }}>inventory_2</span>
                <span style={{ fontSize: '0.85rem' }}>Total: <strong>{kpis.total}</strong></span>
              </div>
              <div className="dash-micro-badge glass" style={{ padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--primary)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>task_alt</span>
                <span style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>Entrega: <strong>{kpis.deliveryRate}%</strong></span>
              </div>
            </div>
          </div>

          <div className="dash-360-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
              <div className="dash-360-col" style={{ background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '16px' }}>
                <div className="dash-360-header crit" style={{ padding: '12px', borderRadius: '10px', marginBottom: '12px' }}>
                  <span style={{ fontWeight: 700 }}>⚠️ Críticas & Bloqueios</span>
                  <span className="badge" style={{ background: '#ef4444', color: '#fff' }}>{grupos360.criticas.length}</span>
                </div>
                {grupos360.criticas.length === 0 ? <div className="empty-state" style={{ padding: '20px' }}>Tudo limpo.</div> :
                  grupos360.criticas.map(t => (
                    <div className="dash-360-card crit glass" key={'c' + t.id} style={{ borderLeft: `4px solid ${t.corPrioridade}`, padding: '12px', marginBottom: '10px', borderRadius: '12px' }}>
                      <div style={{ fontSize: '.65rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>{t.demandaNome}</div>
                      <div style={{ fontWeight: 600, fontSize: '.88rem', color: 'var(--title)', marginBottom: '8px' }}>{t.title}</div>
                      <div className="dash-360-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {t.emp?.avatarUrl ? <img src={t.emp.avatarUrl} className="dash-360-avatar" style={{ width: '20px', height: '20px' }} /> : <div className="dash-360-avatar" style={{ background: t.corPrioridade, width: '20px', height: '20px', fontSize: '10px' }}>{(t.emp?.name || 'A').charAt(0)}</div>}
                          <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{t.emp?.name?.split(' ')[0]}</span>
                        </div>
                        <span style={{ color: t.corPrioridade, fontWeight: 700, fontSize: '0.75rem' }}>{t.endDate ? t.endDate.split('-').reverse().slice(0, 2).join('/') : '-'}</span>
                      </div>
                    </div>
                  ))
                }
              </div>

            <div className="dash-360-col" style={{ background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '16px' }}>
              <div className="dash-360-header" style={{ padding: '12px', borderRadius: '10px', marginBottom: '12px', background: 'rgba(59,130,246,0.1)' }}>
                <span style={{ fontWeight: 700 }}>Em Andamento</span>
                <span className="badge" style={{ background: '#3b82f6', color: '#fff' }}>{grupos360.emAndamento.length}</span>
              </div>
              {grupos360.emAndamento.map(t => (
                <div className="dash-360-card glass" key={'a' + t.id} style={{ borderLeft: `4px solid ${t.corPrioridade}`, padding: '12px', marginBottom: '10px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '.65rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>{t.demandaNome}</div>
                  <div style={{ fontWeight: 600, fontSize: '.88rem', color: 'var(--title)', marginBottom: '8px' }}>{t.title}</div>
                  <div className="dash-360-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {t.emp?.avatarUrl ? <img src={t.emp.avatarUrl} className="dash-360-avatar" style={{ width: '20px', height: '20px' }} /> : <div className="dash-360-avatar" style={{ background: 'var(--muted)', width: '20px', height: '20px', fontSize: '10px' }}>{(t.emp?.name || 'A').charAt(0)}</div>}
                      <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{t.emp?.name?.split(' ')[0]}</span>
                    </div>
                    <span style={{ color: t.corPrioridade, fontWeight: 700, fontSize: '0.75rem' }}>{t.endDate ? t.endDate.split('-').reverse().slice(0, 2).join('/') : '-'}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="dash-360-col" style={{ background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '16px' }}>
              <div className="dash-360-header" style={{ padding: '12px', borderRadius: '10px', marginBottom: '12px' }}>
                <span style={{ fontWeight: 700 }}>Pausadas / Backlog</span>
                <span className="badge">{grupos360.pausadas.length + grupos360.backlog.length}</span>
              </div>
              {[...grupos360.pausadas, ...grupos360.backlog].map(t => (
                <div className="dash-360-card glass" key={'p' + t.id} style={{ borderLeft: `4px solid ${t.corPrioridade}`, padding: '12px', marginBottom: '10px', borderRadius: '12px', opacity: 0.8 }}>
                  <div style={{ fontWeight: 600, fontSize: '.8rem' }}>{t.title}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '4px' }}>{t.emp?.name?.split(' ')[0]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ gridColumn: 'span 12', padding: '28px', borderRadius: '24px' }}>
          <div className="section-title" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ color: '#fff' }}>hub</span>
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Carga de Trabalho & Alocação</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Balanceamento de atividades por demanda e pessoa</p>
              </div>
            </div>
          </div>

          <div className="workload-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {workloadMap.map(w => {
              if (!w || !w.emp) return null;
              return (
                <div 
                  className="glass-card workload-card-premium" 
                  key={w.emp.id} 
                  style={{ 
                    padding: '20px', 
                    borderRadius: '20px', 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: '16px', 
                    boxShadow: 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    border: '1px solid var(--line)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    {w.emp.avatarUrl
                      ? <img src={w.emp.avatarUrl} style={{ width: '52px', height: '52px', borderRadius: '14px', objectFit: 'cover', border: '2px solid var(--primary)' }} />
                      : <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-2) 100%)', color: 'var(--primary-txt)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '1.2rem' }}>{w.emp.name.charAt(0)}</div>
                    }
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--title)', marginBottom: '4px' }}>{w.emp.name}</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                         <span className="dash-micro-badge glass" style={{ fontSize: '0.7rem', padding: '4px 8px' }}>📂 {w.demandaCount} Demandas</span>
                         <span className="dash-micro-badge glass" style={{ fontSize: '0.7rem', padding: '4px 8px' }}>📝 {w.taskCount} Tarefas</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '6px', 
                    paddingTop: '12px', 
                    borderTop: '1px solid var(--line)' 
                  }}>
                     {Object.entries(w.statusCount).map(([status, count]) => (
                        <div 
                          key={status} 
                          className="status-mini-pill"
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            padding: '4px 10px', 
                            borderRadius: '20px', 
                            background: (STATUS_COLORS[status] || {bg: '#ccc'}).bg + '20', 
                            border: `1px solid ${(STATUS_COLORS[status] || {bg: '#ccc'}).bg}40`,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: (STATUS_COLORS[status] || {bg: '#ccc'}).bg
                          }}
                        >
                           <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: (STATUS_COLORS[status] || {bg: '#ccc'}).bg }}></div>
                           <span>{status}: {count}</span>
                        </div>
                     ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
