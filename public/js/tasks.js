function TaskView({ tasks, setTasks, employees: initialEmployees, requests, demandas, setDemandas, currentUser, authToken, globalFilters, onAddTask, onAddDemanda, requestedModal, setRequestedModal, authorizedScope }) {
  const [dbEmployees, setDbEmployees] = React.useState(initialEmployees || []);
  const holidays = React.useMemo(() => getBrazilianHolidays(2026), []);
  const [statusModal, setStatusModal] = React.useState(null); // {taskId, newStatus, oldStatus}
  const [statusComment, setStatusComment] = React.useState('');
  const [demandaModal, setDemandaModal] = React.useState(null); // { id, titulo, responsavelId, inicioPlanjado, fimPlanejado, descricao, criadorId }
  const [taskDescriptionModal, setTaskDescriptionModal] = React.useState(null); // { taskId, description }

  // Ajuste automático de altura das textareas de título
  React.useLayoutEffect(() => {
    const textareas = document.querySelectorAll('.title-wrap-cell textarea');
    textareas.forEach(ta => {
      ta.style.height = 'auto';
      ta.style.height = (ta.scrollHeight) + 'px';
    });
  }, [tasks]);

  // Novos filtros locais
  const [taskStatusFilter, setTaskStatusFilter] = React.useState('');
  const [taskResponsibleFilter, setTaskResponsibleFilter] = React.useState('');
  const [localDemandaStatusFilter, setLocalDemandaStatusFilter] = React.useState('');
  const [demandaResponsibleFilter, setDemandaResponsibleFilter] = React.useState('');

  // Largura das colunas (não persistente conforme solicitado)
  // Largura das colunas (otimizadas para 100% da tela sem scroll)
  const [taskColWidths, setTaskColWidths] = React.useState({ title: 240, demanda: 150, owner: 140, priority: 100, status: 110, dates: 160, actions: 60 });
  const [demandColWidths, setDemandColWidths] = React.useState({ title: 280, owner: 140, status: 110, priority: 100, progress: 120, dates: 160, actions: 100 });
  
  // Tamanho do modal dinâmico
  const [modalSize, setModalSize] = React.useState({ width: 800, height: 600 });
  const [isFirstLoad, setIsFirstLoad] = React.useState(true);

  const getSubordinateIds = React.useCallback((allEmps, managerId) => {
    const direct = allEmps.filter(e => String(e.gestorId) === String(managerId));
    let ids = direct.map(e => e.id);
    direct.forEach(sub => {
      ids = [...ids, ...getSubordinateIds(allEmps, sub.id)];
    });
    return Array.from(new Set(ids));
  }, []);

  const filteredTasks = React.useMemo(() => {
    if (!tasks || !Array.isArray(tasks)) return [];
    
    let list = tasks;

    // Filtros locais (Avançados)
    if (taskStatusFilter) list = list.filter(t => t.status === taskStatusFilter);
    if (taskResponsibleFilter) list = list.filter(t => String(t.ownerId) === String(taskResponsibleFilter));

    if (!globalFilters) return list;

    return list.filter(task => {
      const emp = dbEmployees?.find(e => String(e.id) === String(task.ownerId));
      if (!emp) return true;

      // Rule: Authorization Scope (if not Admin)
      if (authorizedScope) {
        const isAllowed = authorizedScope.colabIds.includes(Number(emp.id)) || 
                          authorizedScope.areaIds.includes(Number(emp.areaId));
        if (!isAllowed) return false;
      }

      // Filter by Colaborador
      if (globalFilters.colaboradorId && String(emp.id) !== String(globalFilters.colaboradorId)) return false;

      // Filter by Gestor (Hierarchy)
      if (globalFilters.gestorId) {
        const subordinateIds = [parseInt(globalFilters.gestorId), ...getSubordinateIds(dbEmployees, globalFilters.gestorId)];
        if (!subordinateIds.includes(parseInt(emp.id))) return false;
      } else if (globalFilters.gestor) {
        if (emp.areaNome !== globalFilters.gestor && emp.manager !== globalFilters.gestor) return false;
      }

      // Filter by Cargo/Team
      if (globalFilters.cargo && emp.teamStr !== globalFilters.cargo && emp.team !== globalFilters.cargo && emp.cargoNome !== globalFilters.cargo) return false;

      return true;
    });
  }, [tasks, dbEmployees, globalFilters, getSubordinateIds, taskStatusFilter, taskResponsibleFilter]);

  const filteredDemandas = React.useMemo(() => {
    if (!demandas || !Array.isArray(demandas)) return [];
    
    // Filtros locais (Avançados)
    let list = demandas;
    if (localDemandaStatusFilter) list = list.filter(d => (d.Status || d.status) === localDemandaStatusFilter);
    if (demandaResponsibleFilter) list = list.filter(d => String(d.responsavelId || d.ResponsavelId) === String(demandaResponsibleFilter));

    return list.filter(d => {
      if (!globalFilters) return true;
      
      // Filter by gestorId (full hierarchy: manager + all recursive subordinates)
      if (globalFilters.gestorId) {
        const subIds = [parseInt(globalFilters.gestorId), ...getSubordinateIds(dbEmployees, globalFilters.gestorId)];
        const rId = parseInt(d.responsavelId || d.ResponsavelId);
        if (!subIds.includes(rId)) return false;
      } else {
        // Filter by responsible if set
        if (globalFilters.colaboradorId && String(d.responsavelId || d.ResponsavelId) !== globalFilters.colaboradorId) return false;
        // Filter demands by the team/manager of their responsible
        const resp = dbEmployees?.find(e => e.id === (d.responsavelId || d.ResponsavelId));
        if (resp) {
          if (globalFilters.gestor && resp.managerStr !== globalFilters.gestor && resp.manager !== globalFilters.gestor && resp.areaNome !== globalFilters.gestor) return false;
          if (globalFilters.cargo && resp.teamStr !== globalFilters.cargo && resp.team !== globalFilters.cargo && resp.cargoNome !== globalFilters.cargo) return false;
        }
      }
      return true;
    });
  }, [demandas, dbEmployees, globalFilters, getSubordinateIds, localDemandaStatusFilter, demandaResponsibleFilter]);

  // Auto-ajuste de colunas ao carregar
  React.useEffect(() => {
    if (isFirstLoad && ((filteredTasks && filteredTasks.length > 0) || (filteredDemandas && filteredDemandas.length > 0))) {
      const timer = setTimeout(() => {
        const calculateWidths = (tableClass) => {
          const table = document.querySelector(`.${tableClass}`);
          if (!table) return null;
          
          const originalLayout = table.style.tableLayout;
          table.style.tableLayout = 'auto';
          const headers = table.querySelectorAll('th.resizable-th');
          const updates = {};
          
          headers.forEach(th => {
            const label = th.innerText.toLowerCase();
            const measuredWidth = Math.max(th.offsetWidth, 80);
            
            if (label.includes('tarefa') || label.includes('nome da demanda')) updates.title = measuredWidth;
            else if (label.includes('demanda')) updates.demanda = measuredWidth;
            else if (label.includes('responsável')) updates.owner = measuredWidth;
            else if (label.includes('prioridade')) updates.priority = measuredWidth;
            else if (label.includes('status')) updates.status = measuredWidth;
            else if (label.includes('cronograma')) updates.dates = measuredWidth;
            else if (label.includes('ações')) updates.actions = measuredWidth;
            else if (label.includes('progresso')) updates.progress = measuredWidth;
          });

          table.style.tableLayout = originalLayout;
          return updates;
        };

        const taskUpdates = calculateWidths('tasks-table');
        if (taskUpdates) setTaskColWidths(prev => ({ ...prev, ...taskUpdates }));

        const demandUpdates = calculateWidths('demandas-table');
        if (demandUpdates) setDemandColWidths(prev => ({ ...prev, ...demandUpdates }));
        
        setIsFirstLoad(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [filteredTasks.length, filteredDemandas.length, isFirstLoad]);


  React.useEffect(() => {
    fetch(`${API_BASE}/api/employees`, { headers: apiHeaders(authToken) })
      .then(res => res.json())
      .then(data => {
        let list = data || [];
        // Apply scope restriction to the internal list used for dropdowns
        if (authorizedScope) {
          list = list.filter(e => authorizedScope.colabIds.includes(Number(e.id)) || authorizedScope.areaIds.includes(Number(e.areaId)));
        }
        setDbEmployees(list);
      })
      .catch(err => console.error('Failed to fetch employees in TaskView', err));
  }, [authToken, authorizedScope]);

  React.useEffect(() => {
    if (requestedModal && requestedModal.type === 'demanda') {
      setDemandaModal(requestedModal.data);
      if (setRequestedModal) setRequestedModal(null);
    }
  }, [requestedModal, setRequestedModal]);





  const statuses = ['Não Iniciado', 'Em Andamento', 'Concluído', 'Pausado', 'Bloqueio', 'Cancelado'];
  const STATUS_INITIALS = {
    'Não Iniciado': 'NI',
    'Em Andamento': 'EA',
    'Concluído': 'CO',
    'Pausado': 'PA',
    'Bloqueio': 'BL',
    'Cancelado': 'CA'
  };
  const priorities = ['Baixa', 'Média', 'Alta', 'Crítica'];
  const demandStatuses = ['Não Iniciado', 'Em Andamento', 'Concluído', 'Pausado', 'Bloqueio', 'Cancelado'];

  const cycleValue = (current, array) => {
    const idx = array.indexOf(current);
    return array[(idx + 1) % array.length];
  };

  const syncTask = async (task, oldStatus = null, comment = '') => {
    try {
      const payload = { 
        titulo: task.title, 
        descricao: task.description || null,
        responsavelId: task.ownerId, 
        status: task.status, 
        prioridade: task.priority, 
        inicio: task.startDate, 
        final: task.endDate, 
        demandaId: task.demandaId || null,
        statusAnterior: oldStatus,
        comentarioStatus: comment,
        registrarHistorico: !!oldStatus
      };

      // Se a tarefa tem ID real (positivo), faz o UPDATE (PUT)
      if (task.id && task.id > 0) {
        fetch(`${API_BASE}/api/tasks/${task.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', ...apiHeaders(authToken) }, body: JSON.stringify(payload)
        }).catch(err => console.log('Sync error (PUT)', err));
      } 
      // Se a tarefa tem ID temporário (negativo), faz o CREATE (POST)
      else if (task.id && task.id < 0) {
        fetch(`${API_BASE}/api/tasks`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...apiHeaders(authToken) }, body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
          if (data?.id) {
             // Promove o ID temporário para o ID real retornado pelo servidor
             setTasks(prev => prev.map(t => t.id === task.id ? { ...t, id: data.id } : t));
          }
        })
        .catch(err => console.log('Sync error (POST)', err));
      }
    } catch (e) {
      console.error('SyncTask error', e);
    }
  };

  const updateTask = (id, field, value) => {
    setTasks(prev => {
      return prev.map(t => {
        if (t.id === id) {
          return { ...t, [field]: value };
        }
        return t;
      });
    });

    // For fields that are not text inputs, sync immediately
    if (field !== 'title') {
      setTimeout(() => {
        setTasks(current => {
          const t = current.find(x => x.id === id);
          if (t && (field === 'status' || field === 'priority' || field === 'startDate' || field === 'endDate' || field === 'ownerId' || field === 'demandaId')) {
            syncTask(t);
          }
          return current;
        });
      }, 100);
    }
  };

  const deleteTask = (id) => {
    if (!confirm('Deseja realmente excluir esta tarefa?')) return;
    // IDs negativos são temporários — remover só do estado local, sem chamar API
    if (!id || id < 0) {
      setTasks(current => current.filter(t => t.id !== id));
      return;
    }
    fetch(`${API_BASE}/api/tasks/${id}`, {
      method: 'DELETE',
      headers: apiHeaders(authToken)
    })
      .then(() => {
        setTasks(current => current.filter(t => t.id !== id));
      })
      .catch(err => {
        console.error('Failed to delete task', err);
        // Remove localmente mesmo assim para não deixar tarefa órfã na UI
        setTasks(current => current.filter(t => t.id !== id));
      });
  };

  const getStatusClass = (status) => {
    if (status === 'Concluído') return 'done';
    if (status === 'Em Andamento') return 'working';
    if (status === 'Bloqueio') return 'stuck';
    if (status === 'Pausado') return 'stuck';
    if (status === 'Cancelado') return 'rejected';
    return 'not-started';
  };

  const getPriorityClass = (priority) => {
    if (priority === 'Crítica') return 'critical';
    if (priority === 'Alta') return 'high';
    if (priority === 'Média') return 'medium';
    return 'low';
  };

  const calculateAvailableDays = (ownerId, start, end) => {
    if (!start || !end) return 0;
    let count = 0;
    let currentDate = new Date(start + 'T12:00:00');
    const endDateObj = new Date(end + 'T12:00:00');

    while (currentDate <= endDateObj) {
      const dateKey = formatDateLocal(currentDate);
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;

      if (!isWeekend && !holidays[dateKey]) {
        const hasAbsence = requests.some(r => {
          if (r.employeeId !== ownerId) return false;
          if (r.status === 'Rejeitado') return false;
          if (!['Férias integrais', 'Férias fracionadas', 'Day-off', 'Saúde (Exames/Consultas)'].includes(r.type)) return false;
          return isWithinRange(dateKey, r.startDate, r.endDate);
        });
        if (!hasAbsence) count++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return count;
  };

  const [showGantt, setShowGantt] = React.useState(false);
  const [ganttScale, setGanttScale] = React.useState('month');
  const [ganttBaseDate, setGanttBaseDate] = React.useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [selectedDemandaId, setSelectedDemandaId] = React.useState(null);
  const [demandaStatusFilter, setDemandaStatusFilter] = React.useState('');





  const handleStatusChange = (task, newStatus) => {
    if (newStatus === task.status) return;
    setStatusModal({ taskId: task.id, newStatus, oldStatus: task.status });
    setStatusComment('');
  };

  const confirmStatusChange = () => {
    if (!statusModal) return;
    const { taskId, newStatus, oldStatus } = statusModal;
    
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    
    setTimeout(() => {
      const t = tasks.find(x => x.id === taskId);
      if (t) {
        syncTask({ ...t, status: newStatus }, oldStatus, statusComment);

        // Business rule: Auto-start demand when a task becomes active
        const activeStatuses = ['Em Andamento', 'Pausado', 'Bloqueio'];
        if (activeStatuses.includes(newStatus) && t.demandaId) {
          const linkedDemanda = demandas.find(d => (d.Id || d.id) === t.demandaId);
          if (linkedDemanda && (linkedDemanda.Status || linkedDemanda.status) === 'Não Iniciado') {
            handleDemandaStatusChange(linkedDemanda, 'Em Andamento', true);
          }
        }
      }
    }, 100);
    setStatusModal(null);
  };

  const handleDemandaStatusChange = (demanda, newStatus, forceUpdate = false) => {
    const demandaId = demanda.Id || demanda.id;
    const oldStatus = demanda.Status || demanda.status;
    if (newStatus === oldStatus && !forceUpdate) return;

    // Business rule: Demand can only be marked as 'Concluído' if ALL linked tasks are 'Concluído' or 'Cancelado'
    if (newStatus === 'Concluído') {
      const linkedTasks = tasks.filter(t => t.demandaId === demandaId);
      if (linkedTasks.length > 0) {
        const allDone = linkedTasks.every(t => t.status === 'Concluído' || t.status === 'Cancelado');
        if (!allDone) {
          const pendingCount = linkedTasks.filter(t => t.status !== 'Concluído' && t.status !== 'Cancelado').length;
          alert(`Não é possível concluir esta demanda.\n\n${pendingCount} tarefa(s) ainda não foram finalizadas ou canceladas.\n\nFinalize ou cancele todas as tarefas vinculadas antes de concluir a demanda.`);
          return;
        }
      }
    }

    fetch(`${API_BASE}/api/demandas/${demandaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': authToken ? 'Bearer ' + authToken : '' },
      body: JSON.stringify({ 
        titulo: demanda.Titulo || demanda.titulo, 
        status: newStatus, 
        prioridade: demanda.Prioridade || demanda.prioridade, 
        statusAnterior: oldStatus,
        registrarHistorico: true,
        comentarioStatus: demanda.justificativa || 'Alteração manual'
      })
    }).then(() => {
      if (setDemandas) setDemandas(prev => prev.map(d => (d.Id || d.id) === demandaId ? { ...d, Status: newStatus, status: newStatus } : d));
    }).catch(() => alert('Erro ao atualizar status da demanda'));
  };

  const saveDemanda = (form) => {
    const method = form.id ? 'PUT' : 'POST';
    const url = form.id ? `${API_BASE}/api/demandas/${form.id}` : `${API_BASE}/api/demandas`;

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': authToken ? 'Bearer ' + authToken : '' },
      body: JSON.stringify({
        titulo: form.titulo,
        responsavelId: form.responsavelId ? Number(form.responsavelId) : null,
        status: form.status || 'Não Iniciado',
        prioridade: form.prioridade || 'Média',
        inicioPlanjado: form.inicioPlanjado || null,
        fimPlanejado: form.fimPlanejado || null,
        descricao: form.descricao || null,
        responsavelAnterior: form.responsavelAnterior,
        inicioAnterior: form.inicioAnterior,
        fimAnterior: form.fimAnterior,
        justificativa: form.justificativa
      })
    })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha no servidor');
      return data;
    })
    .then(data => {
      if (method === 'POST') {
        const newDemanda = { 
          Id: data.id, id: data.id, 
          Titulo: form.titulo, titulo: form.titulo, 
          Descricao: form.descricao, descricao: form.descricao,
          ResponsavelId: form.responsavelId ? Number(form.responsavelId) : null, 
          Status: form.status || 'Não Iniciado', status: form.status || 'Não Iniciado', 
          Prioridade: form.prioridade || 'Média', prioridade: form.prioridade || 'Média', 
          InicioPlanjado: form.inicioPlanjado || null, inicioPlanjado: form.inicioPlanjado || null, 
          FimPlanejado: form.fimPlanejado || null, fimPlanejado: form.fimPlanejado || null, 
          CriadoPor: data.criadorId, criadorId: data.criadorId,
          TotalTarefas: 0, TarefasConcluidas: 0 
        };
        setDemandas(prev => [newDemanda, ...prev]);
      } else {
        setDemandas(prev => prev.map(d => (d.Id || d.id) === form.id ? { ...d, ...form, Titulo: form.titulo, ResponsavelId: Number(form.responsavelId), Status: form.status, Prioridade: form.prioridade, InicioPlanjado: form.inicioPlanjado, FimPlanejado: form.fimPlanejado, Descricao: form.descricao } : d));
      }
      setDemandaModal(null);
    })
    .catch(err => {
      console.error('Save Demand Error:', err);
      alert('Erro ao salvar demanda: ' + err.message);
    });
  };


  const handleEditDemanda = (d) => {
    const dId = d.Id || d.id;
    const pStart = d.inicioPlanjado || d.InicioPlanjado;
    const pEnd = d.fimPlanejado || d.FimPlanejado;
    const rId = d.ResponsavelId || d.responsavelId;

    setDemandaModal({
      id: dId,
      titulo: d.Titulo || d.titulo,
      responsavelId: rId,
      inicioPlanjado: pStart ? pStart.slice(0, 10) : '',
      fimPlanejado: pEnd ? pEnd.slice(0, 10) : '',
      status: d.Status || d.status,
      prioridade: d.Prioridade || d.prioridade,
      descricao: d.Descricao || d.descricao || '',
      criadorId: d.CriadoPor || d.criadorId,
      // Original values for change detection
      responsavelAnterior: rId,
      inicioAnterior: pStart,
      fimAnterior: pEnd,
      justificativa: ''
    });
  };

  const handleDeleteDemanda = (demanda) => {
    const dId = demanda.Id || demanda.id;
    if (!confirm(`Deseja realmente excluir a demanda "${demanda.Titulo || demanda.titulo}"?`)) return;
    fetch(`${API_BASE}/api/demandas/${dId}`, {
      method: 'DELETE',
      headers: apiHeaders(authToken)
    })
    .then(() => {
      setDemandas(prev => prev.filter(d => (d.Id || d.id) !== dId));
    })
    .catch(err => console.error('Error deleting demanda', err));
  };

  const toggleDemandaFilter = (demandaId) => {
    setSelectedDemandaId(prev => prev === demandaId ? null : demandaId);
  };

  const renderGantt = () => {
    const daysCount = ganttScale === 'week' ? 7 : (ganttScale === 'quarter' ? 90 : 30);
    const colWidth = ganttScale === 'quarter' ? 12 : (ganttScale === 'week' ? 40 : 24);
    const baseDateObj = new Date(ganttBaseDate + 'T12:00:00');
    const days = [];
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(baseDateObj);
      d.setDate(d.getDate() + i);
      days.push(d);
    }

    return (
      <div className="gantt-container" style={{ marginTop: '20px', background: 'var(--panel-strong)', borderRadius: 'var(--radius-lg)', padding: '24px', border: '1px solid var(--line)', boxShadow: 'var(--shadow-sm)', maxWidth: '100%', overflowX: 'hidden' }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>calendar_today</span>
            <input type="date" className="monday-date-input" value={ganttBaseDate} onChange={e => setGanttBaseDate(e.target.value)} title="Data de início" style={{ border: 'none', background: 'transparent', color: 'var(--title)', outline: 'none', fontSize: '0.85rem', fontWeight: 600 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>aspect_ratio</span>
            <select className="monday-select" value={ganttScale} onChange={e => setGanttScale(e.target.value)} style={{ border: 'none', background: 'transparent', color: 'var(--title)', outline: 'none', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
              <option value="week">Semana (7 dias)</option>
              <option value="month">Mês (30 dias)</option>
              <option value="quarter">Trimestre (90 dias)</option>
            </select>
          </div>
          {selectedDemandaId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(51,204,204,.12)', padding: '6px 14px', borderRadius: 'var(--radius-lg)', fontSize: '.8rem', color: 'var(--primary)', fontWeight: 700 }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>filter_alt</span>
              Filtrando por demanda
              <span style={{ cursor: 'pointer', marginLeft: '6px', opacity: 0.7 }} onClick={() => setSelectedDemandaId(null)} title="Limpar filtro">✕</span>
            </div>
          )}

          {/* Legenda de Status */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginLeft: 'auto' }}>
            {Object.entries(STATUS_COLORS).map(([name, color]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: color }}></div>
                <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>{name}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', background: 'var(--surface)', width: '100%' }}>
          <div style={{ minWidth: 'min-content' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', padding: '12px 0', background: 'var(--panel-strong)' }}>
              <div style={{ minWidth: '240px', width: '240px', fontWeight: 800, position: 'sticky', left: 0, background: 'var(--panel-strong)', zIndex: 10, paddingLeft: '16px', color: 'var(--title)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tarefas</div>
              {days.map((d, i) => (
                <div key={i} className={`gantt-day-header ${ganttScale === 'quarter' ? 'rotated' : ''}`} style={{ minWidth: `${colWidth}px`, width: `${colWidth}px`, textAlign: 'center', fontSize: '10px', color: 'var(--muted)', fontWeight: 700, borderLeft: i % 7 === 0 && ganttScale !== 'week' ? '1px solid var(--line)' : 'none' }}>
                  {d.getDate()}/{d.getMonth() + 1}
                </div>
              ))}
            </div>
            {filteredTasks.length === 0 && <div className="empty-state" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Sem tarefas correspondentes aos filtros.</div>}
            <div style={{ padding: '8px 0' }}>
              {filteredTasks.map(t => {
                const employee = dbEmployees?.find(e => e.id === t.ownerId) || dbEmployees?.[0] || {};
                let offsetDays = 0;
                let lengthDays = 0;
                let isVisible = false;

                if (t.startDate && t.endDate) {
                  const startObj = new Date(t.startDate + 'T12:00:00');
                  const endObj = new Date(t.endDate + 'T12:00:00');
                  offsetDays = Math.floor((startObj - baseDateObj) / (1000 * 60 * 60 * 24));
                  lengthDays = Math.floor((endObj - startObj) / (1000 * 60 * 60 * 24)) + 1;

                  const visualLeft = Math.max(0, offsetDays) * colWidth;
                  const endOffset = offsetDays + lengthDays;
                  const visualEnd = Math.min(daysCount, endOffset);
                  const visualStart = Math.max(0, offsetDays);
                  const visualWidth = Math.max(0, (visualEnd - visualStart) * colWidth);

                  if (visualWidth > 0 && offsetDays < daysCount && endOffset > 0) {
                    isVisible = { left: visualLeft, width: visualWidth };
                  }
                }

                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
                    <div style={{ 
                      minWidth: '240px', 
                      width: '240px', 
                      fontSize: '0.8rem', 
                      fontWeight: 500, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '10px', 
                      position: 'sticky', 
                      left: 0, 
                      background: 'var(--surface)', 
                      zIndex: 10, 
                      padding: '8px 16px', 
                      color: 'var(--title)',
                      lineHeight: '1.2',
                      whiteSpace: 'normal',
                      overflowWrap: 'break-word',
                      borderRight: '1px solid var(--line)'
                    }}>
                      {employee.AvatarUrl || employee.avatarUrl ? <img src={employee.AvatarUrl || employee.avatarUrl} loading="lazy" style={{ width: '24px', height: '24px', borderRadius: 'var(--radius-sm)', flexShrink: 0, objectFit: 'cover', border: '1px solid var(--line)' }} alt="Avatar" /> : <div style={{ width: '24px', height: '24px', borderRadius: 'var(--radius-sm)', flexShrink: 0, background: employee.color || '#ccc', border: '1px solid var(--line)' }} />}
                      <span style={{ flex: 1 }}>{t.title || 'Sem título'}</span>
                    </div>
                    <div style={{ display: 'flex', position: 'relative', height: '24px', flex: 1, minWidth: `${daysCount * colWidth}px` }}>
                      {isVisible && (
                        <div style={{
                          position: 'absolute',
                          left: `${isVisible.left}px`,
                          width: `${isVisible.width}px`,
                          height: '14px',
                          background: STATUS_COLORS[t.status] || 'var(--primary)',
                          borderRadius: 'var(--radius-sm)',
                          top: '5px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }} title={`${t.title} (${t.status}): ${t.startDate} a ${t.endDate}`}>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Status/Priority select background color helpers
  const STATUS_COLORS = { 
    'Concluído': '#10b981', // More vibrant green
    'Em Andamento': '#3b82f6', // More vibrant blue
    'Bloqueio': '#ef4444', // More vibrant red
    'Pausado': '#f59e0b', // Amber/Yellow
    'Cancelado': '#94a3b8', 
    'Não Iniciado': '#64748b' // Modern Slate color
  };

  const statusSelectStyle = (s) => {
    return { 
      background: STATUS_COLORS[s] || '#64748b', 
      color: '#fff', 
      fontWeight: 700,
      padding: '4px 12px', // Added horizontal padding for better spacing
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    };
  };
  const prioritySelectStyle = (p) => {
    const map = { 'Crítica': '#e2445c', 'Alta': '#784bd1', 'Média': '#579bfc', 'Baixa': '#c4c4c4' };
    return { 
      background: map[p] || '#c4c4c4', 
      color: p === 'Baixa' ? '#555' : '#fff', 
      fontWeight: 700, 
      fontSize: '.75rem', 
      border: 'none', 
      borderRadius: 'var(--radius-lg)', 
      padding: '6px 12px', 
      cursor: 'pointer', 
      textAlign: 'center', 
      width: '100%', 
      textTransform: 'uppercase', 
      letterSpacing: '.03em',
      appearance: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    };
  };

  return (
    <div className="task-view-container" onMouseMove={(e) => {
      if (window.isResizingModal) {
        const newWidth = e.clientX - window.modalStartPos.left;
        const newHeight = e.clientY - window.modalStartPos.top;
        if (newWidth > 400 && newHeight > 300) setModalSize({ width: newWidth, height: newHeight });
      }
    }} onMouseUp={() => { window.isResizingModal = false; }}>
      
      {demandaModal && (
        <div className="demand-modal-overlay">
          <div className="demand-modal resizable-modal" style={{ width: `${modalSize.width}px`, height: `${modalSize.height}px`, maxHeight: '90vh' }}>
            <div className="modal-resizer" onMouseDown={(e) => {
               window.isResizingModal = true;
               const rect = e.target.parentElement.getBoundingClientRect();
               window.modalStartPos = { left: rect.left, top: rect.top };
            }} />
            
            <div className="modal-body-scroll" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '28px' }}>
              <div className="section-title" style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, background: 'var(--glass-title)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {demandaModal.id ? 'Refinar Demanda' : 'Nova Demanda Estratégica'}
                </h3>
              </div>

              <div className="field" style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px', display: 'block' }}>Título da Demanda</label>
                <input 
                  value={demandaModal.titulo} 
                  onChange={e => setDemandaModal({ ...demandaModal, titulo: e.target.value })} 
                  placeholder="Ex: Expansão de Infraestrutura Q4" 
                  style={{ width: '100%', background: 'var(--panel-strong)', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', padding: '10px 14px' }}
                />
              </div>

              <div className="field" style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px', display: 'block' }}>Descrição / Detalhes</label>
                <textarea 
                  value={demandaModal.descricao || ''} 
                  onChange={e => setDemandaModal({ ...demandaModal, descricao: e.target.value })} 
                  placeholder="Detalhes complementares sobre o objetivo desta demanda..." 
                  style={{ width: '100%', minHeight: '80px', background: 'var(--panel-strong)', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', padding: '10px 14px', resize: 'vertical', fontSize: '0.9rem' }}
                />
              </div>

              <div className="field" style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px', display: 'block' }}>Responsável Líder</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <select 
                    value={demandaModal.responsavelId || ''} 
                    onChange={e => setDemandaModal({ ...demandaModal, responsavelId: e.target.value })}
                    style={{ flex: 1, background: 'var(--panel-strong)', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', padding: '10px 14px' }}
                  >
                    <option value="">Selecione um responsável...</option>
                    {dbEmployees?.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                  {demandaModal.responsavelId && (
                    <img
                      src={dbEmployees?.find(e => e.id == demandaModal.responsavelId)?.avatarUrl || `https://ui-avatars.com/api/?name=${dbEmployees?.find(e => e.id == demandaModal.responsavelId)?.name}&background=random`}
                      style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}
                    />
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="field">
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px', display: 'block' }}>Início Planejado</label>
                  <input type="date" value={demandaModal.inicioPlanjado} onChange={e => setDemandaModal({ ...demandaModal, inicioPlanjado: e.target.value })} style={{ width: '100%', background: 'var(--panel-strong)', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', padding: '10px' }} />
                </div>
                <div className="field">
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px', display: 'block' }}>Término Planejado</label>
                  <input type="date" value={demandaModal.fimPlanejado} onChange={e => setDemandaModal({ ...demandaModal, fimPlanejado: e.target.value })} style={{ width: '100%', background: 'var(--panel-strong)', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', padding: '10px' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div className="field">
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px', display: 'block' }}>Prioridade</label>
                  <select value={demandaModal.prioridade || 'Média'} onChange={e => setDemandaModal({ ...demandaModal, prioridade: e.target.value })} style={{ width: '100%', background: 'var(--panel-strong)', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', padding: '10px' }}>
                    {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px', display: 'block' }}>Status</label>
                  <select 
                    value={demandaModal.status || 'Não Iniciado'} 
                    onChange={e => setDemandaModal({ ...demandaModal, status: e.target.value })} 
                    style={{ width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', padding: '10px', ...statusSelectStyle(demandaModal.status || 'Não Iniciado') }}
                  >
                    {demandStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              {demandaModal.id && (
                (demandaModal.responsavelId != demandaModal.responsavelAnterior) ||
                (demandaModal.inicioPlanjado != (demandaModal.inicioAnterior ? demandaModal.inicioAnterior.slice(0, 10) : '')) ||
                (demandaModal.fimPlanejado != (demandaModal.fimAnterior ? demandaModal.fimAnterior.slice(0, 10) : ''))
              ) && (
                  <div className="field" style={{ marginBottom: '20px', animation: 'fadeIn 0.3s ease' }}>
                    <label style={{ color: 'var(--warning)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Justificativa da Alteração (Obrigatório)</label>
                    <textarea
                      style={{ minHeight: '60px', borderColor: 'var(--warning)', background: 'var(--panel-strong)', borderRadius: 'var(--radius-md)', width: '100%', padding: '10px 14px', fontSize: '0.9rem' }}
                      placeholder="Descreva o motivo da mudança estratégica de responsável ou prazos..."
                      value={demandaModal.justificativa}
                      onChange={e => setDemandaModal({ ...demandaModal, justificativa: e.target.value })}
                    />
                  </div>
                )}

              <div style={{ display: 'flex', gap: '12px', marginTop: 'auto', paddingTop: '20px', justifyContent: 'flex-end', borderTop: '1px solid var(--line)' }}>
                <button className="btn-secondary" onClick={() => setDemandaModal(null)} style={{ padding: '10px 24px', borderRadius: 'var(--radius-md)', fontWeight: 600 }}>Cancelar</button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    const hasChanges = (demandaModal.responsavelId != demandaModal.responsavelAnterior) ||
                      (demandaModal.inicioPlanjado != (demandaModal.inicioAnterior ? demandaModal.inicioAnterior.slice(0, 10) : '')) ||
                      (demandaModal.fimPlanejado != (demandaModal.fimAnterior ? demandaModal.fimAnterior.slice(0, 10) : ''));
                    if (demandaModal.id && hasChanges && !demandaModal.justificativa?.trim()) {
                      alert('Por favor, preencha a justificativa para as alterações de responsável ou prazos.');
                      return;
                    }
                    saveDemanda(demandaModal);
                  }}
                  style={{ padding: '10px 32px', borderRadius: 'var(--radius-md)', fontWeight: 700, background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-2) 100%)', border: 'none', color: '#fff', boxShadow: '0 4px 12px rgba(51, 204, 204, 0.2)' }}
                >
                  {demandaModal.id ? 'Salvar Alterações' : 'Criar Demanda'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {statusModal && (
        <div className="status-modal-overlay">
          <div className="status-modal glass-card" style={{ padding: '32px', borderRadius: '28px', maxWidth: '540px', width: '90%', border: '1px solid var(--glass-border)', background: 'var(--surface)' }}>
            <div className="section-title" style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, background: 'var(--glass-title)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Transição de Status</h3>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
              Movendo para: <span className="status-pill working" style={{ fontSize: '0.75rem', padding: '4px 12px', marginLeft: '6px' }}>{statusModal.newStatus}</span>
            </p>
            
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '10px', display: 'block' }}>Comentário / Justificativa</label>
            <textarea
              value={statusComment}
              onChange={e => setStatusComment(e.target.value)}
              placeholder="Ex: Aguardando aprovação técnica final ou retorno do cliente..."
              style={{ width: '100%', minHeight: '120px', marginBottom: '28px', background: 'var(--panel-strong)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', padding: '16px' }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setStatusModal(null)} style={{ padding: '12px 24px', borderRadius: 'var(--radius-md)', fontWeight: 600 }}>Voltar</button>
              <button className="btn-primary" onClick={confirmStatusChange} style={{ padding: '12px 32px', borderRadius: 'var(--radius-md)', fontWeight: 700, background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-2) 100%)', border: 'none', color: '#fff', boxShadow: '0 8px 20px rgba(51, 204, 204, 0.3)' }}>Confirmar Mudança</button>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', marginBottom: '32px', padding: '20px 28px', borderRadius: 'var(--radius-xl)', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
           <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(51,204,204,0.1)', color: 'var(--primary)', display: 'grid', placeItems: 'center' }}>
              <span className="material-symbols-outlined">filter_list</span>
           </div>
           <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Filtros Operacionais</h4>
              <p style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Refine por status ou responsável</p>
           </div>
        </div>

        <div className="desktop-only" style={{ height: '32px', width: '1px', background: 'var(--glass-border)' }}></div>

        <div className="segmented-control glass" style={{ display: 'flex', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          <button 
             className={`dash-micro-badge ${!showGantt ? 'glass active' : ''}`} 
             onClick={() => setShowGantt(false)}
             style={{ border: 'none', cursor: 'pointer', padding: '8px 16px', background: !showGantt ? 'var(--primary)' : 'transparent', color: !showGantt ? 'var(--primary-txt)' : 'var(--muted)' }}
          >
            Quadro
          </button>
          <button 
             className={`dash-micro-badge ${showGantt ? 'glass active' : ''}`} 
             onClick={() => setShowGantt(true)}
             style={{ border: 'none', cursor: 'pointer', padding: '8px 16px', background: showGantt ? 'var(--primary)' : 'transparent', color: showGantt ? 'var(--primary-txt)' : 'var(--muted)' }}
          >
            Gantt
          </button>
        </div>

        <div className="desktop-only" style={{ height: '32px', width: '1px', background: 'var(--glass-border)' }}></div>

        <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '200px' }}>
          <select
            value={localDemandaStatusFilter}
            onChange={e => setLocalDemandaStatusFilter(e.target.value)}
            style={{ border: 'none', background: 'transparent', color: 'var(--title)', fontSize: '0.9rem', fontWeight: 500, outline: 'none', width: '100%', cursor: 'pointer' }}
          >
            <option value=''>Todos os status de demanda</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="desktop-only" style={{ height: '32px', width: '1px', background: 'var(--glass-border)' }}></div>

        <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '200px' }}>
          <select
            value={demandaResponsibleFilter}
            onChange={e => setDemandaResponsibleFilter(e.target.value)}
            style={{ border: 'none', background: 'transparent', color: 'var(--title)', fontSize: '0.9rem', fontWeight: 500, outline: 'none', width: '100%', cursor: 'pointer' }}
          >
            <option value=''>Todos os responsáveis</option>
            {(dbEmployees || []).map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>

        {(localDemandaStatusFilter || demandaResponsibleFilter) && (
          <button
            className="dash-micro-badge glass"
            onClick={() => { setLocalDemandaStatusFilter(''); setDemandaResponsibleFilter(''); }}
            style={{ borderRadius: 'var(--radius-md)', padding: '8px 16px', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>filter_alt_off</span>
            <span>Limpar</span>
          </button>
        )}
      </div>


      <div className="glass-card" style={{ marginBottom: '24px', padding: '24px', borderRadius: 'var(--radius-xl)' }}>
        <div className="section-title" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>list_alt</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Demandas em Foco</h3>
          </div>
          <button className="dash-micro-badge glass" onClick={onAddDemanda} style={{ cursor: 'pointer', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>folder_add</span>
            <span style={{ fontWeight: 700 }}>Nova Demanda</span>
          </button>
        </div>
        
        <div className="horizontal-scroll-container">
          <table className="custom-table demandas-table" style={{ borderSpacing: '0 4px', tableLayout: 'fixed', width: 'max-content', minWidth: '100%', borderCollapse: 'separate' }}>
            <thead>
              <tr style={{ background: 'var(--table-header-bg)' }}>
                <th style={{ width: '40px', textAlign: 'center' }}></th>
                <ResizableHeader 
                  label="Nome da Demanda" 
                  idPrefix="demand-"
                  width={demandColWidths.title} 
                  onResize={(w) => setDemandColWidths(prev => ({ ...prev, title: w }))} 
                />
                <ResizableHeader 
                  label="Responsável" 
                  idPrefix="demand-"
                  width={demandColWidths.owner} 
                  onResize={(w) => setDemandColWidths(prev => ({ ...prev, owner: w }))} 
                />
                <ResizableHeader 
                  label="Cronograma" 
                  idPrefix="demand-"
                  width={demandColWidths.dates} 
                  onResize={(w) => setDemandColWidths(prev => ({ ...prev, dates: w }))} 
                />
                <ResizableHeader 
                  label="Progresso" 
                  idPrefix="demand-"
                  width={demandColWidths.progress} 
                  onResize={(w) => setDemandColWidths(prev => ({ ...prev, progress: w }))} 
                />
                <ResizableHeader 
                  label="Status" 
                  idPrefix="demand-"
                  width={demandColWidths.status} 
                  onResize={(w) => setDemandColWidths(prev => ({ ...prev, status: w }))} 
                />
                <th style={{ width: '60px', textAlign: 'center', fontSize: '0.7rem', color: 'var(--title)', fontWeight: 800, textTransform: 'uppercase' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredDemandas.map(d => {
                const demandaId = d.Id || d.id;
                const dTasks = tasks.filter(t => t.demandaId === demandaId);
                const doneCount = dTasks.filter(t => t.status === 'Concluído').length;
                const totalCount = dTasks.length;
                const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
                const isSelected = selectedDemandaId === demandaId;
                const dStatus = d.Status || d.status || 'Não Iniciado';
                const owner = dbEmployees?.find(e => e.id == (d.ResponsavelId || d.responsavelId));

                const taskStarts = dTasks.filter(t => t.startDate).map(t => t.startDate).sort();
                const taskEnds = dTasks.filter(t => t.endDate).map(t => t.endDate).sort();

                const realStart = taskStarts.length > 0 ? taskStarts[0] : null;
                const realEnd = (dStatus === 'Concluído' || dStatus === 'Cancelado') && taskEnds.length > 0 ? taskEnds[taskEnds.length - 1] : null;

                const pStart = d.inicioPlanjado || d.InicioPlanjado;
                const pEnd = d.fimPlanejado || d.FimPlanejado;

                return (
                  <tr 
                    key={demandaId} 
                    className={isSelected ? 'active' : ''} 
                    onClick={() => toggleDemandaFilter(demandaId)}
                  >
                    <td style={{ textAlign: 'center', padding: '12px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: isSelected ? 'var(--primary)' : 'var(--muted)', verticalAlign: 'middle' }}>
                        {isSelected ? 'folder_open' : 'folder_special'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--title)', padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.Titulo || d.titulo}>
                          {d.Titulo || d.titulo}
                        </div>
                        {(d.Descricao || d.descricao) && (
                          <span 
                            className="material-symbols-outlined" 
                            style={{ fontSize: '16px', color: 'var(--primary)', cursor: 'help' }}
                            title={d.Descricao || d.descricao}
                          >
                            info
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img 
                          src={owner?.avatarUrl || `https://ui-avatars.com/api/?name=${owner?.name || 'User'}&background=random`} 
                          style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--line)' }} 
                        />
                        <span style={{ fontSize: '.8rem', fontWeight: 600 }}>{owner?.name?.split(' ')[0] || 'Sem resp.'}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '.7rem' }}>
                        <div style={{ fontWeight: 800, color: 'var(--title)' }}>{pStart ? formatDate(pStart) : '—'}</div>
                        <div style={{ fontWeight: 800, color: 'var(--title)', opacity: 0.7 }}>{pEnd ? formatDate(pEnd) : '—'}</div>
                        {(realStart || realEnd) && <div style={{ color: 'var(--muted)', fontSize: '.6rem', marginTop: '2px' }}>Real: {realStart ? formatDate(realStart).slice(0,5) : '—'}..{realEnd ? formatDate(realEnd).slice(0,5) : '—'}</div>}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="mini-progress-track" style={{ flex: 1, height: '6px', background: 'var(--line)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                          <div className="mini-progress-fill" style={{ width: `${progressPct}%`, height: '100%', background: progressPct === 100 ? '#10b981' : 'var(--primary)', transition: 'width 0.5s ease' }}></div>
                        </div>
                        <span style={{ fontSize: '.75rem', fontWeight: 800, minWidth: '35px' }}>{progressPct}%</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px' }}>
                      <select
                        className="status-pill-select"
                        value={dStatus}
                        onChange={e => { e.stopPropagation(); handleDemandaStatusChange(d, e.target.value); }}
                        onClick={e => e.stopPropagation()}
                        style={{ ...statusSelectStyle(dStatus), fontSize: '.72rem', borderRadius: 'var(--radius-lg)', padding: '4px 12px', width: '100%' }}
                      >
                        {demandStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        {(currentUser?.isAdmin || String(d.CriadoPor || d.criadorId) === String(currentUser?.colaboradorId)) && (
                          <>
                            <button 
                              className="icon-btn" 
                              onClick={(e) => { e.stopPropagation(); handleEditDemanda(d); }}
                              style={{ padding: '4px', color: 'var(--primary)', background: 'transparent' }}
                              title="Editar Demanda"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                            </button>
                            <button 
                              className="icon-btn danger" 
                              onClick={(e) => { e.stopPropagation(); handleDeleteDemanda(d); }}
                              style={{ padding: '4px', color: '#ef4444', background: 'transparent' }}
                              title="Excluir Demanda"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>


      {/* Barra de filtros locais do módulo de TAREFAS */}
      <div className="glass-card tasks-filter-bar" style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '24px', padding: '16px 24px', borderRadius: 'var(--radius-lg)', position: 'relative', zIndex: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
           <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>task_alt</span>
           <span style={{ fontSize: '.85rem', fontWeight: 700 }}>Tarefas</span>
        </div>
        
        <div style={{ height: '24px', width: '1px', background: 'var(--glass-border)' }}></div>

        <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <select
            value={taskStatusFilter}
            onChange={e => setTaskStatusFilter(e.target.value)}
            style={{ background: 'transparent', color: 'var(--title)', fontSize: '0.85rem', fontWeight: 500, outline: 'none', width: '100%', cursor: 'pointer', border: 'none' }}
          >
            <option value=''>Todos os status de tarefa</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ height: '24px', width: '1px', background: 'var(--glass-border)' }}></div>

        <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <select
            value={taskResponsibleFilter}
            onChange={e => setTaskResponsibleFilter(e.target.value)}
            style={{ background: 'transparent', color: 'var(--title)', fontSize: '0.85rem', fontWeight: 500, outline: 'none', width: '100%', cursor: 'pointer', border: 'none' }}
          >
            <option value=''>Todos os responsáveis</option>
            {(dbEmployees || []).map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>

        {(taskStatusFilter || taskResponsibleFilter) && (
          <button
            className="dash-micro-badge glass"
            onClick={() => { setTaskStatusFilter(''); setTaskResponsibleFilter(''); }}
            style={{ height: '32px', borderRadius: 'var(--radius-sm)', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', padding: '0 12px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>filter_alt_off</span>
          </button>
        )}
      </div>

      {showGantt ? renderGantt() : (
        <div className="glass-card" style={{ padding: '24px', borderRadius: 'var(--radius-xl)', marginBottom: '24px' }}>
          <div className="section-title" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>view_list</span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Lista de Entregas</h3>
            </div>
            <button className="dash-micro-badge glass" onClick={() => onAddTask('Não Iniciado')} style={{ cursor: 'pointer', background: 'var(--primary)', color: 'var(--primary-txt)', padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', fontSize: '0.85rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_task</span>
              <span style={{ fontWeight: 700 }}>Nova Tarefa</span>
            </button>
          </div>

          <div className="horizontal-scroll-container">
            <table className="custom-table tasks-table" style={{ borderSpacing: '0 4px', tableLayout: 'fixed', width: 'max-content', minWidth: '100%', borderCollapse: 'separate' }}>
              <thead>
                <tr>
                  <ResizableHeader label="Tarefa" idPrefix="task-" width={taskColWidths.title} onResize={w => setTaskColWidths(c => ({ ...c, title: w }))} />
                  <ResizableHeader label="Demanda" idPrefix="task-" width={taskColWidths.demanda} onResize={w => setTaskColWidths(c => ({ ...c, demanda: w }))} />
                  <ResizableHeader label="Responsável" idPrefix="task-" width={taskColWidths.owner} onResize={w => setTaskColWidths(c => ({ ...c, owner: w }))} />
                  <ResizableHeader label="Prioridade" idPrefix="task-" width={taskColWidths.priority} onResize={w => setTaskColWidths(c => ({ ...c, priority: w }))} className="text-center" />
                  <ResizableHeader label="Status" idPrefix="task-" width={taskColWidths.status} onResize={w => setTaskColWidths(c => ({ ...c, status: w }))} className="text-center" />
                  <ResizableHeader label="Cronograma" idPrefix="task-" width={taskColWidths.dates} onResize={w => setTaskColWidths(c => ({ ...c, dates: w }))} className="text-center" />
                  <th style={{ width: '100px', fontSize: '.7rem', textAlign: 'center', color: 'var(--title)', fontWeight: 800, textTransform: 'uppercase' }}>Dias úteis</th>
                  <ResizableHeader label="Ações" idPrefix="task-" width={taskColWidths.actions} onResize={w => setTaskColWidths(c => ({ ...c, actions: w }))} className="text-center" />
                </tr>
              </thead>
              <tbody>
                {filteredTasks
                  .filter(task => !selectedDemandaId || task.demandaId === selectedDemandaId)
                  .map(task => {
                    const availableDays = calculateAvailableDays(task.ownerId, task.startDate, task.endDate);
                    const isOverloaded = task.startDate && task.endDate && availableDays === 0;
                    const emp = dbEmployees?.find(e => e.id === task.ownerId) || dbEmployees?.[0] || {};
  
                    return (
                      <tr key={task.localKey || task.id}>
                        <td className="title-wrap-cell">
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <textarea
                              value={task.title}
                              onChange={(e) => updateTask(task.id, 'title', e.target.value)}
                              onBlur={() => {
                                const t = tasks.find(x => x.id === task.id);
                                if (t) syncTask(t);
                              }}
                              className="glass"
                              placeholder="Título da tarefa..."
                              rows={1}
                              onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                              style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontWeight: 600, padding: '4px 28px 4px 4px', borderRadius: '4px', fontSize: '0.8rem', resize: 'none', overflow: 'hidden', minHeight: '24px' }}
                            />
                            <button 
                              onClick={() => setTaskDescriptionModal({ taskId: task.id, description: task.description || '' })}
                              style={{ position: 'absolute', right: '4px', background: 'transparent', border: 'none', color: task.description ? 'var(--primary)' : 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: task.description ? 1 : 0.5 }}
                              title={task.description || "Adicionar descrição..."}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                {task.description ? 'description' : 'add_comment'}
                              </span>
                            </button>
                          </div>
                        </td>
                        <td>
                          <select
                            value={task.demandaId || ''}
                            onChange={e => updateTask(task.id, 'demandaId', e.target.value ? Number(e.target.value) : null)}
                            className="glass"
                            style={{ width: '100%', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', fontSize: '.75rem', padding: '6px', background: 'transparent', color: 'var(--title)' }}
                          >
                            <option value="">Sem demanda</option>
                            {(demandas || []).map(d => <option key={d.Id || d.id} value={d.Id || d.id}>{d.Titulo || d.titulo}</option>)}
                          </select>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <img src={emp?.avatarUrl || `https://ui-avatars.com/api/?name=${emp?.name || 'User'}&background=random`} style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--glass-border)' }} />
                            <select
                              value={task.ownerId}
                              onChange={(e) => updateTask(task.id, 'ownerId', Number(e.target.value))}
                              className="glass"
                              style={{ flex: 1, border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', fontSize: '.7rem', padding: '4px', background: 'transparent', color: 'var(--title)' }}
                            >
                              {dbEmployees?.map(e => (
                                <option key={e.id} value={e.id}>{e.name.split(' ')[0]}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="text-center">
                          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                            <select
                              className="status-pill-select"
                              value={task.priority}
                              onChange={e => updateTask(task.id, 'priority', e.target.value)}
                              style={{ ...prioritySelectStyle(task.priority), maxWidth: '100px' }}
                            >
                              {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </div>
                        </td>
                        <td className="text-center" style={{ width: `${taskColWidths.status}px` }}>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <div style={{ position: 'relative', width: '100%', maxWidth: '110px', height: '32px' }}>
                              <div 
                                className="status-pill-select" 
                                style={{ 
                                  ...statusSelectStyle(task.status), 
                                  padding: '4px 16px',
                                  position: 'absolute', 
                                  inset: 0, 
                                  pointerEvents: 'none', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  borderRadius: 'var(--radius-lg)', 
                                  fontSize: '0.72rem', 
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden'
                                }}
                              >
                                {taskColWidths.status < 95 ? STATUS_INITIALS[task.status] : task.status}
                              </div>
                              <select
                                value={task.status}
                                onChange={e => handleStatusChange(task, e.target.value)}
                                style={{ 
                                  position: 'absolute', 
                                  inset: 0, 
                                  opacity: 0, 
                                  cursor: 'pointer', 
                                  width: '100%',
                                  height: '100%'
                                }}
                              >
                                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                          </div>
                        </td>
                        <td className="text-center" style={{ minWidth: '110px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                            <input 
                              type="date" 
                              value={task.startDate ? task.startDate.slice(0, 10) : ''} 
                              onChange={(e) => updateTask(task.id, 'startDate', e.target.value)} 
                              className="table-date-input"
                            />
                            <input 
                              type="date" 
                              value={task.endDate ? task.endDate.slice(0, 10) : ''} 
                              onChange={(e) => updateTask(task.id, 'endDate', e.target.value)} 
                              className="table-date-input"
                            />
                          </div>
                        </td>
                        <td className="text-center">
                          {task.startDate && task.endDate ? (
                            <span className={`dash-micro-badge glass ${isOverloaded ? 'stuck' : 'done'}`} style={{ fontWeight: 700 }}>
                              {availableDays}d
                            </span>
                          ) : '-'}
                        </td>
                        <td className="text-center">
                          <button className="icon-btn" onClick={() => deleteTask(task.id)} style={{ color: '#ef4444' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {/* Legenda de Status Estratégica */}
          {Object.values(taskColWidths).some(w => w < 95) && (
            <div className="status-legend" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '20px', padding: '14px 20px', borderRadius: 'var(--radius-md)', background: 'var(--panel-strong)', border: '1px solid var(--line)', animation: 'fadeIn 0.3s ease' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', marginRight: '8px', display: 'flex', alignItems: 'center' }}>Legenda de Status:</div>
              {Object.entries(STATUS_INITIALS).map(([full, init]) => (
                <div key={init} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ ...statusSelectStyle(full), width: '24px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800 }}>{init}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--title)', fontWeight: 600 }}>{full}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {statusModal && (
        <div className="status-modal-overlay">
          <div className="status-modal resizable-modal" style={{ width: '480px', maxHeight: '90vh' }}>
            <div className="modal-body-scroll" style={{ padding: '28px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '24px' }}>swap_horiz</span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Transição de Status</h3>
              </div>
              
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '20px', lineHeight: '1.5' }}>
                Alterando para: <strong style={{ color: 'var(--primary)', fontWeight: 700 }}>{statusModal.newStatus}</strong>
              </p>
              
              <div className="field" style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Comentário / Justificativa</label>
                <textarea
                  value={statusComment}
                  onChange={e => setStatusComment(e.target.value)}
                  placeholder="Ex: Aguardando aprovação técnica final..."
                  style={{ width: '100%', minHeight: '100px', background: 'var(--panel-strong)', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', padding: '12px', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
                <button className="btn-secondary" onClick={() => setStatusModal(null)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>Voltar</button>
                <button className="btn-primary" onClick={confirmStatusChange} style={{ padding: '10px 28px', borderRadius: 'var(--radius-sm)', fontWeight: 700, background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-2) 100%)', border: 'none', color: '#fff' }}>Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Task Description Modal */}
      {taskDescriptionModal && (
        <div className="status-modal-overlay">
          <div className="status-modal glass" style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--title)', margin: 0 }}>Descrição da Tarefa</h3>
              <button onClick={() => setTaskDescriptionModal(null)} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '8px', display: 'block' }}>Detalhamento</label>
              <textarea 
                value={taskDescriptionModal.description} 
                onChange={(e) => setTaskDescriptionModal({ ...taskDescriptionModal, description: e.target.value })}
                placeholder="Insira detalhes sobre esta tarefa..."
                style={{ width: '100%', minHeight: '150px', background: 'var(--panel-strong)', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', padding: '12px', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setTaskDescriptionModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => {
                const updatedTask = tasks.find(t => t.id === taskDescriptionModal.taskId);
                if (updatedTask) {
                  const taskWithDesc = { ...updatedTask, description: taskDescriptionModal.description };
                  updateTask(taskDescriptionModal.taskId, 'description', taskDescriptionModal.description);
                  syncTask(taskWithDesc);
                }
                setTaskDescriptionModal(null);
              }}>Salvar Descrição</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
