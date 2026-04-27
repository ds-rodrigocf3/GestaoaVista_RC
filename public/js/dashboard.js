function DashboardView({ stats, requests, pendingRequests, rejectedRequests, timelineItems, tasks, workDays, employees, demandas, setDemandas, eventos, areas, globalFilters, currentUser, onAddTask }) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

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

  // Filters for Fila 360
  const [selectedBuckets, setSelectedBuckets] = React.useState(['criticas', 'andamento', 'backlog', 'concluidas']);
  const [periodFilter, setPeriodFilter] = React.useState('all'); // all, week, month, quarter, semester, year, custom
  const [customRange, setCustomRange] = React.useState({ start: '', end: '' });

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
  const scopedRequests = React.useMemo(() => requests ? requests.filter(r => r && r.employeeId && empIds.has(Number(r.employeeId)) && r.status === 'Aprovado') : [], [requests, empIds]);

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

  // Tabela 360 Groups (Dynamic Buckets)
  const grupos360 = React.useMemo(() => {
    let baseTasks = (scopedTasks || []);
    
    // Period Filtering
    if (periodFilter !== 'all') {
      const now = new Date();
      let startLimit, endLimit;
      
      if (periodFilter === 'week') {
        const d = now.getDay();
        startLimit = new Date(now); startLimit.setDate(now.getDate() - d);
        endLimit = new Date(now); endLimit.setDate(now.getDate() + (6 - d));
      } else if (periodFilter === 'month') {
        startLimit = new Date(now.getFullYear(), now.getMonth(), 1);
        endLimit = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else if (periodFilter === 'quarter') {
        const q = Math.floor(now.getMonth() / 3);
        startLimit = new Date(now.getFullYear(), q * 3, 1);
        endLimit = new Date(now.getFullYear(), (q + 1) * 3, 0);
      } else if (periodFilter === 'semester') {
        const s = Math.floor(now.getMonth() / 6);
        startLimit = new Date(now.getFullYear(), s * 6, 1);
        endLimit = new Date(now.getFullYear(), (s + 1) * 6, 0);
      } else if (periodFilter === 'year') {
        startLimit = new Date(now.getFullYear(), 0, 1);
        endLimit = new Date(now.getFullYear(), 12, 0);
      } else if (periodFilter === 'custom' && customRange.start && customRange.end) {
        startLimit = new Date(customRange.start);
        endLimit = new Date(customRange.end);
      }

      if (startLimit && endLimit) {
        baseTasks = baseTasks.filter(t => {
          const tStart = t.startDate ? new Date(t.startDate) : null;
          const tEnd = t.endDate ? new Date(t.endDate) : null;
          if (!tStart && !tEnd) return true; // Keep if no dates? Or exclude? User preference.
          return (tStart && tStart <= endLimit) && (tEnd && tEnd >= startLimit);
        });
      }
    }

    const bucketDefinitions = [
      { id: 'criticas', title: '⚠️ Críticas / Bloqueios', color: '#ef4444', statuses: ['Bloqueio', 'Crítica'] },
      { id: 'andamento', title: '⚡ Em Andamento', color: '#3b82f6', statuses: ['Em Andamento'] },
      { id: 'backlog', title: '⏳ Pausadas / Backlog', color: '#64748b', statuses: ['Não Iniciado', 'Pausado', 'Backlog', 'Aguardando'] },
      { id: 'concluidas', title: '✅ Concluídas', color: '#10b981', statuses: ['Concluído'] },
      { id: 'canceladas', title: '🚫 Canceladas', color: '#94a3b8', statuses: ['Cancelado'] }
    ];

    const statusWeight = { 'Bloqueio': 100, 'Crítica': 90, 'Pausado': 80, 'Aguardando': 75, 'Não Iniciado': 70, 'Backlog': 60, 'Em Andamento': 50, 'Concluído': 10, 'Cancelado': 0 };
    const priorityWeight = { 'Crítica': 4, 'Alta': 3, 'Média': 2, 'Baixa': 1 };

    const attachDetails = (list) => (list || []).map(t => {
      if (!t) return null;
      const emp = (employees || []).find(e => e && e.id === Number(t.ownerId));
      const dem = (demandas || []).find(d => d && (d.Id || d.id) === t.demandaId);
      
      let statusIcon = 'radio_button_unchecked';
      if (t.status === 'Bloqueio') statusIcon = 'block';
      if (t.status === 'Crítica') statusIcon = 'report';
      if (t.status === 'Pausado' || t.status === 'Aguardando') statusIcon = 'pause_circle';
      if (t.status === 'Em Andamento') statusIcon = 'pending';
      if (t.status === 'Concluído') statusIcon = 'check_circle';

      return {
        ...t,
        emp: emp || { name: 'Sem Responsável', team: 'N/A' },
        demandaNome: dem ? (dem.Titulo || dem.titulo || 'Demanda') : 'Demanda não identificada',
        corPrioridade: (priorityMap && t.priority) ? (priorityMap[t.priority] || '#c4c4c4') : '#c4c4c4',
        statusIcon
      };
    }).filter(Boolean);

    return bucketDefinitions
      .filter(b => selectedBuckets.includes(b.id))
      .map(b => {
        const filtered = baseTasks.filter(t => b.statuses.includes(t.status));
        const detailed = attachDetails(filtered).sort((a, b) => {
          const wa = statusWeight[a.status] || 0;
          const wb = statusWeight[b.status] || 0;
          if (wa !== wb) return wb - wa;
          const pa = priorityWeight[a.priority] || 0;
          const pb = priorityWeight[b.priority] || 0;
          if (pa !== pb) return pb - pa;
          const d1 = new Date(a.startDate || '9999-12-31');
          const d2 = new Date(b.startDate || '9999-12-31');
          return d1 - d2;
        });
        return { ...b, tasks: detailed };
      }).filter(b => b.tasks.length > 0 || selectedBuckets.includes(b.id)); // Keep selected buckets even if empty
  }, [scopedTasks, employees, demandas, selectedBuckets, periodFilter, customRange]);

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
    const dStr = formatDateLocal(dateObj);
    
    // Prioridade 1: Ausências (Férias, Saúde, etc)
    const absenceRequest = (scopedRequests || []).find(r => {
      if (!r || r.employeeId !== empId) return false;
      const type = r.type || '';
      if (type === 'Escala de Trabalho' || type === 'Banco de horas' || type === 'Ajuste de Escala') return false;
      const s = new Date((r.startDate || '') + 'T00:00:00');
      const e = new Date((r.endDate || '') + 'T00:00:00');
      return dateObj >= s && dateObj <= e;
    });

    if (absenceRequest) {
      const rt = absenceRequest.type || '';
      if (rt.includes('Férias')) return { type: 'ferias', icon: 'beach_access', color: '#f59e0b', title: rt };
      if (rt.includes('Saúde')) return { type: 'saude', icon: 'medical_services', color: '#ef4444', title: rt };
      return { type: 'ausencia', icon: 'event_busy', color: '#f59e0b', title: rt };
    }

    // Prioridade 2: Escala Aprovada
    const workDay = scopedWorkDays[empId] && scopedWorkDays[empId][dStr];
    if (workDay === 'Presencial') return { type: 'presencial', icon: 'check_circle', color: '#10b981', title: 'Presencial' };
    if (workDay === 'Home Office') return { type: 'homeoffice', icon: 'home', color: 'var(--muted)', title: 'Home Office' };


    const dw = dateObj.getDay();
    if (dw === 0 || dw === 6) return { type: 'fds', icon: 'weekend', color: 'var(--line)', title: 'Fim de Semana' };
    return { type: 'vazio', icon: 'help_outline', color: 'var(--line)', title: 'Não informado' };
  };

  const STATUS_COLORS = {
    'Não Iniciado': { bg: '#64748b', color: '#fff' }, // Modern Slate color
    'Em Andamento': { bg: '#3b82f6', color: '#fff' }, // Vibrant blue
    'Concluído':    { bg: '#10b981', color: '#fff' }, // Vibrant green
    'Pausado':      { bg: '#f59e0b', color: '#fff' }, // Amber
    'Bloqueio':     { bg: '#ef4444', color: '#fff' }, // Red
    'Cancelado':    { bg: '#94a3b8', color: '#fff' },
    'Pendente':     { bg: '#8b5cf6', color: '#fff' },
    'Backlog':      { bg: '#475569', color: '#fff' },
    'Crítico':      { bg: '#ef4444', color: '#fff' },
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
    'Compromisso': 'event',
    'Aniversário': 'celebration',
    'Evento Corporativo': 'business'
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
    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const thirtyDaysAhead = new Date(now); thirtyDaysAhead.setDate(now.getDate() + 30);
    
    const limitPastStr = formatDateLocal(yesterday);
    const limitFutureStr = formatDateLocal(thirtyDaysAhead);
    
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
    const absenceTypes = ['Férias integrais', 'Férias fracionadas', 'Day-off', 'Saúde (Exames/Consultas)', 'Licença programada', 'Folga', 'Férias', 'Saúde'];
    
    const absences = (scopedRequests || [])
      .filter(r => r && r.status === 'Aprovado' && absenceTypes.includes(r.type))
      .filter(r => {
         const dStart = r.startDate;
         const dEnd = r.endDateISO || r.endDate || dStart;
         // Show if it overlaps with [limitPast, limitFuture]
         return dStart <= limitFutureStr && dEnd >= limitPastStr;
      })
      .map(r => {
         const sIso = r.startDate;
         const eIso = r.endDate;
         
         // Safe parsing for sort and display
         const startObj = sIso ? new Date(sIso + 'T12:00:00') : new Date();
         const endObj = eIso ? new Date(eIso + 'T12:00:00') : startObj;
         const isMultiDay = sIso && eIso && sIso !== eIso;
         
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
         if (!d) return false;
         const dStr = formatDateLocal(d);
         if (dStr < limitPastStr || dStr > limitFutureStr) return false;

         // Regras de Visibilidade (Atribuição)
         const evAreaId = ev.areaId || ev.AreaId;
         const evRespId = ev.responsavelId || ev.ResponsavelId;

          // Global (Se não houver áreas específicas selecionadas, o evento é Global)
          if (!evAreaId) return true;
         
         // Por Área (Usuário pertence a uma das áreas do evento)
         const areaIds = evAreaId ? String(evAreaId).split(',').filter(x => x !== '') : [];
         if (areaIds.length > 0 && currentUser?.areaId && areaIds.includes(String(currentUser.areaId))) return true;
         
         // Por Responsável (Usuário é o responsável direto)
         if (evRespId && currentUser?.colaboradorId && String(evRespId) === String(currentUser.colaboradorId)) return true;
         
         // Admin visualiza todos
         if (currentUser?.isAdmin) return true;

         return false;
      })
      .map(ev => {
        const startObj = parseDateSafe(ev.dataInicio || ev.DataInicio);
        const endObj = parseDateSafe(ev.dataFim || ev.DataFim);
        const isMultiDay = startObj && endObj && (startObj.toLocaleDateString('pt-BR') !== endObj.toLocaleDateString('pt-BR'));
        
        const aid = ev.areaId || ev.AreaId;
        const areaInfo = (() => {
          if (!aid) return { text: 'Global', full: 'Todas as áreas', count: 0, isGlobal: true };
          const ids = String(aid).split(',').filter(x => x !== '');
          if (ids.length === 0) return { text: 'Global', full: 'Todas as áreas', count: 0, isGlobal: true };
          
          const names = ids.map(id => {
            const a = (areas || []).find(x => String(x.id) === String(id));
            return a ? a.nome : null;
          }).filter(Boolean);
          
          if (names.length === 0) return { text: 'Áreas', full: 'Áreas não identificadas', count: ids.length, isGlobal: false };
          if (names.length === 1) return { text: names[0], full: names[0], count: 1, isGlobal: false };
          return { text: `${names.length} Áreas`, full: names.join(', '), count: names.length, isGlobal: false };
        })();

        return {
          id: ev.id || ev.Id,
          type: ev.tipo || ev.Tipo || 'Reunião',
          startDate: formatDateBR(startObj),
          endDate: formatDateBR(endObj),
          startTime: formatTime24h(startObj),
          endTime: formatTime24h(endObj),
          title: ev.titulo || ev.Titulo || 'Sem título',
          note: ev.descricao || ev.Descricao || '',
          isEvent: true,
          areaId: aid,
          areaInfo,
          responsavelNome: ev.responsavelNome || ev.ResponsavelNome,
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


      <div className="dash-bento-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>
        <div className="dash-panel" style={{ gridColumn: 'span 12' }}>
          <div className="dash-header" style={{ marginBottom: '16px' }}>
            <h3><span className="material-symbols-outlined icon-orange">calendar_month</span> Agenda de Equipe (Próximas Férias e Agendas)</h3>
          </div>

          <div className="workload-list team-agenda-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {timelineAusencias.map(a => (
              <div className="workload-item glass-card" key={a.id || Math.random()}>
                {a.isEvent ? (
                  <div className="workload-avatar" style={{ 
                    background: a.type === 'Aniversário' ? 'linear-gradient(135deg, #ff3399, #ff9900)' : 'var(--primary)', 
                    color: '#fff',
                    boxShadow: a.type === 'Aniversário' ? '0 0 12px rgba(255,51,153,0.4)' : 'none',
                    border: 'none'
                  }}>
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
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px', minWidth: 0 }}>
                  <div>
                    {/* Row 1: Header (Title + Badge) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '4px' }}>
                      <div 
                        title={a.isEvent ? a.title : a.emp?.name}
                        style={{ 
                        fontWeight: 800, 
                        fontSize: '0.82rem', 
                        color: 'var(--title)', 
                        lineHeight: '1.25',
                        flex: 1,
                        wordBreak: 'break-word',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        height: '3.1rem' // Fixed height for 3 lines ensuring alignment
                      }}>
                        {a.isEvent ? a.title : a.emp?.name}
                      </div>
                      {(() => {
                        const relTime = getRelativeTime(a.sortDate, a.type);
                        if (!relTime) return null;
                        const isPastBadge = relTime === 'PASSADO';
                        const isToday = relTime === 'Hoje';
                        return (
                          <span style={{ 
                            fontSize: '0.6rem', 
                            fontWeight: 900, 
                            color: (isPastBadge) ? 'var(--muted)' : '#fff', 
                            background: isPastBadge ? 'var(--panel-strong)' : (isToday ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--primary)'), 
                            padding: '3px 10px', 
                            borderRadius: 'var(--radius-sm)', 
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            border: isPastBadge ? '1px solid var(--line)' : 'none',
                            boxShadow: isPastBadge ? 'none' : '0 4px 10px rgba(51, 204, 204, 0.15)',
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                            marginTop: '2px',
                            minWidth: '70px',
                            textAlign: 'center'
                          }}>
                            {relTime}
                          </span>
                        );
                      })()}
                    </div>
  
                    {/* Row 2: Metadata (Area/Type) */}
                    <div style={{ fontSize: '.72rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', opacity: 0.8 }}>

                  {/* Row 2: Metadata (Area/Type) */}
                  <div style={{ fontSize: '.75rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {a.isEvent ? (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px', color: a.areaInfo.isGlobal ? 'var(--muted)' : 'var(--primary)', opacity: 0.8 }}>
                          {a.areaInfo.isGlobal ? 'public' : 'category'}
                        </span>
                        <span 
                          title={a.areaInfo.full}
                          style={{ 
                            fontWeight: a.areaInfo.isGlobal ? 500 : 700,
                            color: a.areaInfo.isGlobal ? 'var(--muted)' : 'var(--primary)',
                            cursor: 'help'
                          }}
                        >
                          {a.areaInfo.text}
                        </span>
                        <span style={{ opacity: 0.4 }}>•</span>
                        <span style={{ fontWeight: 600 }}>{a.type}</span>
                      </>
                    ) : (
                      <span style={{ fontWeight: 600 }}>{a.type}</span>
                    )}
                  </div>

                    </div>
                  </div>

                  {/* Row 3: Temporal Context (Date & Time) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--line)', paddingTop: '8px', marginTop: '4px' }}>
                    <div style={{ 
                      display: 'flex', alignItems: 'center', gap: '6px', 
                      fontSize: '.72rem', fontWeight: 700, 
                      color: a.isEvent ? 'var(--primary)' : '#f59e0b', 
                      background: a.isEvent ? 'rgba(51,204,204,0.06)' : 'rgba(245,158,11,0.06)', 
                      padding: '3px 10px', borderRadius: 'var(--radius-sm)',
                      border: '1px solid transparent',
                      borderColor: a.isEvent ? 'rgba(51,204,204,0.1)' : 'rgba(245,158,11,0.1)'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>calendar_today</span>
                      {a.isEvent 
                        ? (a.isMultiDay && a.type !== 'Aniversário' ? `${a.startDate} até ${a.endDate}` : a.startDate) 
                        : (a.isMultiDay ? `${a.formattedDate} até ${a.formattedEndDate}` : a.formattedDate)
                      }
                    </div>
                    {a.isEvent && a.type !== 'Aniversário' && (a.startTime || a.endTime) && (
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


        <div className="glass-card" style={{ gridColumn: 'span 12', padding: '28px', borderRadius: 'var(--radius-xl)' }}>
          <div className="section-title" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              <div className="requests-table-container glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: 'none', background: 'transparent', boxShadow: 'none' }}>
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

        <div className="glass-card" style={{ gridColumn: 'span 12', padding: '28px', borderRadius: 'var(--radius-xl)' }}>
          <div className="section-title" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                <div className="glass-card workload-card-premium" key={w.emp.id} style={{ 
                  padding: '20px', borderRadius: 'var(--radius-lg)', 
                  display: 'flex', flexDirection: 'column', gap: '16px',
                  boxShadow: 'none', transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: '1px solid var(--line)', position: 'relative', overflow: 'hidden'
                }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    {w.emp.avatarUrl ? <img src={w.emp.avatarUrl} style={{ width: '52px', height: '52px', borderRadius: 'var(--radius-md)' }} /> : <div style={{ width: '52px', height: '52px', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-2) 100%)', color: 'var(--primary-txt)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '1.2rem' }}>{w.emp.name.charAt(0)}</div>}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--title)', marginBottom: '4px' }}>{w.emp.name}</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span className="dash-micro-badge glass" style={{ fontSize: '0.7rem', padding: '4px 8px' }}>📂 {w.demandaCount} Demandas</span>
                        <span className="dash-micro-badge glass" style={{ fontSize: '0.7rem', padding: '4px 8px' }}>📝 {w.taskCount} Tarefas</span>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '12px', borderTop: '1px solid var(--line)' }}>
                    {Object.entries(w.statusCount || {}).map(([status, count]) => {
                      if (count === 0) return null;
                      const STATUS_COLOR_MAP = {
                        'Concluído':    { color: '#10b981', label: 'Concluído' },
                        'Em Andamento': { color: '#3b82f6', label: 'Em Andamento' },
                        'Não Iniciado': { color: '#64748b', label: 'Não Iniciado' },
                        'Pausado':      { color: '#f59e0b', label: 'Pausado' },
                        'Bloqueio':     { color: '#ef4444', label: 'Bloqueio' },
                        'Cancelado':    { color: '#94a3b8', label: 'Cancelado' },
                      };
                      const config = STATUS_COLOR_MAP[status] || { color: '#64748b', label: status };
                      const color = config.color || config.bg || '#64748b';
                      const label = config.label || status;
                      return (
                        <div key={status} className="status-mini-pill" style={{ 
                          display: 'flex', alignItems: 'center', gap: '4px',
                          padding: '4px 10px', borderRadius: 'var(--radius-lg)',
                          background: `${color}20`, border: `1px solid ${color}40`,
                          fontSize: '0.7rem', fontWeight: 700, color: color
                        }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }}></div>
                          <span>{label}: {count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-card" style={{ gridColumn: 'span 12', padding: '28px', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, var(--primary) 0%, #10b981 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: '24px' }}>analytics</span>
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Fila Operacional & Performance</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Gestão 360 e indicadores de produtividade</p>
              </div>
            </div>

            {/* Embedded KPIs */}
            <div className="dash-kpi-wrapper" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <div className="dash-kpi-card" style={{ background: 'var(--panel-strong)', padding: '12px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flex: '1', minWidth: '200px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ color: '#3b82f6', fontSize: '20px' }}>inventory_2</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Total de Tarefas</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{kpis.total}</div>
                </div>
              </div>
              <div className="dash-kpi-card" style={{ background: 'var(--panel-strong)', padding: '12px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flex: '1', minWidth: '200px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', background: 'rgba(51, 204, 204, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>task_alt</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Taxa de Conclusão</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)' }}>{kpis.deliveryRate}%</div>
                </div>
              </div>
              <div className="dash-kpi-card" style={{ background: 'var(--panel-strong)', padding: '12px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flex: '1', minWidth: '200px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '20px' }}>verified</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Concluídas</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981' }}>{kpis.done}</div>
                </div>
              </div>
            </div>
          </div>

          {/* New Interactive Filters Bar */}
          <div className="dash-360-filters-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', marginBottom: '24px', padding: '12px 20px', background: 'var(--panel-strong)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>Visualizar Status</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { id: 'criticas', label: 'Críticas', color: '#ef4444' },
                  { id: 'andamento', label: 'Em Andamento', color: '#3b82f6' },
                  { id: 'backlog', label: 'Backlog', color: '#64748b' },
                  { id: 'concluidas', label: 'Concluídas', color: '#10b981' },
                  { id: 'canceladas', label: 'Canceladas', color: '#94a3b8' }
                ].map(b => (
                  <button 
                    key={b.id}
                    onClick={() => setSelectedBuckets(prev => prev.includes(b.id) ? prev.filter(x => x !== b.id) : [...prev, b.id])}
                    style={{ 
                      padding: '6px 12px', 
                      borderRadius: 'var(--radius-sm)', 
                      fontSize: '0.75rem', 
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: selectedBuckets.includes(b.id) ? b.color : 'var(--line)',
                      background: selectedBuckets.includes(b.id) ? `${b.color}15` : 'transparent',
                      color: selectedBuckets.includes(b.id) ? b.color : 'var(--muted)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ width: '1px', height: '32px', background: 'var(--line)' }}></div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>Período</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select 
                  value={periodFilter} 
                  onChange={e => setPeriodFilter(e.target.value)}
                  className="glass"
                  style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600, background: 'transparent', border: '1px solid var(--line)', color: 'var(--title)' }}
                >
                  <option value="all">Todo o Período</option>
                  <option value="week">Esta Semana</option>
                  <option value="month">Este Mês</option>
                  <option value="quarter">Este Trimestre</option>
                  <option value="semester">Este Semestre</option>
                  <option value="year">Este Ano</option>
                  <option value="custom">Personalizado...</option>
                </select>
                {periodFilter === 'custom' && (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <input 
                      type="date" 
                      value={customRange.start} 
                      onChange={e => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                      style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', border: '1px solid var(--line)' }}
                    />
                    <span style={{ color: 'var(--muted)' }}>-</span>
                    <input 
                      type="date" 
                      value={customRange.end} 
                      onChange={e => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                      style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', border: '1px solid var(--line)' }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="dash-360-container" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', 
            gap: '24px',
            alignItems: 'start'
          }}>
            {grupos360.length === 0 ? (
              <div className="glass-card" style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '16px' }}>task_alt</span>
                <p>Nenhuma tarefa ativa nos filtros selecionados.</p>
              </div>
            ) : grupos360.map(bucket => (
              <div key={bucket.id} className="dash-360-col" style={{ background: 'var(--panel-strong)', padding: '16px', borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', border: '1px solid var(--line)' }}>
                <div className="dash-360-header" style={{ 
                  padding: '12px 16px', 
                  borderRadius: 'var(--radius-md)', 
                  marginBottom: '16px', 
                  background: `${bucket.color}15`, 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  border: `1px solid ${bucket.color}30`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, color: bucket.color }}>{bucket.title}</span>
                    <button className="icon-btn-micro" onClick={() => onAddTask(bucket.statuses[0])} style={{ background: `${bucket.color}20`, border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px' }} title={`Nova tarefa em ${bucket.title}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: bucket.color }}>add</span>
                    </button>
                  </div>
                  <span className="badge" style={{ background: bucket.color, color: '#fff' }}>{bucket.tasks.length}</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {bucket.tasks.map(t => (
                    <div className="dash-360-card glass" key={bucket.id + t.id} style={{ 
                      borderLeft: `4px solid ${bucket.id === 'concluidas' ? '#10b981' : t.corPrioridade}`, 
                      padding: '16px', 
                      borderRadius: 'var(--radius-lg)',
                      opacity: bucket.id === 'concluidas' || bucket.id === 'canceladas' ? 0.75 : 1,
                      position: 'relative'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ fontSize: '.65rem', color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.demandaNome}</div>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px', 
                          fontSize: '0.65rem', 
                          fontWeight: 700, 
                          color: t.status === 'Pausado' || t.status === 'Bloqueio' ? '#ef4444' : 'var(--muted)',
                          padding: '2px 6px',
                          borderRadius: '6px',
                          background: t.status === 'Pausado' || t.status === 'Bloqueio' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0,0,0,0.03)'
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{t.statusIcon}</span>
                          <span>{t.status.toUpperCase()}</span>
                        </div>
                      </div>
                      <div style={{ 
                        fontWeight: 700, 
                        fontSize: '.9rem', 
                        color: 'var(--title)', 
                        marginBottom: '12px', 
                        lineHeight: '1.4', 
                        whiteSpace: 'normal',
                        textDecoration: bucket.id === 'concluidas' ? 'line-through' : 'none'
                      }}>{t.title}</div>
                      
                      <div className="dash-360-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {t.emp?.avatarUrl ? <img src={t.emp.avatarUrl} className="dash-360-avatar" style={{ width: '22px', height: '22px' }} /> : <div className="dash-360-avatar" style={{ background: bucket.id === 'concluidas' ? '#10b981' : t.corPrioridade, width: '22px', height: '22px', fontSize: '10px' }}>{(t.emp?.name || 'A').charAt(0)}</div>}
                          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t.emp?.name?.split(' ')[0]}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: bucket.id === 'concluidas' ? '#10b981' : t.corPrioridade, fontWeight: 800, fontSize: '0.7rem' }}>
                            {bucket.id === 'concluidas' ? 'CONCLUÍDA' : `${t.startDate ? t.startDate.split('-').reverse().slice(0, 2).join('/') : '-'} - ${t.endDate ? t.endDate.split('-').reverse().slice(0, 2).join('/') : '-'}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>


      </div>
    </div>
  );
}
