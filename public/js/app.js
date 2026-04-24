function App() {
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = sessionStorage.getItem('gbi_user');
    try {
      if (!saved) {
        sessionStorage.removeItem('gbi_token'); // Garante que nÃ£o haja token sem usuÃ¡rio
        return null;
      }
      return JSON.parse(saved);
    } catch (e) {
      sessionStorage.removeItem('gbi_user');
      sessionStorage.removeItem('gbi_token');
      return null;
    }
  });
  const [authToken, setAuthToken] = useState(() => sessionStorage.getItem('gbi_token'));
  const [showSettings, setShowSettings] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('gbi_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [demandas, setDemandas] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [activeView, setActiveView] = useState('dashboard');
  const [requests, setRequests] = useState(initialRequests);
  const [tasks, setTasks] = useState(initialTasks);
  const [dbEmployees, setDbEmployees] = useState(employees);
  const [areas, setAreas] = useState([]);
  const [colaboradores, setColaboradores] = useState([]); 
  const [cargos, setCargos] = useState([]);
  const [hierarquia, setHierarquia] = useState([]);
  const [statusTipos, setStatusTipos] = useState([]);
  const [globalFilters, setGlobalFilters] = useState({ gestor: '', colaboradorId: '', gestorId: '' });
  const [requestedModal, setRequestedModal] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const getEmployeeById = useCallback((id) => {
    return (dbEmployees || []).find((employee) => employee.id === Number(id));
  }, [dbEmployees]);

  const buildRequestDetails = useCallback((request) => {
    if (!request) return { id: 0, employee: { name: 'InvÃ¡lido', team: '-', id: 0 }, startDate: '', endDate: '', status: 'Erro' };
    const employee = getEmployeeById(request.employeeId);
    const safeEmp = employee || { name: 'Colaborador nÃ£o identificado', team: 'Sem Ãrea', id: Number(request.employeeId || 0), avatarUrl: null };
    return {
      ...request,
      employee: safeEmp,
      totalDays: (request.startDate && request.endDate) ? diffDays(request.startDate, request.endDate) : 0
    };
  }, [getEmployeeById]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('gbi_theme', isDark ? 'dark' : 'light');
  }, [isDark]);



  const getSubordinateIds = (employees, managerId) => {
    const directSubordinates = employees.filter(e => String(e.gestorId) === String(managerId));
    let allSubordinates = directSubordinates.map(e => e.id);
    directSubordinates.forEach(sub => {
      allSubordinates = [...allSubordinates, ...getSubordinateIds(employees, sub.id)];
    });
    return Array.from(new Set(allSubordinates));
  };

  const today = new Date();
  const firstDayCurrentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const [workDays, setWorkDays] = useState({});
  const [form, setForm] = useState({ ...initialFilters, startDate: firstDayCurrentMonth });
  const [editingRequestId, setEditingRequestId] = useState(null);
  const [toast, setToast] = useState(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [requestToDelete, setRequestToDelete] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [processingApprovalId, setProcessingApprovalId] = useState(null);

  const isEmpMatch = (empId) => {
    if (!globalFilters) return true;
    const emp = dbEmployees.find(e => String(e.id) === String(empId));
    if (!emp) return true;
    if (globalFilters.colaboradorId && String(emp.id) !== String(globalFilters.colaboradorId)) return false;
    if (globalFilters.gestorId) {
      const subordinateIds = [parseInt(globalFilters.gestorId), ...getSubordinateIds(dbEmployees, globalFilters.gestorId)];
      if (!subordinateIds.includes(parseInt(emp.id))) return false;
    } else if (globalFilters.gestor) {
      if (emp.areaNome !== globalFilters.gestor && emp.manager !== globalFilters.gestor) return false;
    }
    if (globalFilters.cargo && emp.teamStr !== globalFilters.cargo && emp.team !== globalFilters.cargo && emp.cargoNome !== globalFilters.cargo) return false;
    return true;
  };

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(t => isEmpMatch(t.ownerId));
  }, [tasks, dbEmployees, globalFilters]);

  const handleLogin = (user, token) => {
    sessionStorage.setItem('gbi_user', JSON.stringify(user));
    sessionStorage.setItem('gbi_token', token);
    setCurrentUser(user);
    setAuthToken(token);
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    sessionStorage.clear();
    window.location.reload();
  };

  const fetchAll = useCallback(async (options = {}) => {
    if (!currentUser) return;
    const silent = options.silent === true;
    if (!silent) setLoading(true);
    try {
      const endpoints = [
        fetch(`${API_BASE}/api/employees`, { headers: apiHeaders(authToken) }).then(r => r.json()),
        fetch(`${API_BASE}/api/colaboradores`, { headers: apiHeaders(authToken) }).then(r => r.json()),
        fetch(`${API_BASE}/api/areas`, { headers: apiHeaders(authToken) }).then(r => r.json()),
        fetch(`${API_BASE}/api/requests`, { headers: apiHeaders(authToken) }).then(r => r.json()),
        fetch(`${API_BASE}/api/tasks`, { headers: apiHeaders(authToken) }).then(r => r.json()),
        fetch(`${API_BASE}/api/eventos`, { headers: apiHeaders(authToken) }).then(r => r.json()),
        fetch(`${API_BASE}/api/cargos`, { headers: apiHeaders(authToken) }).then(r => r.json()),
        fetch(`${API_BASE}/api/hierarquia`, { headers: apiHeaders(authToken) }).then(r => r.json()),
        fetch(`${API_BASE}/api/status-tipos`, { headers: apiHeaders(authToken) }).then(r => r.json()),
        fetch(`${API_BASE}/api/demandas`, { headers: apiHeaders(authToken) }).then(r => r.json())
      ];

      const responses = await Promise.allSettled(endpoints);
      const getResult = (idx, name) => {
        if (responses[idx].status === 'rejected') {
          console.warn(`Fetch failed for ${name}:`, responses[idx].reason);
          return null;
        }
        const val = responses[idx].value;
        if (!Array.isArray(val)) {
          console.warn(`Expected array for ${name}, got:`, val);
          return [];
        }
        return val;
      };

      const rEmployees = getResult(0, 'employees');
      const rColabs = getResult(1, 'colaboradores');
      const rAreas = getResult(2, 'areas');
      const rRequests = getResult(3, 'requests');
      const rTasks = getResult(4, 'tasks');
      const rEventos = getResult(5, 'eventos');
      const rCargos = getResult(6, 'cargos');
      const rHier = getResult(7, 'hierarquia');
      const rStatus = getResult(8, 'status-tipos');
      const rDemandas = getResult(9, 'demandas');

      if (rEmployees) setDbEmployees(rEmployees);
      if (rColabs) setColaboradores(rColabs);
      if (rAreas) setAreas(rAreas);
      if (rRequests) {
        setRequests(rRequests);
        const initialWorkDays = {};
        rRequests.forEach(r => {
          if (r.type === 'Escala de Trabalho' && r.status === 'Aprovado' && r.localTrabalho && r.startDate) {
            if (!initialWorkDays[r.employeeId]) initialWorkDays[r.employeeId] = {};
            initialWorkDays[r.employeeId][r.startDate] = r.localTrabalho;
          }
        });
        setWorkDays(initialWorkDays);
      }
      if (rTasks) {
        setTasks(rTasks.map(t => ({
          ...t,
          startDate: t.startDate ? t.startDate.slice(0, 10) : '',
          endDate: t.endDate ? t.endDate.slice(0, 10) : ''
        })));
      }
      if (rEventos) setEventos(rEventos);
      if (rCargos) setCargos(rCargos);
      if (rHier) setHierarquia(rHier);
      if (rStatus) setStatusTipos(rStatus);
      if (rDemandas) setDemandas(rDemandas);
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [authToken, currentUser]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (currentUser && !currentUser.isAdmin && currentUser.colaboradorId) {
      const colabId = String(currentUser.colaboradorId);
      if (form.employeeId !== colabId) {
        setForm(f => ({ ...f, employeeId: colabId }));
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(timer);
  }, [toast]);

  const detailedRequests = useMemo(() => {
    if (!requests || !Array.isArray(requests)) return [];
    return requests.map(buildRequestDetails).sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0));
  }, [requests, dbEmployees]);

  const filterByUserRole = useCallback((list) => {
    if (!list) return [];
    if (currentUser && !currentUser.isAdmin && currentUser.colaboradorId) {
      const subordinates = [Number(currentUser.colaboradorId), ...getSubordinateIds(dbEmployees, currentUser.colaboradorId).map(id => Number(id))];
      return list.filter(r => r && subordinates.includes(Number(r.employeeId)));
    }
    return list;
  }, [currentUser, dbEmployees]);

  const pendingRequests = useMemo(() => filterByUserRole(detailedRequests.filter(r => r.status === 'Pendente')), [detailedRequests, filterByUserRole]);
  const approvedRequests = useMemo(() => filterByUserRole(detailedRequests.filter(r => r.status === 'Aprovado')), [detailedRequests, filterByUserRole]);
  const rejectedRequests = useMemo(() => filterByUserRole(detailedRequests.filter(r => r.status === 'Rejeitado')), [detailedRequests, filterByUserRole]);

  const formEmployee = getEmployeeById(form.employeeId);
  const selectedDuration = form.startDate && form.endDate && toDate(form.endDate) >= toDate(form.startDate) ? diffDays(form.startDate, form.endDate) : 0;
  const formConflicts = useMemo(() => {
    if (!form.startDate || !form.endDate || !formEmployee) return [];
    return detailedRequests.filter((request) => {
      if (!request || request.status === 'Rejeitado') return false;
      if (request.employeeId === formEmployee.id) return false;
      if (request.employee?.team !== formEmployee?.team) return false;
      return rangesOverlap(form.startDate, form.endDate, request.startDate, request.endDate);
    });
  }, [detailedRequests, form.startDate, form.endDate, formEmployee]);

  const formConflictLevel = getConflictLevel(formConflicts);

  const stats = useMemo(() => {
    const defaultStats = { totalRequests: 0, pending: 0, approvedDays: 0, concurrentApril: 0, highRiskPending: 0 };
    if (!detailedRequests) return defaultStats;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const firstDay = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const lastDay = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`;
    const totalDaysApproved = (approvedRequests || []).reduce((acc, request) => acc + (request.totalDays || 0), 0);
    const totalTeamMembersOnLeave = new Set((approvedRequests || []).filter((request) => rangesOverlap(firstDay, lastDay, request.startDate, request.endDate)).map((request) => request.employeeId)).size;
    const highRiskPendingCount = (pendingRequests || []).filter((request) => {
      const conflicts = (approvedRequests || []).filter((approved) => approved.employee?.team === request.employee?.team && rangesOverlap(request.startDate, request.endDate, approved.startDate, approved.endDate));
      return conflicts.length >= 1;
    }).length;
    return { totalRequests: detailedRequests.length, pending: pendingRequests.length, approvedDays: totalDaysApproved, concurrentApril: totalTeamMembersOnLeave, highRiskPending: highRiskPendingCount };
  }, [approvedRequests, detailedRequests, pendingRequests]);

  const timelineItems = useMemo(() => detailedRequests.slice(0, 5).map((request) => {
    const conflictCount = detailedRequests.filter((item) => item.id !== request.id && item.employee?.team === request.employee?.team && item.status !== 'Rejeitado' && rangesOverlap(item.startDate, item.endDate, request.startDate, request.endDate)).length;
    return { ...request, conflictCount, label: conflictCount > 0 ? `Conflito com ${conflictCount} colaborador(es)` : 'Sem conflito relevante' };
  }), [detailedRequests]);

  const currentMonth = useMemo(() => toDate(form.startDate || firstDayCurrentMonth), [form.startDate]);
  const monthDays = useMemo(() => getMonthMatrix(currentMonth), [currentMonth]);

  const submitRequest = () => {
    if (!form.employeeId || !form.startDate || !form.endDate || !form.type) {
      setToast({ title: 'Campos obrigatÃ³rios', message: 'Preencha colaborador, tipo e perÃ­odo antes de enviar.' });
      return;
    }
    if (toDate(form.endDate) < toDate(form.startDate)) {
      setToast({ title: 'PerÃ­odo invÃ¡lido', message: 'A data final precisa ser igual ou posterior Ã  data inicial.' });
      return;
    }
    const empId = Number(form.employeeId);
    if (!currentUser.isAdmin && currentUser.colaboradorId !== empId) {
      setToast({ title: 'Acesso negado', message: 'VocÃª sÃ³ pode criar agendamentos para si mesmo.' });
      return;
    }
    const payload = { employeeId: empId, startDate: form.startDate, endDate: form.endDate, type: form.type, status: 'Pendente', note: form.note || 'Sem observaÃ§Ãµes adicionais.', coverage: form.coverage || 'A definir', priority: formConflicts.length >= 2 ? 'Alta' : formConflicts.length === 1 ? 'MÃ©dia' : 'Baixa' };
    const method = editingRequestId ? 'PUT' : 'POST';
    const url = editingRequestId ? `${API_BASE}/api/requests/${editingRequestId}` : `${API_BASE}/api/requests`;
    fetch(url, { method, headers: { 'Content-Type': 'application/json', ...apiHeaders(authToken) }, body: JSON.stringify(payload) })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao processar solicitaÃ§Ã£o');
        return data;
      })
      .then(data => {
        if (editingRequestId) {
          setRequests(prev => prev.map(r => Number(r.id) === Number(editingRequestId) ? { ...r, ...data } : r));
          setToast({ title: 'AlteraÃ§Ã£o salva', message: 'O agendamento foi atualizado com sucesso.' });
          setEditingRequestId(null);
        } else {
          setRequests(current => [...current, data]);
          setToast({ title: 'SolicitaÃ§Ã£o enviada', message: formConflicts.length ? `Pedido criado com ${formConflicts.length} conflitos detectados.` : 'Pedido criado com sucesso.' });
        }
        setActiveView('approvals');
      })
      .catch(err => setToast({ title: 'Erro no servidor', message: err.message, type: 'error' }));
  };

  const deleteRequest = (id) => {
    if (!id) return;
    setRequestToDelete(id);
  };

  const confirmDeleteRequest = (id) => {
    setLoading(true);
    fetch(`${API_BASE}/api/requests/${id}`, { 
      method: 'DELETE', 
      headers: apiHeaders(authToken) 
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao excluir');
        return data;
      })
      .then(() => {
        // Ensure type matching for the filter
        setRequests(prev => prev.filter(r => String(r.id) !== String(id)));
        setToast({ title: 'Excluido com sucesso', message: 'O agendamento foi removido da base de dados.' });
        setRequestToDelete(null);
      })
      .catch(err => {
        console.error('Delete error:', err);
        setToast({ title: 'Erro ao excluir', message: err.message, type: 'error' });
        setRequestToDelete(null);
      })
      .finally(() => setLoading(false));
  };

  const handleAdd = (initialStatus = 'NÃ£o Iniciado') => {
    setGlobalFilters({ gestor: '', colaboradorId: '', gestorId: '' });
    const payload = {
      title: '',
      ownerId: dbEmployees?.length > 0 ? (currentUser?.colaboradorId || dbEmployees[0].id) : '',
      status: initialStatus,
      priority: 'Baixa',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      demandaId: null
    };
    const tempId = -(Date.now());
    setTasks(prev => [...prev, { id: tempId, ...payload }]);
    if (activeView !== 'tasks') setActiveView('tasks');
  };

  const handleNewDemanda = () => {
    setRequestedModal({ type: 'demanda', data: { titulo: '', responsavelId: currentUser?.colaboradorId || null, inicioPlanjado: '', fimPlanejado: '', status: 'NÃ£o Iniciado', prioridade: 'MÃ©dia' } });
    if (activeView !== 'tasks') setActiveView('tasks');
  };

  const handleApproval = (requestId, decision) => {
    const req = detailedRequests.find(r => Number(r.id) === Number(requestId));
    if (!req) return;

    if (!currentUser.isAdmin) {
      const isOwner = Number(req.employeeId) === Number(currentUser.colaboradorId);
      const isDirectManager = Number(req.employee.gestorId) === Number(currentUser.colaboradorId);
      const isSuperiorLevel = currentUser.nivelHierarquia < (req?.employee?.nivelHierarquia || 7);
      const hasNoManager = req.employee.gestorId === null || !req.employee.gestorId;

      if (isOwner && !hasNoManager) {
        setToast({ title: 'AÃ§Ã£o bloqueada', message: 'VocÃª nÃ£o pode aprovar ou rejeitar sua prÃ³pria solicitaÃ§Ã£o.' });
        return;
      }

      if (!isOwner && !isDirectManager && !isSuperiorLevel) {
        setToast({ title: 'PermissÃ£o negada', message: 'VocÃª precisa ser o gestor direto ou possuir nÃ­vel hierÃ¡rquico superior para realizar aprovaÃ§Ãµes.', type: 'error' });
        return;
      }
    }

    setProcessingApprovalId(requestId);
    fetch(`${API_BASE}/api/requests/${requestId}`, { 
      method: 'PUT', 
      headers: apiHeaders(authToken), 
      body: JSON.stringify({ 
        status: decision, 
        aprovadorId: currentUser.colaboradorId,
        note: approvalNote 
      }) 
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao processar a aprovaÃ§Ã£o');
        return data;
      })
      .then(data => {
        setRequests(current => current.map(r => Number(r.id) === Number(requestId) ? { ...r, ...data } : r));
        
        if (decision === 'Aprovado' && (data.type === 'Escala de Trabalho' || data.type === 'Ajuste de Escala') && data.localTrabalho) {
           setWorkDays(prev => {
             const next = { ...prev };
             if (!next[data.employeeId]) next[data.employeeId] = {};
             next[data.employeeId][data.startDate] = data.localTrabalho;
             return next;
           });
        }

        setToast({ title: decision === 'Aprovado' ? 'SolicitaÃ§Ã£o aprovada' : 'SolicitaÃ§Ã£o rejeitada', message: 'O status foi atualizado.' });
        setApprovalNote('');
      })
      .catch(err => setToast({ title: 'Erro', message: err.message, type: 'error' }))
      .finally(() => setProcessingApprovalId(null));
  };

  if (!currentUser) return <LoginModal onLogin={handleLogin} />;
  if (loading) return <div style={{ background: '#0f172a', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '20px' }}><div className="modern-spinner"></div><div style={{ fontSize: '1.2rem', fontWeight: 600 }}>CONTROLLER MAESTRO</div></div>;

  return (
    <div className="app-container">
      <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>
      {showSettings && <SettingsModal currentUser={currentUser} authToken={authToken} onClose={() => setShowSettings(false)} onProfileUpdate={url => { const u = { ...currentUser, avatarUrl: url }; setCurrentUser(u); sessionStorage.setItem('gbi_user', JSON.stringify(u)); setShowSettings(false); setActiveView('dashboard'); }} refreshEmployees={fetchAll} colaboradores={colaboradores} areas={areas} cargos={cargos} hierarquia={hierarquia} statusTipos={statusTipos} eventos={eventos} fetchAll={fetchAll} />}

      <div className={`app-shell ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <aside className={`sidebar glass ${isSidebarOpen ? 'open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-header">
            <div className="brand">
              <div className="brand-badge" style={{ padding: 0, overflow: 'hidden' }}>
                <img src="favicon.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Logo" />
              </div>
              <div className="brand-text">
                <h1 className="premium-title" style={{ fontSize: '1.05rem', margin: 0 }}>CONTROLLER</h1>
                <p style={{ color: 'var(--muted)', fontSize: '0.7rem', margin: 0 }}>GESTÃO À VISTA</p>
              </div>
            </div>
            <button className="sidebar-toggle-btn" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} title={isSidebarCollapsed ? "Expandir" : "Recolher"}>
              <span className="material-symbols-outlined">{isSidebarCollapsed ? 'menu' : 'menu_open'}</span>
            </button>
          </div>
          <nav className="nav-list">
            {views.map(v => (
              <button key={v.id} className={`nav-button ${activeView === v.id ? 'active' : ''}`} onClick={() => { setActiveView(v.id); setIsSidebarOpen(false); }}>
                <span className="material-symbols-outlined">{v.icon}</span>
                <div className="nav-text-wrapper">
                  <span className="nav-title">{v.title}</span>
                  <span className="nav-caption">{v.caption}</span>
                </div>
              </button>
            ))}
          </nav>
          <button onClick={() => setIsDark(d => !d)} className="theme-toggle-btn" style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', margin: '12px 0 4px', background: isDark ? 'rgba(51,204,204,0.08)' : 'rgba(0,0,0,0.04)', border: '1px solid var(--line)', borderRadius: '12px', color: 'var(--text)', cursor: 'pointer', fontSize: '.84rem', fontWeight: 600 }}>
            <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
            <span className="sidebar-text">{isDark ? 'Modo Claro' : 'Modo Escuro'}</span>
          </button>
          <div className="sidebar-user-area" style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--line)' }}>
            <div className="user-badge" onClick={() => setShowSettings(true)} style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}>
               <div className="user-badge-content">
                 {currentUser.avatarUrl ? <img src={currentUser.avatarUrl} style={{ width: '32px', height: '32px', borderRadius: '10px', objectFit: 'cover' }} /> : <div className="user-badge-avatar" style={{ background: currentUser.color || 'var(--primary)' }}>{ (currentUser.name || currentUser.nome || 'A').charAt(0) }</div>}
                 <div className="user-badge-info"><div className="user-badge-name">{(() => { const n = (currentUser.name || currentUser.nome || "").trim(); const parts = n.split(" ").filter(Boolean); return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : n; })()}</div><div className="user-badge-role">{currentUser.isAdmin ? 'Admin' : (currentUser.cargoNome || currentUser.cargo || 'Usuário')}</div></div>
               </div>
            </div>
            <button 
              className="logout-btn" 
              onClick={handleLogout}
            >
              <span className="material-symbols-outlined">logout</span>
              <span className="sidebar-text">Sair</span>
            </button>
          </div>
        </aside>

        <main className="main-content">
          {(() => {
            const PAGE_META = {
              dashboard:  { title: 'Visão Executiva 360°',     description: 'Panorama estratégico: acompanhamento de entregas, capacidade técnica e escala tática.' },
              tasks:      { title: 'Gestão de Demandas',        description: 'Acompanhamento de tarefas, prazos e alocação de recursos da equipe.' },
              requests:   { title: 'Agendamentos',              description: 'Solicitações de férias, afastamentos e ajustes de escala.' },
              approvals:  { title: 'Aprovações',                description: 'Central de solicitações pendentes e histórico de decisões hierárquicas.' },
              scale:      { title: 'Escala Mensal',             description: 'Planejamento de dias presenciais e remotos da equipe.' },
              eventos:    { title: 'Eventos',                   description: 'Agenda corporativa, reuniões e compromissos da equipe.' },
            };
            const meta = PAGE_META[activeView] || { title: '', description: '' };
            return (
              <>
                {/* Mobile: hamburger + título inline */}
                <div className="topbar-header">
                  <button className="menu-toggle" onClick={() => { setIsSidebarOpen(true); setIsSidebarCollapsed(false); }}>
                    <span className="material-symbols-outlined">menu</span>
                  </button>
                  {meta.title && (
                    <span className="topbar-mobile-title">{meta.title}</span>
                  )}
                </div>

                {/* Desktop: título e descrição completos */}
                {meta.title && (
                  <div className="topbar">
                    <div>
                      <h2>{meta.title}</h2>
                      <p>{meta.description}</p>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
          {(() => {
            // Lógica de Filtros Cruzados (Cascateamento)
            const filteredEmpsForSelect = (() => {
              let list = dbEmployees;
              if (globalFilters.gestor) list = list.filter(e => e.areaNome === globalFilters.gestor || e.manager === globalFilters.gestor);
              if (globalFilters.gestorId) {
                const subIds = [parseInt(globalFilters.gestorId), ...getSubordinateIds(dbEmployees, globalFilters.gestorId)];
                list = list.filter(e => subIds.includes(parseInt(e.id)));
              }
              return list;
            })();

            const filteredAreasForSelect = (() => {
              let list = areas;
              if (globalFilters.gestorId) {
                const subIds = [parseInt(globalFilters.gestorId), ...getSubordinateIds(dbEmployees, globalFilters.gestorId)];
                const areaNomes = dbEmployees.filter(e => subIds.includes(parseInt(e.id))).map(e => e.areaNome);
                list = list.filter(a => areaNomes.includes(a.nome));
              }
              if (globalFilters.colaboradorId) {
                const emp = dbEmployees.find(e => String(e.id) === String(globalFilters.colaboradorId));
                if (emp) list = list.filter(a => a.nome === emp.areaNome);
              }
              return list;
            })();

            const filteredGestoresForSelect = (() => {
              let list = dbEmployees.filter(e => e.nivelHierarquia <= 4 || dbEmployees.some(sub => String(sub.gestorId) === String(e.id)));
              if (globalFilters.gestor) list = list.filter(g => g.areaNome === globalFilters.gestor || g.manager === globalFilters.gestor);
              if (globalFilters.colaboradorId) {
                const emp = dbEmployees.find(e => String(e.id) === String(globalFilters.colaboradorId));
                if (emp && emp.gestorId) {
                   const manager = dbEmployees.find(g => String(g.id) === String(emp.gestorId));
                   if (manager) list = list.filter(g => String(g.id) === String(manager.id));
                }
              }
              return list;
            })();

            return (activeView === 'dashboard' || activeView === 'tasks' || activeView === 'scale') && (
              <div className="top-filters glass-card">
                {activeView !== 'scale' && (
                  <div className="filter-group"><label>Colaborador</label><select value={globalFilters.colaboradorId} onChange={e => setGlobalFilters(f => ({ ...f, colaboradorId: e.target.value }))}><option value="">Todos</option>{filteredEmpsForSelect.map(e => <option key={e.id} value={String(e.id)}>{e.name}</option>)}</select></div>
                )}
                <div className="filter-group"><label>Área</label><select value={globalFilters.gestor} onChange={e => setGlobalFilters(f => ({ ...f, gestor: e.target.value }))}><option value="">Todas</option>{filteredAreasForSelect.map(a => <option key={a.id} value={a.nome}>{a.nome}</option>)}</select></div>
                <div className="filter-group"><label>Gestor</label><select value={globalFilters.gestorId} onChange={e => setGlobalFilters(f => ({ ...f, gestorId: e.target.value }))}><option value="">Todos</option>{filteredGestoresForSelect.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}</select></div>
                {(globalFilters.colaboradorId || globalFilters.gestor || globalFilters.gestorId) && (
                  <button className="btn-clear" onClick={() => setGlobalFilters({ gestor: '', colaboradorId: '', gestorId: '' })}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>filter_alt_off</span>
                    Limpar
                  </button>
                )}
              </div>
            );
          })()}

          {activeView === 'dashboard' && <DashboardView stats={stats} requests={detailedRequests} pendingRequests={pendingRequests} rejectedRequests={rejectedRequests} timelineItems={timelineItems} tasks={filteredTasks} workDays={workDays} employees={dbEmployees} demandas={demandas} setDemandas={setDemandas} eventos={eventos} areas={areas} globalFilters={globalFilters} currentUser={currentUser} onAddTask={handleAdd} />}
          {activeView === 'requests' && <RequestView form={form} setForm={setForm} employees={dbEmployees} requests={detailedRequests} formEmployee={formEmployee} formConflicts={formConflicts} formConflictLevel={formConflictLevel} selectedDuration={selectedDuration} submitRequest={submitRequest} currentUser={currentUser} editingRequestId={editingRequestId} setEditingRequestId={setEditingRequestId} deleteRequest={deleteRequest} />}
          {activeView === 'tasks' && <TaskView tasks={filteredTasks} setTasks={setTasks} employees={dbEmployees} requests={detailedRequests} currentUser={currentUser} demandas={demandas} setDemandas={setDemandas} authToken={authToken} globalFilters={globalFilters} onAddTask={handleAdd} onAddDemanda={handleNewDemanda} requestedModal={requestedModal} setRequestedModal={setRequestedModal} />}
          {activeView === 'approvals' && <ApprovalView pendingRequests={pendingRequests} allRequests={detailedRequests} approvalNote={approvalNote} setApprovalNote={setApprovalNote} handleApproval={handleApproval} currentUser={currentUser} processingApprovalId={processingApprovalId} />}
          {activeView === 'scale' && <ScaleView currentMonth={currentMonth} monthDays={monthDays} workDays={workDays} setWorkDays={setWorkDays} requests={requests} setRequests={setRequests} eventos={eventos} employees={dbEmployees} areas={areas} currentUser={currentUser} authToken={authToken} globalFilters={globalFilters} setToast={setToast} />}
          {activeView === 'eventos' && <EventsView eventos={eventos} areas={areas} colaboradores={colaboradores} authToken={authToken} fetchAll={fetchAll} currentUser={currentUser} setToast={setToast} />}
        </main>
      </div>
      {toast && (
        <div className={`modern-toast ${toast.type || 'success'}`}>
          <div className="toast-icon">
            <span className="material-symbols-outlined">
              {toast.type === 'error' ? 'error' : toast.type === 'warning' ? 'warning' : 'check_circle'}
            </span>
          </div>
          <div className="toast-content">
            <div className="toast-title">{toast.title}</div>
            <div className="toast-message">{toast.message}</div>
          </div>
          <div className="toast-progress"></div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {requestToDelete && (
        <div className="status-modal-overlay">
          <div className="status-modal" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#ef4444', marginBottom: '16px' }}>warning</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', color: 'var(--title)' }}>Excluir SolicitaÃ§Ã£o</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '24px' }}>Tem certeza que deseja excluir esta solicitaÃ§Ã£o? Esta aÃ§Ã£o nÃ£o pode ser desfeita.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setRequestToDelete(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444' }} onClick={() => confirmDeleteRequest(requestToDelete)}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="status-modal-overlay">
          <div className="status-modal" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#f59e0b', marginBottom: '16px' }}>logout</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', color: 'var(--title)' }}>Sair do Sistema</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '24px' }}>Tem certeza que deseja encerrar sua sessÃ£o?</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setShowLogoutConfirm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmLogout}>Sair</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const rootElement = document.getElementById('root');
if (ReactDOM.createRoot) {
  ReactDOM.createRoot(rootElement).render(<App />);
} else {
  ReactDOM.render(<App />, rootElement);
}
