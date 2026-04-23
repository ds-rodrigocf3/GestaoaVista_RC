function ScaleView({ currentMonth: defaultMonth, monthDays: defaultMonthDays, workDays, setWorkDays, requests, setRequests, eventos, employees, areas, currentUser, authToken, globalFilters, setToast }) {
  const [selectedMonthOffset, setSelectedMonthOffset] = useState(0);
  const [loadingToggle, setLoadingToggle] = useState(null); // Rastreia qual dia está sendo processado

  // Sincronizar workDays com requests - garante que alterações do servidor sejam refletidas
  useEffect(() => {
    // Reconstrução total do estado baseada em requests para garantir sincronia real (inclusive deleções)
    const newWorkDays = {};
    
    if (requests && requests.length > 0) {
      // Ordenar por ID crescente para que o mais recente ganhe
      const sortedRequests = [...requests]
        .filter(r => (r.type === 'Escala de Trabalho' || r.type === 'Ajuste de Escala') && r.status === 'Aprovado' && r.localTrabalho && r.startDate)
        .sort((a, b) => Number(a.id) - Number(b.id));

      sortedRequests.forEach(r => {
        if (!newWorkDays[r.employeeId]) newWorkDays[r.employeeId] = {};
        newWorkDays[r.employeeId][r.startDate] = r.localTrabalho;
      });
    }
    
    setWorkDays(prev => {
      // Começamos com os dados vindos do servidor
      const result = { ...newWorkDays };
      
      // PROTEÇÃO PARA OTIMISMO: Se um dia ainda está em processamento (loadingToggle), 
      // preservamos o valor que o usuário acabou de clicar para evitar o "flicker" (piscar)
      if (loadingToggle && selectedEmployeeId) {
        const currentEmpLocalData = prev[selectedEmployeeId] || {};
        const localOptimisticValue = currentEmpLocalData[loadingToggle];
        
        if (localOptimisticValue) {
           if (!result[selectedEmployeeId]) result[selectedEmployeeId] = {};
           result[selectedEmployeeId][loadingToggle] = localOptimisticValue;
        } else {
           // Estava sendo deletado no clique (null)
           if (result[selectedEmployeeId]) delete result[selectedEmployeeId][loadingToggle];
        }
      }
      
      return result;
    });
  }, [requests, setWorkDays, loadingToggle, selectedEmployeeId]);

  const getSubIdsScale = useCallback((managerId) => {
    const direct = employees.filter(e => String(e.gestorId) === String(managerId));
    let ids = direct.map(e => e.id);
    direct.forEach(sub => { ids = [...ids, ...getSubIdsScale(sub.id)]; });
    return Array.from(new Set(ids));
  }, [employees]);

  const isMatch = (e) => {
    if (!globalFilters) return true;
    if (globalFilters.colaboradorId && String(e.id) !== globalFilters.colaboradorId) return false;

    if (globalFilters.gestorId) {
      const subIds = [parseInt(globalFilters.gestorId), ...getSubIdsScale(globalFilters.gestorId)];
      if (!subIds.includes(parseInt(e.id))) return false;
    } else if (globalFilters.gestor) {
      if (e.managerStr !== globalFilters.gestor && e.manager !== globalFilters.gestor && e.areaNome !== globalFilters.gestor) return false;
    }

    if (globalFilters.cargo && e.teamStr !== globalFilters.cargo && e.team !== globalFilters.cargo && e.cargoNome !== globalFilters.cargo) return false;
    return true;
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(isMatch);
  }, [employees, globalFilters, getSubIdsScale]);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState(currentUser?.colaboradorId || (filteredEmployees.length > 0 ? filteredEmployees[0].id : ''));
  const isReadOnly = !currentUser.isAdmin && Number(selectedEmployeeId) !== Number(currentUser?.colaboradorId);
  
  const [compareEntity, setCompareEntity] = useState('none');
  const [adjustModal, setAdjustModal] = useState(null); // { dateKey, currentStatus }
  const [adjustMotivo, setAdjustMotivo] = useState('');
  const [adjustNewValue, setAdjustNewValue] = useState('Presencial');

  useEffect(() => {
    if (!currentUser.isAdmin && currentUser.colaboradorId) {
      setSelectedEmployeeId(currentUser.colaboradorId);
      return;
    }

    if (filteredEmployees.length > 0) {
      if (!filteredEmployees.find(e => e.id === selectedEmployeeId)) {
        setSelectedEmployeeId(filteredEmployees[0].id);
      }
    } else {
      setSelectedEmployeeId('');
    }
  }, [filteredEmployees, currentUser]);

  const displayMonth = useMemo(() => {
    const d = new Date(defaultMonth);
    d.setMonth(d.getMonth() + selectedMonthOffset);
    return d;
  }, [defaultMonth, selectedMonthOffset]);

  const displayMonthDays = useMemo(() => getMonthMatrix(displayMonth), [displayMonth]);
  const holidays = useMemo(() => getBrazilianHolidays(displayMonth.getFullYear()), [displayMonth]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isPastDate = (dateKey) => {
    const d = new Date(dateKey + 'T12:00:00');
    d.setHours(0, 0, 0, 0);
    return d < today;
  };

  const toggleDay = (dateKey) => {
    if (isReadOnly) return;
    if (loadingToggle === dateKey) return; 
    
    const isWeekend = new Date(dateKey + 'T12:00:00').getDay() % 6 === 0;
    const isHoliday = !!holidays[dateKey];
    
    const absenceRequest = requests && requests.find(r => {
      if (r.employeeId !== selectedEmployeeId) return false;
      if (r.status === 'Rejeitado') return false;
      if (!['Férias integrais', 'Férias fracionadas', 'Day-off', 'Saúde (Exames/Consultas)'].includes(r.type)) return false;
      return isWithinRange(dateKey, r.startDate, r.endDate);
    });

    if (isPastDate(dateKey) || isWeekend || isHoliday || absenceRequest) {
      if (absenceRequest) {
        setToast && setToast({ title: 'Dia bloqueado', message: `Este dia está reservado para ${absenceRequest.type}.`, type: 'info' });
        return;
      }
      setAdjustModal({ 
        dateKey, 
        currentStatus: (workDays[selectedEmployeeId] || {})[dateKey] || 'Não definido',
        type: isPastDate(dateKey) ? 'Past' : isWeekend ? 'Weekend' : 'Holiday'
      });
      setAdjustMotivo('');
      setAdjustNewValue('Presencial');
      return;
    }

    const currentData = workDays[selectedEmployeeId] || {};
    const currentRaw = currentData[dateKey];
    const current = typeof currentRaw === 'string' ? currentRaw.trim() : currentRaw;

    let next = 'Presencial';
    if (current === 'Presencial') next = 'Home Office';
    else if (current === 'Home Office') next = null;

    const previousWorkDays = JSON.parse(JSON.stringify(workDays));
    setLoadingToggle(dateKey);
    
    setWorkDays(prev => {
      const empData = { ...(prev[selectedEmployeeId] || {}) };
      if (next) {
        empData[dateKey] = next;
      } else {
        delete empData[dateKey];
      }
      return { ...prev, [selectedEmployeeId]: empData };
    });

    if (!next) {
      const existingReq = requests && requests.find(r => 
        Number(r.employeeId) === Number(selectedEmployeeId) && 
        r.type === 'Escala de Trabalho' && 
        r.startDate === dateKey
      );
      if (existingReq) {
        fetch(`${API_BASE}/api/requests/${existingReq.id}`, { method: 'DELETE', headers: apiHeaders(authToken) })
          .then(() => {
            if (setRequests) setRequests(prev => prev.filter(r => r.id !== existingReq.id));
          })
          .finally(() => setLoadingToggle(null));
      } else {
        setLoadingToggle(null);
      }
    } else {
      const payload = {
        employeeId: selectedEmployeeId,
        type: 'Escala de Trabalho',
        startDate: dateKey,
        endDate: dateKey,
        localTrabalho: next,
        status: 'Aprovado',
        priority: 'Baixa'
      };

      fetch(`${API_BASE}/api/requests`, {
        method: 'POST',
        headers: apiHeaders(authToken),
        body: JSON.stringify(payload)
      })
        .then(r => r.json())
        .then(data => {
          if (setRequests) {
            setRequests(prev => {
              const filtered = prev.filter(r => !(r.employeeId === selectedEmployeeId && r.startDate === dateKey && r.type === 'Escala de Trabalho'));
              return [...filtered, { ...data, ...payload }];
            });
          }
        })
        .catch(e => {
          console.error('Erro ao atualizar escala:', e);
          setWorkDays(previousWorkDays); 
          setToast && setToast({ title: 'Erro', message: 'Falha ao salvar dia da escala. Tente novamente.', type: 'error' });
        })
        .finally(() => setLoadingToggle(null));
    }
  };

  const submitRetroactiveAdjust = () => {
    if (isReadOnly) return;
    if (!adjustModal) return;
    if (adjustNewValue !== 'null' && !adjustMotivo.trim()) { alert('Informe o motivo do ajuste.'); return; }
    
    const dateKey = adjustModal.dateKey;
    const existingReq = requests && requests.find(r => 
      Number(r.employeeId) === Number(selectedEmployeeId) && 
      r.type === 'Escala de Trabalho' && 
      r.startDate === dateKey
    );

    if (adjustNewValue === 'null') {
      if (!existingReq) {
        setAdjustModal(null);
        return;
      }
      fetch(`${API_BASE}/api/requests/${existingReq.id}`, { method: 'DELETE', headers: apiHeaders(authToken) })
        .then(r => r.json())
        .then(() => {
          if (setRequests) setRequests(prev => prev.filter(r => r.id !== existingReq.id));
          setAdjustModal(null);
        })
        .catch(() => alert('Erro ao remover registro.'));
      return;
    }

    const isPast = isPastDate(dateKey);
    const payload = {
      employeeId: selectedEmployeeId,
      type: isPast ? 'Ajuste de Escala' : 'Escala de Trabalho',
      startDate: dateKey,
      endDate: dateKey,
      note: `${adjustNewValue} | Motivo: ${adjustMotivo}`,
      priority: isPast ? 'Alta' : 'Média',
      status: 'Aprovado',
      localTrabalho: adjustNewValue
    };
    fetch(`${API_BASE}/api/requests`, {
      method: 'POST',
      headers: apiHeaders(authToken),
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(data => {
        if (setRequests) {
           setRequests(prev => {
              const filtered = prev.filter(r => !(r.id === data.id || (r.employeeId === selectedEmployeeId && r.startDate === dateKey && r.type === 'Escala de Trabalho')));
              return [...filtered, { ...data, ...payload }];
           });
        }
        alert('Ajuste realizado com sucesso.');
        setAdjustModal(null);
      })
      .catch(() => alert('Erro ao enviar solicitação.'));
  };

  const currentEmployeeData = workDays[selectedEmployeeId] || {};

  const businessDaysCount = useMemo(() => {
    let count = 0;
    for (const day of displayMonthDays) {
      if (!day) continue;
      if (day.getDay() === 0 || day.getDay() === 6) continue;
      const dateKey = day.toISOString().slice(0, 10);
      if (holidays[dateKey]) continue;
      const hasAbsence = requests && requests.some(r => {
        if (r.employeeId !== selectedEmployeeId) return false;
        if (r.status === 'Rejeitado') return false;
        if (!['Férias integrais', 'Férias fracionadas', 'Day-off', 'Saúde (Exames/Consultas)'].includes(r.type)) return false;
        return isWithinRange(dateKey, r.startDate, r.endDate);
      });
      if (!hasAbsence) count++;
    }
    return count;
  }, [displayMonthDays, holidays, requests, selectedEmployeeId]);

  const totalBusinessDays = useMemo(() => {
    let count = 0;
    for (const day of displayMonthDays) {
      if (!day) continue;
      const dateKey = day.toISOString().slice(0, 10);
      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
      if (!isWeekend && !holidays[dateKey]) count++;
    }
    return count;
  }, [displayMonthDays, holidays]);

  const presencialCount = useMemo(() => {
    return Object.keys(currentEmployeeData).filter(k => {
      if (!isWithinRange(k,
        new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1).toISOString().slice(0, 10),
        new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0).toISOString().slice(0, 10)
      )) return false;
      
      if (currentEmployeeData[k] !== 'Presencial') return false;

      const hasAbsence = requests && requests.some(r => {
        if (Number(r.employeeId) !== Number(selectedEmployeeId)) return false;
        if (r.status !== 'Aprovado') return false;
        if (!['Férias integrais', 'Férias fracionadas', 'Day-off', 'Saúde (Exames/Consultas)'].includes(r.type)) return false;
        return isWithinRange(k, r.startDate, r.endDate);
      });
      return !hasAbsence;
    }).length;
  }, [currentEmployeeData, displayMonth, requests, selectedEmployeeId]);

  const fillStats = useMemo(() => {
    let totalBiz = 0;
    for (const day of displayMonthDays) {
      if (!day) continue;
      if (day.getDay() === 0 || day.getDay() === 6) continue;
      const dk = day.toISOString().slice(0, 10);
      if (holidays[dk]) continue;
      totalBiz++;
    }
    const results = employees.map(emp => {
      const empData = workDays[emp.id] || {};
      let filled = 0;
      let effectiveBiz = 0;
      for (const day of displayMonthDays) {
        if (!day) continue;
        if (day.getDay() === 0 || day.getDay() === 6) continue;
        const dk = day.toISOString().slice(0, 10);
        if (holidays[dk]) continue;
        const hasAbsence = requests && requests.some(r => {
          if (Number(r.employeeId) !== Number(emp.id)) return false;
          if (r.status !== 'Aprovado') return false;
          if (!['Férias integrais', 'Férias fracionadas', 'Day-off', 'Saúde (Exames/Consultas)'].includes(r.type)) return false;
          return isWithinRange(dk, r.startDate, r.endDate);
        });
        if (hasAbsence) continue;
        effectiveBiz++;
        if (empData[dk] === 'Presencial') filled++;
      }
      return { id: emp.id, name: emp.name.split(' ')[0], pct: effectiveBiz > 0 ? Math.round((filled / effectiveBiz) * 100) : 0, filled, total: effectiveBiz };
    });
    return results.filter(r => filteredEmployees.some(fe => fe.id === r.id));
  }, [filteredEmployees, workDays, displayMonthDays, holidays, requests, employees]);

  const getComparedPeople = (dateKey) => {
    if (compareEntity === 'none') return [];
    if (compareEntity.startsWith('emp_')) {
      const empId = Number(compareEntity.replace('emp_', ''));
      if (empId === selectedEmployeeId) return [];
      const otherData = workDays[empId] || {};
      if (otherData[dateKey] === 'Presencial') {
        const emp = employees.find(e => e.id === empId);
        return emp ? [emp] : [];
      }
      return [];
    }
    if (compareEntity.startsWith('team_')) {
      const teamName = compareEntity.replace('team_', '');
      const teamMembers = (filteredEmployees || []).filter(e => e && e.areaNome === teamName && e.id !== selectedEmployeeId);
      return teamMembers.filter(member => {
        if (!member || !member.id) return false;
        const memberData = workDays[member.id] || {};
        return memberData[dateKey] === 'Presencial';
      });
    }
    return [];
  };

  const percentage = businessDaysCount > 0 ? Math.round((presencialCount / businessDaysCount) * 100) : 0;
  
  // Adjusted logic: If business days is odd (e.g. 21), 50% is considered from floor(21/2) = 10.
  const targetReached = presencialCount >= Math.floor(businessDaysCount / 2);
  const uniqueAreas = Array.from(new Set((employees || []).map(e => e?.areaNome).filter(Boolean)));
  const weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="dashboard-grid">
      <header className="page-header">
        <div>
          <h2>Escala Mensal</h2>
          <p>Gestão de presencialidade e trabalho remoto da equipe.</p>
        </div>
      </header>
      {adjustModal && (
        <div className="status-modal-overlay">
          <div className="status-modal">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: '#f59e0b', fontSize: '22px' }}>lock_clock</span>
              Ajuste Retroativo — {formatDate(adjustModal.dateKey)}
            </h3>
            <p style={{ color: 'var(--muted)', marginBottom: '16px', lineHeight: '1.5' }}>
              {adjustModal.type === 'Past' ? '📅 Esta data já passou.' : adjustModal.type === 'Weekend' ? '⛱️ Esta data é um final de semana.' : '🚩 Esta data é um feriado.'}
              <br />
              Deseja registrar sua presença ou home office para este dia?
              <br />
              Status atual: <span className="dash-micro-badge glass" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>{adjustModal.currentStatus}</span>
            </p>
            <div className="field" style={{ marginBottom: '12px' }}>
              <label>Novo valor desejado:</label>
              <select value={adjustNewValue} onChange={e => setAdjustNewValue(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)' }}>
                <option value="Presencial">Presencial</option>
                <option value="Home Office">Home Office</option>
                <option value="null">Não definido (Limpar)</option>
              </select>
            </div>
            <div className="field" style={{ marginBottom: '12px' }}>
              <label>Motivo do ajuste:</label>
              <textarea value={adjustMotivo} onChange={e => setAdjustMotivo(e.target.value)} placeholder="Ex.: Esqueci de registrar, estava presencial no escritório..." style={{ width: '100%', minHeight: '70px', boxSizing: 'border-box', padding: '10px', border: '1px solid var(--line)', borderRadius: '8px', fontSize: '.875rem', resize: 'vertical' }} />
            </div>
            <div className="action-row" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setAdjustModal(null)}>
                {isReadOnly ? 'Fechar' : 'Cancelar'}
              </button>
              {!isReadOnly && <button className="btn btn-primary" onClick={submitRetroactiveAdjust}>Confirmar Ajuste</button>}
            </div>
          </div>
        </div>
      )}

      <header className="topbar glass-card" style={{ padding: '24px', borderRadius: '20px', marginBottom: '32px', border: '1px solid var(--line)' }}>
        <div>
          <h2 className="premium-title" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--title)' }}>Escala de Trabalho</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', fontWeight: 500 }}>Frequência inteligente: o objetivo é atingir 50% de presença física.</p>
        </div>
        <div className="badge-row" style={{ display: 'flex', gap: '12px' }}>
          <span className={`dash-micro-badge glass ${targetReached ? 'done' : 'warning'}`} style={{ color: targetReached ? '#10b981' : '#f59e0b', border: '1px solid currentColor', fontWeight: 700 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{targetReached ? 'verified' : 'analytics'}</span>
            Frequência: {percentage}%
          </span>
          <span className="dash-micro-badge glass" style={{ border: '1px solid var(--line)', color: 'var(--title)', fontWeight: 600 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--muted)' }}>calendar_today</span>
            Dias Úteis: {businessDaysCount}
          </span>
          <span className="dash-micro-badge glass" style={{ border: '1px solid var(--line)', color: '#10b981', fontWeight: 600 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
            Presencial: {presencialCount}
          </span>
        </div>
      </header>

      {isReadOnly && (
        <div className="alert-banner" style={{ background: 'rgba(245,158,11,0.08)', color: '#d97706', padding: '16px', borderRadius: '14px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem', border: '1px solid rgba(245,158,11,0.2)', fontWeight: 500 }}>
          <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>visibility</span>
          <div>
            <strong>Modo Somente Leitura:</strong> Você está visualizando a escala de outro colaborador.
          </div>
        </div>
      )}

      <section className="form-grid-layout" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        <div className="card glass-card" style={{ padding: '24px', borderRadius: '24px', border: '1px solid var(--line)' }}>
          {/* Numeric Indicators Bar */}
          <div style={{ 
            display: 'flex', gap: '24px', marginBottom: '32px', 
            background: 'var(--panel-strong)', padding: '24px 32px', 
            borderRadius: '24px', border: '1px solid var(--line)',
            boxShadow: 'var(--shadow-sm)',
            alignItems: 'center'
          }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px', borderRight: '1px solid var(--line)' }}>
               <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(100, 116, 139, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--muted)', fontSize: '24px' }}>calendar_month</span>
               </div>
               <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Dias Disponíveis</div>
                  <div style={{ fontSize: '1.7rem', fontWeight: 900, color: 'var(--title)', fontFamily: "'Outfit', sans-serif", lineHeight: 1.1 }}>
                    {businessDaysCount} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)', opacity: 0.6 }}>/ {totalBusinessDays}</span>
                  </div>
               </div>
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px', borderRight: '1px solid var(--line)' }}>
               <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(51, 204, 204, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '24px' }}>analytics</span>
               </div>
               <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Meta (Mínimo 50%)</div>
                  <div style={{ fontSize: '1.7rem', fontWeight: 900, color: 'var(--primary)', fontFamily: "'Outfit', sans-serif", lineHeight: 1.1 }}>
                    {Math.floor(businessDaysCount / 2)} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)', opacity: 0.6 }}>/ {businessDaysCount}</span>
                  </div>
               </div>
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px' }}>
               <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '24px' }}>verified</span>
               </div>
               <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Realizado (Presencial)</div>
                  <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#10b981', fontFamily: "'Outfit', sans-serif", lineHeight: 1.1 }}>{presencialCount}</div>
               </div>
            </div>
          </div>

          <div className="field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--title)' }}>Colaborador:</label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(Number(e.target.value))}
                style={{ width: '100%' }}
              >
                {filteredEmployees.length === 0 && <option value="">Nenhum colaborador encontrado</option>}
                {filteredEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} · {employee.team}
                  </option>
                ))}
              </select>
            </div>

            <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--title)' }}>Comparar com:</label>
              <select value={compareEntity} onChange={(e) => setCompareEntity(e.target.value)} style={{ width: '100%' }}>
                <option value="none">Nenhum</option>
                <optgroup label="Áreas / Equipes">
                  {uniqueAreas.map(area => (
                    <option key={`team_${area}`} value={`team_${area}`}>Área: {area}</option>
                  ))}
                </optgroup>
                <optgroup label="Colaboradores Individuais">
                  {filteredEmployees.map(employee => (
                    <option key={`emp_${employee.id}`} value={`emp_${employee.id}`}>
                      {employee.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '28px', borderRadius: '28px', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
          <div className="section-title" style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
               <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--title)' }}>Controle Mensal — <span style={{ textTransform: 'capitalize' }}>{displayMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span></h3>
               <p style={{ color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 500 }}>Toque nos dias para alternar entre Presencial e Home Office.</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
               <button className="icon-btn" onClick={() => setSelectedMonthOffset(o => o - 1)} style={{ background: 'var(--panel-strong)', border: '1px solid var(--line)', borderRadius: '10px', padding: '8px' }}>
                 <span className="material-symbols-outlined" style={{ color: 'var(--title)' }}>chevron_left</span>
               </button>
               <button className="icon-btn" onClick={() => setSelectedMonthOffset(o => o + 1)} style={{ background: 'var(--panel-strong)', border: '1px solid var(--line)', borderRadius: '10px', padding: '8px' }}>
                 <span className="material-symbols-outlined" style={{ color: 'var(--title)' }}>chevron_right</span>
               </button>
            </div>
          </div>

          <div className="scale-layout-grid">
            <div className="calendar-container">
              <div className="legend" style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--title)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#10b981' }}>check_circle</span> Presencial
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--title)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>home</span> Home Office
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--title)' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '4px', border: '1.5px dashed var(--line)' }}></div> Em Aberto
                </div>
              </div>

              <div className="calendar-grid">
                {weekdayLabels.map((label) => <div key={label} className="calendar-label" style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', textAlign: 'center', paddingBottom: '12px' }}>{label}</div>)}
                {displayMonthDays.map((day, index) => {
                  if (!day) return <div key={`empty-${index}`} className="calendar-day empty" style={{ border: 'none', background: 'transparent' }}></div>;
                  const dateKey = day.toISOString().slice(0, 10);
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const status = currentEmployeeData[dateKey];
                  const holidayInfo = holidays[dateKey];
                  const isPast = isPastDate(dateKey);

                  const absenceRequest = requests && requests.find(r => {
                    if (Number(r.employeeId) !== Number(selectedEmployeeId)) return false;
                    if (r.status !== 'Aprovado') return false;
                    if (!['Férias integrais', 'Férias fracionadas', 'Day-off', 'Saúde (Exames/Consultas)'].includes(r.type)) return false;
                    return isWithinRange(dateKey, r.startDate, r.endDate);
                  });

                  const isNonWorkingDay = isWeekend || holidayInfo || absenceRequest;
                  const absenceIcon = absenceRequest ? (absenceRequest.type === 'Férias integrais' || absenceRequest.type === 'Férias fracionadas' ? 'beach_access' : absenceRequest.type === 'Day-off' ? 'event_busy' : 'medical_services') : '';
                  const absenceColor = absenceRequest ? (absenceRequest.type.includes('Férias') ? '#10b981' : absenceRequest.type === 'Day-off' ? '#f59e0b' : '#ef4444') : '';

                  const dayEvents = (eventos || []).filter(ev => {
                    const evDate = (ev.dataInicio || ev.inicio || '').slice(0, 10);
                    if (evDate !== dateKey) return false;
                    
                    // Filter by Area if not Global
                    if (ev.areaId || ev.AreaId) {
                      const eventAreas = String(ev.areaId || ev.AreaId).split(',').filter(Boolean);
                      const currentEmp = employees.find(e => Number(e.id) === Number(selectedEmployeeId));
                      const empArea = currentEmp ? String(currentEmp.areaId || currentEmp.AreaId) : null;
                      if (empArea && !eventAreas.includes(empArea)) return false;
                    }
                    return true;
                  });

                  const comparedPeople = getComparedPeople(dateKey);
                  const isComparedPresent = comparedPeople.length > 0;
                  const tooltipText = isComparedPresent ? `Presencial: ${comparedPeople.map(p => p.name).join(', ')}` : '';

                  return (
                    <div
                      key={dateKey}
                      onClick={() => toggleDay(dateKey)}
                      className={`calendar-day glass ${isWeekend ? 'weekend' : ''} ${holidayInfo ? 'holiday' : ''} ${status === 'Presencial' ? 'active' : status === 'Home Office' ? 'active' : ''} ${isPast ? 'past' : ''}`}
                      style={{ 
                        position: 'relative',
                        background: 'transparent',
                        borderRadius: '14px',
                        border: status ? '1.5px solid var(--line)' : '1.5px dashed var(--line)',
                        color: 'var(--title)',
                        cursor: isReadOnly || absenceRequest ? 'default' : 'pointer',
                        transition: 'all 0.2s ease',
                        opacity: (isPast && !status) || absenceRequest ? 0.6 : 1,
                        pointerEvents: absenceRequest ? 'none' : 'auto'
                      }}
                    >
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--title)', opacity: 0.9, zIndex: 2 }}>{day.getDate()}</span>
                      
                      {!absenceRequest && status === 'Presencial' && <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '24px', marginTop: '4px' }}>check_circle</span>}
                      {!absenceRequest && status === 'Home Office' && <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '24px', marginTop: '4px' }}>home</span>}

                      {/* Pending Indicator for Absences Only (Scale is auto-approved now) */}
                      {!status && requests && requests.some(r => Number(r.employeeId) === Number(selectedEmployeeId) && !['Escala de Trabalho', 'Ajuste de Escala'].includes(r.type) && r.startDate === dateKey && r.status === 'Pendente') && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                           <span className="material-symbols-outlined" style={{ color: '#f59e0b', fontSize: '20px', marginTop: '4px', opacity: 0.8 }}>hourglass_top</span>
                           <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>Pendente</span>
                        </div>
                      )}

                      {loadingToggle === dateKey && (
                        <div className="mini-spinner" style={{ position: 'absolute', top: '6px', right: '6px', width: '12px', height: '12px' }}></div>
                      )}
                      
                      {/* Holiday Slot: Top-Left */}
                      {holidayInfo && !absenceRequest && (
                        <div title={holidayInfo} style={{ position: 'absolute', top: '8px', left: '8px', width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 5px rgba(239, 68, 68, 0.5)', zIndex: 3 }}></div>
                      )}
                      
                      {/* Event Slot: Top-Right */}
                      {dayEvents.length > 0 && !status && !absenceRequest && (
                        <div className="event-indicator-badge" title={`${dayEvents.length} evento(s)`}></div>
                      )}
                      
                      {/* Lock Slot: Bottom-Right (Only if past and no status) */}
                      {isPast && !isNonWorkingDay && !status && !absenceRequest && (
                        <div className="day-label" style={{ fontSize: '0.65rem', position: 'absolute', bottom: '6px', right: '6px', margin: 0 }}>🔒</div>
                      )}

                      {/* Status Label (Removed text in favor of icons above) */}
                      
                      {absenceRequest && (
                        <div className="day-label" style={{ color: absenceColor, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }} title={`${absenceRequest.type} (${absenceRequest.status})`}>
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{absenceIcon}</span>
                          <span style={{ fontSize: '0.6rem', fontWeight: 800 }}>{absenceRequest.type.split(' ')[0].toUpperCase()}</span>
                        </div>
                      )}

                      {/* Avatars: Top-Left (Overlaps holiday if both exist, but usually they don't) */}
                      {isComparedPresent && !isNonWorkingDay && !status && (
                        <div className="avatar-overlap-group" title={tooltipText} style={{ position: 'absolute', top: '6px', left: '6px', display: 'flex' }}>
                          {comparedPeople.slice(0, 2).map((p, idx) => (
                            <img
                              key={p.id}
                              src={p.avatarUrl || `https://ui-avatars.com/api/?name=${p.name}&background=random`}
                              style={{ zIndex: 10 - idx, width: '16px', height: '16px', borderRadius: '50%', border: '1.5px solid var(--card)', marginLeft: idx > 0 ? '-8px' : 0, boxShadow: 'var(--shadow-sm)' }}
                              alt={p.name}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="scale-stats-panel">
               <div className="glass-card" style={{ padding: '24px', borderRadius: '24px', background: 'var(--panel-strong)', border: '1px solid var(--line)' }}>
                 <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '20px', color: 'var(--title)' }}>Status da Equipe</h4>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {fillStats.slice(0, 12).map(s => (
                      <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--title)' }}>{s.name}</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: s.pct >= 50 ? '#10b981' : '#f59e0b' }}>{s.pct}%</span>
                         </div>
                         <div style={{ height: '8px', background: 'var(--bg-soft)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--line)' }}>
                            <div style={{ width: `${s.pct}%`, height: '100%', background: s.pct >= 50 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #f59e0b, #fbbf24)', borderRadius: '4px', transition: 'width 0.5s ease' }}></div>
                         </div>
                      </div>
                    ))}
                 </div>
               </div>
            </div>
          </div>

          {/* Legends Section */}
          <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', borderTop: '1px solid var(--line)', paddingTop: '24px' }}>
            {/* Holiday List */}
            {Object.keys(holidays).length > 0 && Object.entries(holidays).some(([date]) => date.startsWith(displayMonth.toISOString().slice(0, 7))) && (
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>celebration</span>
                  Feriados em {displayMonth.toLocaleDateString('pt-BR', { month: 'long' })}:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {Object.entries(holidays)
                      .filter(([date]) => date.startsWith(displayMonth.toISOString().slice(0, 7)))
                      .map(([date, name]) => (
                      <span key={date} className="dash-micro-badge" style={{ fontSize: '0.7rem', padding: '6px 12px', background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', fontWeight: 700 }}>
                        {date.split('-').reverse()[0]}/{date.split('-')[1]} - {name}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Event List */}
            {(eventos || []).some(ev => (ev.dataInicio || ev.inicio || '').startsWith(displayMonth.toISOString().slice(0, 7))) && (
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>event</span>
                  Reuniões / Eventos em {displayMonth.toLocaleDateString('pt-BR', { month: 'long' })}:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {(eventos || [])
                    .filter(ev => {
                      const matchesMonth = (ev.dataInicio || ev.inicio || '').startsWith(displayMonth.toISOString().slice(0, 7));
                      if (!matchesMonth) return false;
                      
                      // Filter by Area if not Global
                      if (ev.areaId || ev.AreaId) {
                        const eventAreas = String(ev.areaId || ev.AreaId).split(',').filter(Boolean);
                        const currentEmp = employees.find(e => Number(e.id) === Number(selectedEmployeeId));
                        const empArea = currentEmp ? String(currentEmp.areaId || currentEmp.AreaId) : null;
                        if (empArea && !eventAreas.includes(empArea)) return false;
                      }
                      return true;
                    })
                    .sort((a, b) => (a.dataInicio || a.inicio || '').localeCompare(b.dataInicio || b.inicio || ''))
                    .map((ev, i) => {
                      const date = (ev.dataInicio || ev.inicio || '').slice(8, 10);
                      const month = (ev.dataInicio || ev.inicio || '').slice(5, 7);
                      const title = ev.titulo || ev.Titulo || ev.name || 'Sem título';
                      const tipo = ev.tipo || ev.Tipo || 'Evento';
                      
                      // Color Mapping Logic
                      const getEventStyle = (t) => {
                        const low = t.toLowerCase();
                        if (low.includes('reunião') || low.includes('meeting')) 
                          return { bg: 'rgba(139, 92, 246, 0.08)', color: '#8b5cf6', border: 'rgba(139, 92, 246, 0.2)' };
                        if (low.includes('workshop')) 
                          return { bg: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.2)' };
                        if (low.includes('treinamento') || low.includes('curso')) 
                          return { bg: 'rgba(16, 185, 129, 0.08)', color: '#10b981', border: 'rgba(16, 185, 129, 0.2)' };
                        if (low.includes('aniversário')) 
                          return { bg: 'rgba(236, 72, 153, 0.08)', color: '#ec4899', border: 'rgba(236, 72, 153, 0.2)' };
                        return { bg: 'rgba(51, 204, 204, 0.08)', color: 'var(--primary)', border: 'rgba(51, 204, 204, 0.2)' };
                      };
                      
                      const style = getEventStyle(title);
                      
                      return (
                        <span key={i} className="dash-micro-badge" style={{ 
                          fontSize: '0.72rem', 
                          padding: '6px 14px', 
                          background: style.bg, 
                          color: style.color, 
                          border: `1px solid ${style.border}`, 
                          borderRadius: '12px', 
                          fontWeight: 700 
                        }}>
                          {date}/{month} - {title}
                        </span>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
