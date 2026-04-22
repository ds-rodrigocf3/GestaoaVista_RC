function TaskView({ tasks, setTasks, employees: initialEmployees, requests, demandas, setDemandas, currentUser, authToken, globalFilters }) {
  const [dbEmployees, setDbEmployees] = useState(initialEmployees || []);
  const holidays = useMemo(() => getBrazilianHolidays(2026), []);
  const [statusModal, setStatusModal] = useState(null); // {taskId, newStatus, oldStatus}
  const [statusComment, setStatusComment] = useState('');
  const [demandaModal, setDemandaModal] = useState(null); // { id, titulo, responsavelId, inicioPlanjado, fimPlanejado }

  // Novos filtros locais
  const [taskStatusFilter, setTaskStatusFilter] = useState('');
  const [taskResponsibleFilter, setTaskResponsibleFilter] = useState('');
  const [localDemandaStatusFilter, setLocalDemandaStatusFilter] = useState('');
  const [demandaResponsibleFilter, setDemandaResponsibleFilter] = useState('');

  // Largura das colunas (não persistente conforme solicitado)
  // Largura das colunas (otimizadas para 100% da tela sem scroll)
  const [taskColWidths, setTaskColWidths] = useState({ title: 240, demanda: 150, owner: 140, priority: 100, status: 110, dates: 160, actions: 60 });
  const [demandColWidths, setDemandColWidths] = useState({ title: 280, owner: 140, status: 110, priority: 100, progress: 120, dates: 160, actions: 100 });
  
  // Tamanho do modal dinâmico
  const [modalSize, setModalSize] = useState({ width: 800, height: 600 });


  useEffect(() => {
    fetch(`${API_BASE}/api/employees`, { headers: apiHeaders(authToken) })
      .then(res => res.json())
      .then(data => setDbEmployees(data || []))
      .catch(err => console.error('Failed to fetch employees in TaskView', err));
  }, [authToken]);

  const getSubordinateIds = useCallback((allEmps, managerId) => {
    const direct = allEmps.filter(e => String(e.gestorId) === String(managerId));
    let ids = direct.map(e => e.id);
    direct.forEach(sub => {
      ids = [...ids, ...getSubordinateIds(allEmps, sub.id)];
    });
    return Array.from(new Set(ids));
  }, []);

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    
    let list = tasks;

    // Filtros locais (Avançados)
    if (taskStatusFilter) list = list.filter(t => t.status === taskStatusFilter);
    if (taskResponsibleFilter) list = list.filter(t => String(t.ownerId) === String(taskResponsibleFilter));

    if (!globalFilters) return list;

    return list.filter(task => {
      const emp = dbEmployees?.find(e => String(e.id) === String(task.ownerId));
      if (!emp) return true;

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


  const statuses = ['Não Iniciado', 'Em Andamento', 'Concluído', 'Pausado', 'Bloqueio', 'Cancelado'];
  const priorities = ['Baixa', 'Média', 'Alta', 'Crítica'];
  const demandStatuses = ['Não Iniciado', 'Em Andamento', 'Concluído', 'Pausado', 'Bloqueio', 'Cancelado'];

  const cycleValue = (current, array) => {
    const idx = array.indexOf(current);
    return array[(idx + 1) % array.length];
  };

  const syncTask = (task) => {
    // Se a tarefa tem ID real (positivo), faz o UPDATE (PUT)
    if (task.id && task.id > 0) {
      const payload = { title: task.title, ownerId: task.ownerId, status: task.status, priority: task.priority, startDate: task.startDate, endDate: task.endDate, demandaId: task.demandaId || null };
      fetch(`${API_BASE}/api/tasks/${task.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...apiHeaders(authToken) }, body: JSON.stringify(payload)
      }).catch(err => console.log('Sync error (PUT)', err));
    } 
    // Se a tarefa tem ID temporário (negativo) e agora tem DEMANDA, faz o CREATE (POST)
    else if (task.id && task.id < 0 && task.demandaId) {
      const payload = { title: task.title, ownerId: task.ownerId, status: task.status, priority: task.priority, startDate: task.startDate, endDate: task.endDate, demandaId: task.demandaId };
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
  };

  const updateTask = (id, field, value) => {
    let updatedTask = null;
    setTasks(prev => {
      const next = prev.map(t => {
        if (t.id === id) {
          updatedTask = { ...t, [field]: value };
          return updatedTask;
        }
        return t;
      });
      return next;
    });

    // Use a slight timeout to send the updated state values (especially important for async render)
    setTimeout(() => {
      setTasks(current => {
        const t = current.find(x => x.id === id);
        if (t && (field === 'status' || field === 'priority' || field === 'startDate' || field === 'endDate' || field === 'title' || field === 'ownerId')) {
          syncTask(t);
        }
        return current;
      });
    }, 100);
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
      const dateKey = currentDate.toISOString().slice(0, 10);
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

  const [showGantt, setShowGantt] = useState(false);
  const [ganttScale, setGanttScale] = useState('month');
  const [ganttBaseDate, setGanttBaseDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [selectedDemandaId, setSelectedDemandaId] = useState(null);
  const [demandaStatusFilter, setDemandaStatusFilter] = useState('');

  const filteredDemandas = useMemo(() => {
    if (!demandas) return [];
    
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


  const handleAdd = () => {
    const payload = {
      title: '',
      ownerId: dbEmployees?.length > 0 ? (currentUser?.colaboradorId || dbEmployees[0].id) : '',
      status: 'Não Iniciado',
      priority: 'Baixa',
      startDate: null,
      endDate: null,
      demandaId: selectedDemandaId || null
    };

    // Gera ID clientside temporário negativo
    const tempId = -(Date.now());

    // Adiciona apenas à UI. O syncTask cuidará de persistir via POST assim que houver demandaID.
    setTasks(prev => [...prev, { id: tempId, ...payload }]);
    
    // Se já houver uma demanda selecionada no filtro global, tenta sincronizar imediatamente
    if (payload.demandaId) {
      setTimeout(() => {
        setTasks(current => {
           const t = current.find(x => x.id === tempId);
           if (t) syncTask(t);
           return current;
        });
      }, 200);
    }
  };

  const handleStatusChange = (task, newStatus) => {
    if (newStatus === task.status) return;
    setStatusModal({ taskId: task.id, newStatus, oldStatus: task.status });
    setStatusComment('');
  };

  const confirmStatusChange = () => {
    if (!statusModal) return;
    const { taskId, newStatus, oldStatus } = statusModal;
    updateTask(taskId, 'status', newStatus);
    setTimeout(() => {
      setTasks(current => {
        const t = current.find(x => x.id === taskId);
        if (t) {
          const payload = {
            ...t, status: newStatus, comentarioStatus: statusComment,
            registrarHistorico: true, statusAnterior: oldStatus,
            usuarioId: currentUser?.userId
          };
          fetch(`${API_BASE}/api/tasks/${taskId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
          }).catch(() => { });

          // Business rule: Auto-start demand when a task becomes active
          const activeStatuses = ['Em Andamento', 'Pausado', 'Bloqueio'];
          if (activeStatuses.includes(newStatus) && t.demandaId) {
            const linkedDemanda = demandas.find(d => (d.Id || d.id) === t.demandaId);
            if (linkedDemanda && (linkedDemanda.Status || linkedDemanda.status) === 'Não Iniciado') {
              handleDemandaStatusChange(linkedDemanda, 'Em Andamento', true);
            }
          }
        }
        return current;
      });
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
      body: JSON.stringify({ titulo: demanda.Titulo || demanda.titulo, status: newStatus, prioridade: demanda.Prioridade || demanda.prioridade, registrarHistorico: true, statusAnterior: oldStatus })
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
        responsavelAnterior: form.responsavelAnterior,
        inicioAnterior: form.inicioAnterior,
        fimAnterior: form.fimAnterior,
        justificativa: form.justificativa
      })
    })
    .then(async res => {
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        // Se não for JSON, mostra o começo do HTML retornado para diagnóstico.
        throw new Error(`Resposta do servidor não é JSON (HTTP ${res.status}): ${text.substring(0, 100)}...`);
      }
      
      if (!res.ok) throw new Error(data.error || 'Falha no servidor');
      return data;
    })
    .then(data => {
      if (method === 'POST') {
        const newDemanda = { 
          Id: data.id, id: data.id, 
          Titulo: form.titulo, titulo: form.titulo, 
          ResponsavelId: form.responsavelId ? Number(form.responsavelId) : null, 
          Status: form.status || 'Não Iniciado', status: form.status || 'Não Iniciado', 
          Prioridade: form.prioridade || 'Média', prioridade: form.prioridade || 'Média', 
          InicioPlanjado: form.inicioPlanjado || null, inicioPlanjado: form.inicioPlanjado || null, 
          FimPlanejado: form.fimPlanejado || null, fimPlanejado: form.fimPlanejado || null, 
          TotalTarefas: 0, TarefasConcluidas: 0 
        };
        setDemandas(prev => [newDemanda, ...prev]);
      } else {
        setDemandas(prev => prev.map(d => (d.Id || d.id) === form.id ? { ...d, ...form, Titulo: form.titulo, ResponsavelId: Number(form.responsavelId), Status: form.status, Prioridade: form.prioridade, InicioPlanjado: form.inicioPlanjado, FimPlanejado: form.fimPlanejado } : d));
      }
      setDemandaModal(null);
    })
    .catch(err => {
      console.error('Save Demand Error:', err);
      alert('Erro ao salvar demanda: ' + err.message);
    });
  };

  const handleNewDemanda = () => {
    setDemandaModal({ titulo: '', responsavelId: currentUser?.colaboradorId || null, inicioPlanjado: '', fimPlanejado: '', status: 'Não Iniciado', prioridade: 'Média' });
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
      <div className="gantt-container" style={{ marginTop: '20px', background: '#fff', borderRadius: '8px', padding: '16px', border: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--muted)' }}>calendar_today</span>
            <input type="date" className="monday-date-input" value={ganttBaseDate} onChange={e => setGanttBaseDate(e.target.value)} title="Data de início" style={{ border: '1px solid var(--line)', borderRadius: '6px', padding: '4px 8px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--muted)' }}>aspect_ratio</span>
            <select className="monday-select" value={ganttScale} onChange={e => setGanttScale(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: '6px', padding: '4px 8px' }}>
              <option value="week">Semana (7 dias)</option>
              <option value="month">Mês (30 dias)</option>
              <option value="quarter">Trimestre (90 dias)</option>
            </select>
          </div>
          {selectedDemandaId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(51,204,204,.12)', padding: '4px 12px', borderRadius: '20px', fontSize: '.8rem', color: 'var(--primary)', fontWeight: 600 }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>filter_alt</span>
              Filtrando por demanda
              <span style={{ cursor: 'pointer', marginLeft: '4px' }} onClick={() => setSelectedDemandaId(null)} title="Limpar filtro">✕</span>
            </div>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #eee', paddingBottom: '8px', minWidth: 'min-content' }}>
            <div style={{ minWidth: '220px', width: '220px', fontWeight: 'bold', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>Tarefas</div>
            {days.map((d, i) => (
              <div key={i} className={`gantt-day-header ${ganttScale === 'quarter' ? 'rotated' : ''}`} style={{ minWidth: `${colWidth}px`, width: `${colWidth}px`, textAlign: 'center', fontSize: '10px', color: 'var(--muted)', borderLeft: i % 7 === 0 && ganttScale !== 'week' ? '1px solid #f0f0f0' : 'none' }}>
                {d.getDate()}/{d.getMonth() + 1}
              </div>
            ))}
          </div>
          {filteredTasks.length === 0 && <div className="empty-state">Sem tarefas correspondentes aos filtros.</div>}
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
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', marginTop: '8px', borderBottom: '1px solid #f9f9f9', paddingBottom: '4px' }}>
                <div style={{ minWidth: '220px', width: '220px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>
                  {employee.AvatarUrl || employee.avatarUrl ? <img src={employee.AvatarUrl || employee.avatarUrl} loading="lazy" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} alt="Avatar" /> : <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: employee.color || '#ccc' }} />}
                  {t.title || 'Sem título'}
                </div>
                <div style={{ display: 'flex', position: 'relative', height: '20px', flex: 1, minWidth: `${daysCount * colWidth}px` }}>
                  {isVisible && (
                    <div style={{
                      position: 'absolute',
                      left: `${isVisible.left}px`,
                      width: `${isVisible.width}px`,
                      height: '16px',
                      background: employee.color || '#3b82f6',
                      borderRadius: '4px',
                      top: '2px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }} title={`${t.title} (${t.startDate} a ${t.endDate})`}>
                      <span className="gantt-bar-label">{t.title}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Status/Priority select background color helpers
  const statusSelectStyle = (s) => {
    const map = { 'Concluído': '#00b461', 'Em Andamento': '#fdab3d', 'Bloqueio': '#e2445c', 'Pausado': '#579bfc', 'Cancelado': '#94a3b8', 'Não Iniciado': '#c4c4c4' };
    return { background: map[s] || '#c4c4c4', color: s === 'Não Iniciado' ? '#333' : '#fff' };
  };
  const prioritySelectStyle = (p) => {
    const map = { 'Crítica': '#e2445c', 'Alta': '#784bd1', 'Média': '#579bfc', 'Baixa': '#c4c4c4' };
    return { background: map[p] || '#c4c4c4', color: p === 'Baixa' ? '#555' : '#fff', fontWeight: 700, fontSize: '.78rem', border: 'none', borderRadius: '4px', padding: '6px 8px', cursor: 'pointer', textAlign: 'center', width: '100%', textTransform: 'uppercase', letterSpacing: '.03em' };
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
            
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '20px' }}>
              <h3 style={{ marginBottom: '20px' }}>{demandaModal.id ? 'Editar Demanda' : 'Nova Demanda'}</h3>

              <div className="field">
                <label>Título da Demanda</label>
                <input value={demandaModal.titulo} onChange={e => setDemandaModal({ ...demandaModal, titulo: e.target.value })} placeholder="Ex: Projeto Expansão Norte" />
              </div>

              <div className="field">
                <label>Responsável</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                  <select value={demandaModal.responsavelId || ''} onChange={e => setDemandaModal({ ...demandaModal, responsavelId: e.target.value })}>
                    <option value="">Selecione um responsável...</option>
                    {dbEmployees?.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                  {demandaModal.responsavelId && (
                    <img
                      src={dbEmployees?.find(e => e.id == demandaModal.responsavelId)?.avatarUrl || `https://ui-avatars.com/api/?name=${dbEmployees?.find(e => e.id == demandaModal.responsavelId)?.name}&background=random`}
                      className="avatar-preview-circle"
                      style={{ width: '40px', height: '40px' }}
                    />
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                <div className="field">
                  <label>Início Planejado</label>
                  <input type="date" value={demandaModal.inicioPlanjado} onChange={e => setDemandaModal({ ...demandaModal, inicioPlanjado: e.target.value })} />
                </div>
                <div className="field">
                  <label>Término Planejado</label>
                  <input type="date" value={demandaModal.fimPlanejado} onChange={e => setDemandaModal({ ...demandaModal, fimPlanejado: e.target.value })} />
                </div>
              </div>

              {demandaModal.id && (
                (demandaModal.responsavelId != demandaModal.responsavelAnterior) ||
                (demandaModal.inicioPlanjado != (demandaModal.inicioAnterior ? demandaModal.inicioAnterior.slice(0, 10) : '')) ||
                (demandaModal.fimPlanjado != (demandaModal.fimAnterior ? demandaModal.fimAnterior.slice(0, 10) : ''))
              ) && (
                  <div className="field" style={{ marginTop: '16px', animation: 'fadeIn 0.3s ease' }}>
                    <label style={{ color: 'var(--primary)', fontWeight: 700 }}>Justificativa da Alteração (Obrigatório)</label>
                    <textarea
                      style={{ minHeight: '60px', borderColor: 'var(--primary)' }}
                      placeholder="Descreva o motivo da mudança de responsável ou prazos..."
                      value={demandaModal.justificativa}
                      onChange={e => setDemandaModal({ ...demandaModal, justificativa: e.target.value })}
                    />
                  </div>
                )}

              <div style={{ display: 'flex', gap: '12px', marginTop: 'auto', paddingTop: '20px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setDemandaModal(null)}>Cancelar</button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const hasChanges = (demandaModal.responsavelId != demandaModal.responsavelAnterior) ||
                      (demandaModal.inicioPlanjado != (demandaModal.inicioAnterior ? demandaModal.inicioAnterior.slice(0, 10) : ''));
                    if (demandaModal.id && hasChanges && !demandaModal.justificativa?.trim()) {
                      alert('Por favor, preencha a justificativa para as alterações de responsável ou prazos.');
                      return;
                    }
                    saveDemanda(demandaModal);
                  }}
                >
                  Salvar Demanda
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {statusModal && (
        <div className="status-modal-overlay">
          <div className="status-modal">
            <h3>Mudar status para: <strong>{statusModal.newStatus}</strong></h3>
            <p>Adicione um comentário justificando a mudança de status (opcional).</p>
            <textarea
              value={statusComment}
              onChange={e => setStatusComment(e.target.value)}
              placeholder="Ex.: Pausado aguardando retorno do cliente..."
            />
            <div className="action-row">
              <button className="btn btn-secondary" onClick={() => setStatusModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmStatusChange}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <header className="topbar glass" style={{ padding: '24px', borderRadius: '20px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h2 className="premium-title" style={{ fontSize: '1.8rem' }}>Gestão de Demandas</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Centro de comando operacional: cronogramas e entregas.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="segmented-control glass" style={{ display: 'flex', padding: '4px', borderRadius: '12px' }}>
            <button 
               className={`dash-micro-badge ${!showGantt ? 'glass active' : ''}`} 
               onClick={() => setShowGantt(false)}
               style={{ border: 'none', cursor: 'pointer', padding: '8px 16px', background: !showGantt ? 'var(--primary)' : 'transparent', color: !showGantt ? 'var(--primary-txt)' : 'var(--muted)' }}
            >
              Visual Quadro
            </button>
            <button 
               className={`dash-micro-badge ${showGantt ? 'glass active' : ''}`} 
               onClick={() => setShowGantt(true)}
               style={{ border: 'none', cursor: 'pointer', padding: '8px 16px', background: showGantt ? 'var(--primary)' : 'transparent', color: showGantt ? 'var(--primary-txt)' : 'var(--muted)' }}
            >
              Visual Gantt
            </button>
          </div>
          
          <button className="dash-micro-badge glass" onClick={handleNewDemanda} style={{ cursor: 'pointer', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '10px 20px', borderRadius: '12px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>folder_add</span>
            <span style={{ fontWeight: 700 }}>Nova Demanda</span>
          </button>
          <button className="dash-micro-badge glass" onClick={handleAdd} style={{ cursor: 'pointer', background: 'var(--primary)', color: 'var(--primary-txt)', padding: '10px 20px', borderRadius: '12px', border: 'none' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add_task</span>
            <span style={{ fontWeight: 700 }}>Nova Tarefa</span>
          </button>
        </div>
      </header>

      {/* Barra de filtros locais do módulo de demandas */}
      <div className="glass-card" style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '32px', padding: '20px 28px', borderRadius: '24px', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
           <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(51,204,204,0.1)', color: 'var(--primary)', display: 'grid', placeItems: 'center' }}>
              <span className="material-symbols-outlined">filter_list</span>
           </div>
           <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Filtros Operacionais</h4>
              <p style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Refine por status ou responsável</p>
           </div>
        </div>

        <div style={{ height: '32px', width: '1px', background: 'var(--glass-border)' }}></div>

        <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <select
            value={localDemandaStatusFilter}
            onChange={e => setLocalDemandaStatusFilter(e.target.value)}
            style={{ border: 'none', background: 'transparent', color: 'var(--title)', fontSize: '0.9rem', fontWeight: 500, outline: 'none', width: '100%', cursor: 'pointer' }}
          >
            <option value=''>Todos os status de demanda</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ height: '32px', width: '1px', background: 'var(--glass-border)' }}></div>

        <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
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
            style={{ borderRadius: '12px', padding: '8px 16px', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>filter_alt_off</span>
            <span>Limpar</span>
          </button>
        )}
      </div>


      <div className="glass-card" style={{ marginBottom: '24px', padding: '24px', borderRadius: '24px' }}>
        <div className="section-title" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>list_alt</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Demandas em Foco</h3>
          </div>
        </div>
        
        <div className="horizontal-scroll-container">
          <table className="custom-table" style={{ borderSpacing: '0 4px', tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
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
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.Titulo || d.titulo}>
                        {d.Titulo || d.titulo}
                      </div>
                    </td>
                    <td onClick={(e) => { e.stopPropagation(); handleEditDemanda(d); }} style={{ cursor: 'pointer', padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img 
                          src={owner?.avatarUrl || `https://ui-avatars.com/api/?name=${owner?.name || 'User'}&background=random`} 
                          style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--line)' }} 
                        />
                        <span style={{ fontSize: '.8rem', fontWeight: 600 }}>{owner?.name?.split(' ')[0] || 'Sem resp.'}</span>
                      </div>
                    </td>
                    <td onClick={(e) => { e.stopPropagation(); handleEditDemanda(d); }} style={{ cursor: 'pointer', textAlign: 'center', padding: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '.72rem' }}>
                        <div style={{ fontWeight: 800, color: 'var(--title)' }}>{pStart ? formatDate(pStart) : '—'} a {pEnd ? formatDate(pEnd) : '—'}</div>
                        {(realStart || realEnd) && <div style={{ color: 'var(--muted)', fontSize: '.65rem', opacity: 0.8 }}>Real: {realStart ? formatDate(realStart) : '—'} a {realEnd ? formatDate(realEnd) : '—'}</div>}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="mini-progress-track" style={{ flex: 1, height: '6px', background: 'var(--line)', borderRadius: '10px', overflow: 'hidden' }}>
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
                        style={{ ...statusSelectStyle(dStatus), fontSize: '.72rem', borderRadius: '20px', padding: '4px 12px', width: '100%' }}
                      >
                        {demandStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px' }}>
                      <button 
                        className="icon-btn danger" 
                        onClick={(e) => { e.stopPropagation(); handleDeleteDemanda(d); }}
                        style={{ padding: '6px', color: '#ef4444', background: 'transparent' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>


      {/* Barra de filtros locais do módulo de TAREFAS */}
      <div className="glass-card" style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '24px', padding: '16px 24px', borderRadius: '20px', position: 'relative', zIndex: 10 }}>
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
            style={{ height: '32px', borderRadius: '10px', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', padding: '0 12px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>filter_alt_off</span>
          </button>
        )}
      </div>

      {showGantt ? renderGantt() : (
        <div className="glass-card" style={{ padding: '24px', borderRadius: '24px', marginBottom: '24px' }}>
          <div className="section-title" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>view_list</span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Lista de Entregas</h3>
            </div>
          </div>

          <div className="horizontal-scroll-container">
            <table className="custom-table" style={{ borderSpacing: '0 4px', tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
              <thead>
                <tr>
                  <ResizableHeader label="Tarefa" idPrefix="task-" width={taskColWidths.title} onResize={w => setTaskColWidths(c => ({ ...c, title: w }))} />
                  <ResizableHeader label="Demanda" idPrefix="task-" width={taskColWidths.demanda} onResize={w => setTaskColWidths(c => ({ ...c, demanda: w }))} />
                  <ResizableHeader label="Responsável" idPrefix="task-" width={taskColWidths.owner} onResize={w => setTaskColWidths(c => ({ ...c, owner: w }))} />
                  <ResizableHeader label="Prioridade" idPrefix="task-" width={taskColWidths.priority} onResize={w => setTaskColWidths(c => ({ ...c, priority: w }))} className="text-center" />
                  <ResizableHeader label="Status" idPrefix="task-" width={taskColWidths.status} onResize={w => setTaskColWidths(c => ({ ...c, status: w }))} className="text-center" />
                  <ResizableHeader label="Cronograma" idPrefix="task-" width={taskColWidths.dates} onResize={w => setTaskColWidths(c => ({ ...c, dates: w }))} className="text-center" />
                  <th style={{ width: '100px', fontSize: '.7rem', textAlign: 'center', color: 'var(--title)', fontWeight: 800, textTransform: 'uppercase' }}>Disponibilidade</th>
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
                      <tr key={task.id}>
                        <td>
                          <input
                            type="text"
                            value={task.title}
                            onChange={(e) => updateTask(task.id, 'title', e.target.value)}
                            className="glass"
                            placeholder="Título..."
                            style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}
                          />
                        </td>
                        <td>
                          <select
                            value={task.demandaId || ''}
                            onChange={e => updateTask(task.id, 'demandaId', e.target.value ? Number(e.target.value) : null)}
                            className="glass"
                            style={{ width: '100%', border: '1px solid var(--glass-border)', borderRadius: '8px', fontSize: '.75rem', padding: '6px', background: 'transparent', color: 'var(--title)' }}
                          >
                            <option value="">Sem demanda</option>
                            {(demandas || []).map(d => <option key={d.Id || d.id} value={d.Id || d.id}>{d.Titulo || d.titulo}</option>)}
                          </select>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img src={emp?.avatarUrl || `https://ui-avatars.com/api/?name=${emp?.name || 'User'}&background=random`} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--glass-border)' }} />
                            <select
                              value={task.ownerId}
                              onChange={(e) => updateTask(task.id, 'ownerId', Number(e.target.value))}
                              className="glass"
                              style={{ flex: 1, border: '1px solid var(--glass-border)', borderRadius: '8px', fontSize: '.75rem', padding: '6px', background: 'transparent', color: 'var(--title)' }}
                            >
                              {dbEmployees?.map(e => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="text-center">
                          <select
                            className="status-pill-select"
                            value={task.priority}
                            onChange={e => updateTask(task.id, 'priority', e.target.value)}
                            style={{ ...prioritySelectStyle(task.priority), padding: '6px 12px', fontSize: '.75rem', borderRadius: '20px' }}
                          >
                            {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </td>
                        <td className="text-center">
                          <select
                            className="status-pill-select"
                            value={task.status}
                            onChange={e => handleStatusChange(task, e.target.value)}
                            style={{ ...statusSelectStyle(task.status), padding: '6px 12px', fontSize: '.75rem', borderRadius: '20px' }}
                          >
                            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="text-center">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                            <input type="date" value={task.startDate} onChange={(e) => updateTask(task.id, 'startDate', e.target.value)} className="glass" style={{ border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '4px', fontSize: '.75rem', background: 'transparent', color: 'var(--title)' }} />
                            <span style={{ color: 'var(--muted)' }}>-</span>
                            <input type="date" value={task.endDate} onChange={(e) => updateTask(task.id, 'endDate', e.target.value)} className="glass" style={{ border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '4px', fontSize: '.75rem', background: 'transparent', color: 'var(--title)' }} />
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
        </div>
      )}
    </div>
  );
}
