function App() {
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
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

  const getEmployeeById = useCallback((id) => {
    return (dbEmployees || []).find((employee) => employee.id === Number(id));
  }, [dbEmployees]);

  const buildRequestDetails = useCallback((request) => {
    if (!request) return { id: 0, employee: { name: 'Inválido', team: '-', id: 0 }, startDate: '', endDate: '', status: 'Erro' };
    const employee = getEmployeeById(request.employeeId);
    const safeEmp = employee || { name: 'Colaborador não identificado', team: 'Sem Área', id: Number(request.employeeId || 0), avatarUrl: null };
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

  useEffect(() => {
    const savedUser = sessionStorage.getItem('gbi_user');
    const savedToken = sessionStorage.getItem('gbi_token');
    if (savedUser && savedToken) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setAuthToken(savedToken);
      } catch (error) {
        sessionStorage.removeItem('gbi_user');
        sessionStorage.removeItem('gbi_token');
      }
    }
  }, []);

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
    if (window.confirm('Você tem certeza que deseja sair do sistema?')) {
      sessionStorage.removeItem('gbi_user');
      sessionStorage.removeItem('gbi_token');
      setCurrentUser(null);
      setAuthToken(null);
    }
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
      const getResult = (idx) => responses[idx].status === 'fulfilled' ? responses[idx].value : null;

      const rEmployees = getResult(0);
      const rColabs = getResult(1);
      const rAreas = getResult(2);
      const rRequests = getResult(3);
      const rTasks = getResult(4);
      const rEventos = getResult(5);
      const rCargos = getResult(6);
      const rHier = getResult(7);
      const rStatus = getResult(8);
      const rDemandas = getResult(9);

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
          ...t, id: t.Id || t.id, ownerId: t.OwnerId || t.ownerId,
          status: t.Status || t.status, priority: t.Priority || t.priority,
          title: t.Title || t.title,
          startDate: (t.StartDate || t.startDate) ? (t.StartDate || t.startDate).slice(0, 10) : '',
          endDate: (t.EndDate || t.endDate) ? (t.EndDate || t.endDate).slice(0, 10) : '',
          demandaId: t.DemandaId || t.demandaId || null
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
    let filtered = requests;
    if (globalFilters.gestorId) {
      const subordinateIds = [parseInt(globalFilters.gestorId), ...getSubordinateIds(dbEmployees, globalFilters.gestorId)];
      filtered = filtered.filter(r => subordinateIds.includes(parseInt(r.employeeId)));
    }
    return filtered.map(buildRequestDetails).sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0));
  }, [requests, dbEmployees, globalFilters.gestorId]);

  const filterByUserRole = useCallback((list) => {
    if (currentUser && !currentUser.isAdmin) {
      const subordinates = [currentUser.colaboradorId, ...getSubordinateIds(dbEmployees, currentUser.colaboradorId)];
      return list.filter(r => subordinates.includes(Number(r.employeeId)));
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
      setToast({ title: 'Campos obrigatórios', message: 'Preencha colaborador, tipo e período antes de enviar.' });
      return;
    }
    if (toDate(form.endDate) < toDate(form.startDate)) {
      setToast({ title: 'Período inválido', message: 'A data final precisa ser igual ou posterior à data inicial.' });
      return;
    }
    const empId = Number(form.employeeId);
    if (!currentUser.isAdmin && currentUser.colaboradorId !== empId) {
      setToast({ title: 'Acesso negado', message: 'Você só pode criar agendamentos para si mesmo.' });
      return;
    }
    const payload = { employeeId: empId, startDate: form.startDate, endDate: form.endDate, type: form.type, status: 'Pendente', note: form.note || 'Sem observações adicionais.', coverage: form.coverage || 'A definir', priority: formConflicts.length >= 2 ? 'Alta' : formConflicts.length === 1 ? 'Média' : 'Baixa' };
    const method = editingRequestId ? 'PUT' : 'POST';
    const url = editingRequestId ? `${API_BASE}/api/requests/${editingRequestId}` : `${API_BASE}/api/requests`;
    fetch(url, { method, headers: { 'Content-Type': 'application/json', ...apiHeaders(authToken) }, body: JSON.stringify(payload) })
      .then(res => res.json())
      .then(data => {
        if (editingRequestId) {
          setRequests(prev => prev.map(r => r.id === editingRequestId ? { ...r, ...data } : r));
          setToast({ title: 'Alteração salva', message: 'O agendamento foi atualizado com sucesso.' });
          setEditingRequestId(null);
        } else {
          setRequests(current => [...current, data]);
          setToast({ title: 'Solicitação enviada', message: formConflicts.length ? `Pedido criado com ${formConflicts.length} conflitos detectados.` : 'Pedido criado com sucesso.' });
        }
        setActiveView('approvals');
      })
      .catch(err => setToast({ title: 'Erro no servidor', message: err.message }));
  };

  const deleteRequest = (id) => {
    if (!confirm('Tem certeza que deseja excluir este agendamento?')) return;
    fetch(`${API_BASE}/api/requests/${id}`, { method: 'DELETE', headers: apiHeaders(authToken) })
      .then(res => {
        if (!res.ok) throw new Error('Falha ao excluir');
        setRequests(prev => prev.filter(r => r.id !== id));
        setToast({ title: 'Excluído', message: 'Agendamento removido.' });
      })
      .catch(err => alert(err.message));
  };

  const handleApproval = (requestId, decision) => {
    if (!currentUser.isAdmin) {
      const req = detailedRequests.find(r => r.id === requestId);
      const solicitanteNivel = req?.employee?.nivelHierarquia || 6;
      if (!currentUser.nivelHierarquia || currentUser.nivelHierarquia >= solicitanteNivel) {
        setToast({ title: 'Sem permissão', message: `Seu nível (N${currentUser.nivelHierarquia || '?'}) não permite aprovar N${solicitanteNivel}.` });
        return;
      }
    }
    fetch(`${API_BASE}/api/requests/${requestId}`, { method: 'PUT', headers: apiHeaders(authToken), body: JSON.stringify({ status: decision, aprovadorId: currentUser.colaboradorId }) })
      .then(res => res.json())
      .then(data => {
        setRequests(current => current.map(r => r.id === requestId ? { ...r, ...data } : r));
        setToast({ title: decision === 'Aprovado' ? 'Solicitação aprovada' : 'Solicitação rejeitada', message: 'O status foi atualizado.' });
        setApprovalNote('');
      })
      .catch(err => setToast({ title: 'Erro', message: err.message }));
  };

  if (!currentUser) return <LoginModal onLogin={handleLogin} />;
  if (loading) return <div style={{ background: '#0f172a', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '20px' }}><div className="modern-spinner"></div><div style={{ fontSize: '1.2rem', fontWeight: 600 }}>CONTROLLER MAESTRO</div></div>;

  return (
    <div className="app-container">
      <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>
      {showSettings && <SettingsModal currentUser={currentUser} authToken={authToken} onClose={() => setShowSettings(false)} onProfileUpdate={url => { const u = { ...currentUser, avatarUrl: url }; setCurrentUser(u); sessionStorage.setItem('gbi_user', JSON.stringify(u)); setShowSettings(false); setActiveView('dashboard'); }} refreshEmployees={fetchAll} colaboradores={colaboradores} areas={areas} cargos={cargos} hierarquia={hierarquia} statusTipos={statusTipos} eventos={eventos} fetchAll={fetchAll} />}

      <div className="app-shell">
        <aside className={`sidebar glass ${isSidebarOpen ? 'open' : ''}`}>
          <div className="brand">
            <div className="brand-badge">📊</div>
            <div><h1 className="premium-title" style={{ fontSize: '1.2rem' }}>CONTROLLER</h1><p style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>GESTÃO À VISTA</p></div>
          </div>
          <nav className="nav-list">
            {views.map(v => <button key={v.id} className={`nav-button ${activeView === v.id ? 'active' : ''}`} onClick={() => { setActiveView(v.id); setIsSidebarOpen(false); }}><span className="material-symbols-outlined">{v.icon}</span><div><span className="nav-title">{v.title}</span><span className="nav-caption">{v.caption}</span></div></button>)}
          </nav>
          <button onClick={() => setIsDark(d => !d)} className="theme-toggle-btn" style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', margin: '12px 0 4px', background: isDark ? 'rgba(51,204,204,0.08)' : 'rgba(0,0,0,0.04)', border: '1px solid var(--line)', borderRadius: '12px', color: 'var(--text)', cursor: 'pointer', fontSize: '.84rem', fontWeight: 600 }}>
            <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
            <span>{isDark ? 'Modo Claro' : 'Modo Escuro'}</span>
          </button>
          <div className="user-badge" onClick={() => setShowSettings(true)}>
             <div className="user-badge-content">
               {currentUser.avatarUrl ? <img src={currentUser.avatarUrl} style={{ width: '32px', height: '32px', borderRadius: '10px', objectFit: 'cover' }} /> : <div className="user-badge-avatar" style={{ background: currentUser.color || 'var(--primary)' }}>{ (currentUser.name || currentUser.nome || 'A').charAt(0) }</div>}
               <div className="user-badge-info"><div className="user-badge-name">{currentUser.name || currentUser.nome}</div><div className="user-badge-role">{currentUser.isAdmin ? 'Admin' : (currentUser.nivelDescricao || 'Usuário')}</div></div>
             </div>
             <button className="logout-btn" onClick={e => { e.stopPropagation(); handleLogout(); }}><span className="material-symbols-outlined">logout</span> Sair</button>
          </div>
        </aside>

        <main className="main-content">
          <div className="topbar-header"><button className="menu-toggle" onClick={() => setIsSidebarOpen(true)}><span className="material-symbols-outlined">menu</span></button></div>
          {(activeView === 'dashboard' || activeView === 'tasks' || activeView === 'scale') && (
            <div className="top-filters glass-card">
              <div className="filter-group"><label>Colaborador</label><select value={globalFilters.colaboradorId} onChange={e => setGlobalFilters(f => ({ ...f, colaboradorId: e.target.value }))}><option value="">Todos</option>{dbEmployees.map(e => <option key={e.id} value={String(e.id)}>{e.name}</option>)}</select></div>
              <div className="filter-group"><label>Área</label><select value={globalFilters.gestor} onChange={e => setGlobalFilters(f => ({ ...f, gestor: e.target.value }))}><option value="">Todas</option>{areas.map(a => <option key={a.id} value={a.nome}>{a.nome}</option>)}</select></div>
              <div className="filter-group"><label>Gestor</label><select value={globalFilters.gestorId} onChange={e => setGlobalFilters(f => ({ ...f, gestorId: e.target.value }))}><option value="">Todos</option>{dbEmployees.filter(e => e.nivelHierarquia <= 4 || dbEmployees.some(sub => String(sub.gestorId) === String(e.id))).map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}</select></div>
              {(globalFilters.colaboradorId || globalFilters.gestor || globalFilters.gestorId) && (
                <button className="btn-clear" onClick={() => setGlobalFilters({ gestor: '', colaboradorId: '', gestorId: '' })}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>filter_alt_off</span>
                  Limpar
                </button>
              )}
            </div>
          )}

          {activeView === 'dashboard' && <DashboardView stats={stats} requests={detailedRequests} pendingRequests={pendingRequests} rejectedRequests={rejectedRequests} timelineItems={timelineItems} tasks={filteredTasks} workDays={workDays} employees={dbEmployees} demandas={demandas} setDemandas={setDemandas} eventos={eventos} globalFilters={globalFilters} currentUser={currentUser} />}
          {activeView === 'requests' && <RequestView form={form} setForm={setForm} employees={dbEmployees} requests={detailedRequests} formEmployee={formEmployee} formConflicts={formConflicts} formConflictLevel={formConflictLevel} selectedDuration={selectedDuration} submitRequest={submitRequest} currentUser={currentUser} editingRequestId={editingRequestId} setEditingRequestId={setEditingRequestId} deleteRequest={deleteRequest} />}
          {activeView === 'tasks' && <TaskView tasks={filteredTasks} setTasks={setTasks} employees={dbEmployees} requests={detailedRequests} currentUser={currentUser} demandas={demandas} setDemandas={setDemandas} authToken={authToken} globalFilters={globalFilters} />}
          {activeView === 'approvals' && <ApprovalView pendingRequests={pendingRequests} allRequests={detailedRequests} approvalNote={approvalNote} setApprovalNote={setApprovalNote} handleApproval={handleApproval} currentUser={currentUser} />}
          {activeView === 'scale' && <ScaleView currentMonth={currentMonth} monthDays={monthDays} workDays={workDays} setWorkDays={setWorkDays} requests={requests} setRequests={setRequests} eventos={eventos} employees={dbEmployees} areas={areas} currentUser={currentUser} authToken={authToken} globalFilters={globalFilters} setToast={setToast} />}
        </main>
      </div>
      {toast && <div className="toast-container"><div className="toast"><h4>{toast.title}</h4><p>{toast.message}</p></div></div>}
    </div>
  );
}

const rootElement = document.getElementById('root');
if (ReactDOM.createRoot) {
  ReactDOM.createRoot(rootElement).render(<App />);
} else {
  ReactDOM.render(<App />, rootElement);
}
