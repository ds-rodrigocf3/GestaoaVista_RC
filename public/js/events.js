function EventsView({ eventos, areas, colaboradores, authToken, fetchAll, currentUser, setToast }) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  const TIPO_OPTIONS = ['Reunião', 'Workshop', 'Apresentação', 'Treinamento', 'Evento Corporativo', 'Aniversário', 'Outro'];

  const getDefaultDates = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return {
      start: `${yyyy}-${mm}-${dd}T00:00`,
      end: `${yyyy}-${mm}-${dd}T23:59`
    };
  };
  const defaults = getDefaultDates();
  const emptyForm = { id: null, titulo: '', descricao: '', dataInicio: defaults.start, dataFim: defaults.end, tipo: 'Reunião', areaId: '', responsavelId: '' };
  const [form, setForm] = React.useState(emptyForm);
  const [filterTipo, setFilterTipo] = React.useState('');
  const [filterPeriodo, setFilterPeriodo] = React.useState('upcoming'); // Default to upcoming
  const [filterArea, setFilterArea] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState(null);

  const inputStyle = { width: '100%', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: '.875rem', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' };
  const labelStyle = { fontSize: '.78rem', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' };

  const headers = () => apiHeaders(authToken);

  const apiCall = async (url, method, body) => {
    const res = await fetch(url, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro na operação');
    return data;
  };

  const saveEvento = async () => {
    if (!form.titulo.trim() || !form.dataInicio) {
      setToast && setToast({ title: 'Campos obrigatórios', message: 'Preencha título e data de início.', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const url = form.id ? `${API_BASE}/api/eventos/${form.id}` : `${API_BASE}/api/eventos`;
      await apiCall(url, form.id ? 'PUT' : 'POST', form);
      await fetchAll({ silent: true });
      setForm(emptyForm);
      setToast && setToast({ title: form.id ? 'Evento atualizado' : 'Evento criado', message: 'Salvo com sucesso.', type: 'success' });
    } catch (e) {
      setToast && setToast({ title: 'Erro', message: e.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const deleteEvento = async (ev) => {
    if (!confirm(`Excluir evento "${ev.titulo || ev.Titulo}"?`)) return;
    setDeletingId(ev.id || ev.Id);
    try {
      await apiCall(`${API_BASE}/api/eventos/${ev.id || ev.Id}`, 'DELETE');
      await fetchAll({ silent: true });
      setToast && setToast({ title: 'Evento excluído', message: 'Removido com sucesso.', type: 'success' });
    } catch (e) {
      setToast && setToast({ title: 'Erro ao excluir', message: e.message, type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (ev) => {
    const fmt = (d) => {
      if (!d) return '';
      const obj = new Date(d);
      if (isNaN(obj.getTime())) return '';
      return new Date(obj.getTime() - obj.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };
    setForm({
      id: ev.id || ev.Id,
      titulo: ev.titulo || ev.Titulo || '',
      descricao: ev.descricao || ev.Descricao || '',
      dataInicio: fmt(ev.dataInicio || ev.DataInicio || ev.inicio),
      dataFim: fmt(ev.dataFim || ev.DataFim || ev.fim),
      tipo: ev.tipo || ev.Tipo || 'Reunião',
      areaId: ev.areaId || ev.AreaId || '',
      responsavelId: ev.responsavelId || ev.ResponsavelId || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const parseDateSafe = (d) => {
    if (!d) return null;
    const obj = new Date(d);
    return isNaN(obj.getTime()) ? null : obj;
  };

  const formatEventDate = (d, tipo) => {
    const obj = parseDateSafe(d);
    if (!obj) return '—';
    const day = String(obj.getDate()).padStart(2, '0');
    const month = String(obj.getMonth() + 1).padStart(2, '0');
    const year = obj.getFullYear();
    const dateStr = `${day}/${month}/${year}`;
    if (tipo === 'Aniversário') return dateStr;
    const hours = String(obj.getHours()).padStart(2, '0');
    const minutes = String(obj.getMinutes()).padStart(2, '0');
    return `${dateStr} ${hours}:${minutes}`;
  };

  const TYPE_STYLE = {
    'Reunião':          { bg: 'rgba(51,204,204,0.12)',   color: 'var(--primary)',  icon: 'groups' },
    'Workshop':         { bg: 'rgba(139,92,246,0.12)',   color: '#8b5cf6',         icon: 'school' },
    'Apresentação':     { bg: 'rgba(59,130,246,0.12)',   color: '#3b82f6',         icon: 'present_to_all' },
    'Treinamento':      { bg: 'rgba(245,158,11,0.12)',   color: '#f59e0b',         icon: 'menu_book' },
    'Evento Corporativo':{ bg: 'rgba(100,116,139,0.12)', color: 'var(--muted)',    icon: 'business' },
    'Aniversário':      { bg: 'rgba(255, 51, 153, 0.15)',   color: '#ff3399',         icon: 'celebration' },
    'Outro':            { bg: 'rgba(51,204,204,0.08)',   color: 'var(--primary)',  icon: 'event' },
  };

  const filteredEventos = React.useMemo(() => {
    let list = [...(eventos || [])];

    // Visibility Filtering (if not admin)
    if (!currentUser?.isAdmin) {
      list = list.filter(ev => {
        const evAreaId = ev.areaId || ev.AreaId;
        const evRespId = ev.responsavelId || ev.ResponsavelId;

        // Global (Se não houver áreas específicas selecionadas, o evento é Global)
        if (!evAreaId) return true;
        
        // Por Área (Usuário pertence a uma das áreas do evento)
        const areaIds = evAreaId ? String(evAreaId).split(',').filter(x => x !== '') : [];
        if (areaIds.length > 0 && currentUser?.areaId && areaIds.includes(String(currentUser.areaId))) return true;
        
        // Por Responsável (Usuário é o responsável direto)
        if (evRespId && currentUser?.colaboradorId && String(evRespId) === String(currentUser.colaboradorId)) return true;
        
        return false;
      });
    }

    if (filterTipo) list = list.filter(ev => (ev.tipo || ev.Tipo) === filterTipo);
    if (filterPeriodo) {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      list = list.filter(ev => {
        const d = parseDateSafe(ev.dataInicio || ev.DataInicio || ev.inicio);
        if (!d) return false;
        if (filterPeriodo === 'upcoming') return d >= startOfToday;
        if (filterPeriodo === 'past') return d < startOfToday;
        if (filterPeriodo === 'week') {
          const end = new Date(startOfToday); end.setDate(end.getDate() + 7);
          return d >= startOfToday && d <= end;
        }
        if (filterPeriodo === 'month') {
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        }
        if (filterPeriodo === 'year') {
          return d.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }
    if (filterArea) {
      const selectedAreas = String(filterArea).split(',').filter(Boolean);
      if (selectedAreas.length > 0) {
        list = list.filter(ev => {
          const evAreaId = String(ev.areaId || ev.AreaId || '');
          // Eventos sem área definida são considerados "Globais" e devem sempre aparecer
          if (!evAreaId || evAreaId.trim() === '') return true;
          
          const evAreas = evAreaId.split(',').filter(Boolean);
          return evAreas.some(a => selectedAreas.includes(a));
        });
      }
    }
    return list.sort((a, b) => {
      const da = parseDateSafe(a.dataInicio || a.DataInicio || a.inicio);
      const db = parseDateSafe(b.dataInicio || b.DataInicio || b.inicio);
      return (da || 0) - (db || 0);
    });
  }, [eventos, filterTipo, filterPeriodo, filterArea, currentUser]);


  const upcomingCount = React.useMemo(() => {
    const now = new Date();
    return filteredEventos.filter(ev => {
      const d = parseDateSafe(ev.dataInicio || ev.DataInicio || ev.inicio);
      return d && d >= now;
    }).length;
  }, [filteredEventos]);

  const eventsThisWeekCount = React.useMemo(() => {
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    return filteredEventos.filter(ev => {
      const d = parseDateSafe(ev.dataInicio || ev.DataInicio || ev.inicio);
      return d && d >= now && d <= nextWeek;
    }).length;
  }, [filteredEventos]);

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out', display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Quick Filters Bar */}
      <div className="glass-card events-quick-filters" style={{ 
        padding: '16px 24px', borderRadius: 'var(--radius-lg)', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between',
        background: 'var(--bg-soft)', border: '1px solid var(--line)', 
        position: 'relative', zIndex: 100, boxShadow: 'var(--shadow)' 
      }}>
        <div className="events-filters-left" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: '0 1 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>speed</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filtros Rápidos:</span>
          </div>
          
          <div className="events-filter-buttons" style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
            {[
              { id: 'upcoming', label: 'Próximos' },
              { id: 'week', label: 'Esta Semana' },
              { id: 'month', label: 'Este Mês' },
              { id: 'year', label: 'Este Ano' },
              { id: 'past', label: 'Passados' },
              { id: '', label: 'Tudo' }
            ].map(p => (
              <button 
                key={p.id}
                onClick={() => setFilterPeriodo(p.id)}
                style={{ 
                  padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                  border: '1px solid',
                  borderColor: filterPeriodo === p.id ? 'var(--primary)' : 'var(--line)',
                  background: filterPeriodo === p.id ? 'var(--primary)15' : 'transparent',
                  color: filterPeriodo === p.id ? 'var(--primary)' : 'var(--muted)',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="events-filters-right" style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 200px', minWidth: '220px', justifyContent: 'flex-end' }}>
          <div className="events-divider" style={{ width: '1px', height: '24px', background: 'var(--line)' }}></div>

          <div style={{ flex: 1, maxWidth: '280px' }}>
            <MultiSelect
              options={(areas || []).filter(a => a.ativo !== false).map(a => ({ value: a.id, label: a.nome }))}
              value={filterArea}
              onChange={val => setFilterArea(val)}
              placeholder="Todas as Áreas"
            />
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="stats-summary-bar" style={{ position: 'relative' }}>
        {(filterArea !== '' || filterTipo !== '' || (filterPeriodo !== '' && filterPeriodo !== 'all')) && (
          <div
            title="Filtro aplicado"
            style={{ 
              position: 'absolute', top: '50%', right: '20px', transform: 'translateY(-50%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px', borderRadius: 'var(--radius-sm)',
              background: 'var(--primary)20',
              border: '1.5px solid var(--primary)50',
              boxShadow: '0 0 10px var(--primary)20'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--primary)', fontVariationSettings: "'FILL' 1" }}>filter_alt</span>
          </div>
        )}
        {[
          { label: 'Total de Eventos', value: filteredEventos.length, icon: 'event', color: 'var(--primary)' },
          { label: 'Próximos Eventos', value: upcomingCount, icon: 'upcoming', color: '#10b981' },
          { label: 'Eventos esta Semana', value: eventsThisWeekCount, icon: 'date_range', color: '#8b5cf6' },
        ].map(kpi => (
          <div key={kpi.label} className="stats-summary-item">
            <div className="stats-summary-icon" style={{ background: `${kpi.color}15` }}>
              <span className="material-symbols-outlined" style={{ color: kpi.color, fontSize: '24px' }}>{kpi.icon}</span>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div className="stats-summary-label">{kpi.label}</div>
              <div className="stats-summary-value" style={{ color: kpi.label.includes('Total') ? 'var(--title)' : kpi.color }}>{kpi.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Form Card */}
      <div className="glass-card" style={{ padding: '28px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--line)' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>{form.id ? 'edit_calendar' : 'add_event'}</span>
          {form.id ? 'Editar Evento' : 'Novo Evento'}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Col 1: Identificação */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Título do Evento*</label>
              <input style={inputStyle} value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Reunião Mensal de Resultados" />
            </div>
            <div>
              <label style={labelStyle}>Tipo de Evento</label>
              <select style={inputStyle} value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                {TIPO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Col 2: Datas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Data e Hora de Início*</label>
              <input type="datetime-local" style={inputStyle} value={form.dataInicio} onChange={e => setForm(p => ({ ...p, dataInicio: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Data e Hora de Término</label>
              <input type="datetime-local" style={inputStyle} value={form.dataFim} onChange={e => setForm(p => ({ ...p, dataFim: e.target.value }))} />
            </div>
          </div>

          {/* Col 3: Participantes e Responsável */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Áreas Participantes</label>
              <MultiSelect
                options={(areas || []).filter(a => a.ativo !== false).map(a => ({ value: a.id, label: a.nome }))}
                value={form.areaId}
                onChange={val => setForm(p => ({ ...p, areaId: val }))}
                placeholder="Todas (Global)"
              />
            </div>
            <div>
              <label style={labelStyle}>Responsável pelo Evento</label>
              <select style={inputStyle} value={form.responsavelId} onChange={e => setForm(p => ({ ...p, responsavelId: e.target.value }))}>
                <option value="">Nenhum responsável</option>
                {(colaboradores || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Col 4: Descrição e Botão */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Descrição / Pauta</label>
              <textarea 
                style={{ ...inputStyle, height: '82px', resize: 'none' }} 
                value={form.descricao} 
                onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} 
                placeholder="Breve pauta ou observações importantes sobre o evento..." 
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn btn-primary"
                onClick={saveEvento}
                disabled={saving}
                style={{ flex: 2, height: '44px', fontWeight: 700 }}
              >
                {saving ? 'Salvando...' : (form.id ? 'Atualizar Evento' : 'Salvar Evento')}
              </button>
              {form.id && (
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setForm(emptyForm)} 
                  style={{ flex: 1, height: '44px' }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--line)', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
           <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>filter_list</span>
            Filtros e Busca
          </h3>
          <span style={{ fontSize: '.75rem', color: 'var(--muted)', fontWeight: 600 }}>{filteredEventos.length} eventos encontrados</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>

          {/* Type */}
          <div>
            <label style={labelStyle}>Tipo de Evento</label>
            <select
              value={filterTipo}
              onChange={e => setFilterTipo(e.target.value)}
              style={inputStyle}
            >
              <option value="">Todos os Tipos</option>
              {TIPO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Period */}
          <div>
            <label style={labelStyle}>Período</label>
            <select
              value={filterPeriodo}
              onChange={e => setFilterPeriodo(e.target.value)}
              style={inputStyle}
            >
              <option value="">Todo o Período</option>
              <option value="upcoming">Próximos</option>
              <option value="week">Esta Semana</option>
              <option value="month">Este Mês</option>
              <option value="past">Passados</option>
            </select>
          </div>

          {/* Clear Filters */}
          {(filterTipo || filterPeriodo || filterArea) && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => { setFilterTipo(''); setFilterPeriodo(''); setFilterArea(''); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '10px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                Limpar Filtros
              </button>
            </div>
          )}
        </div>
      </div>

      {/* List Container */}
      <div className="glass-card" style={{ padding: '28px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>list_alt</span>
            Lista de Eventos
          </h3>
        </div>


        {filteredEventos.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--line)', display: 'block', marginBottom: '12px' }}>event_busy</span>
            <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>Nenhum evento encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {filteredEventos.map(ev => {
              const tipo = ev.tipo || ev.Tipo || 'Outro';
              const style = TYPE_STYLE[tipo] || TYPE_STYLE['Outro'];
              const startObj = parseDateSafe(ev.dataInicio || ev.DataInicio || ev.inicio);
              const endObj = parseDateSafe(ev.dataFim || ev.DataFim || ev.fim);
              const isPast = startObj && startObj < new Date();
              const respNome = ev.responsavelNome || ev.ResponsavelNome;
              const isDeleting = deletingId === (ev.id || ev.Id);

              // Resolver nomes de áreas (pode ser múltiplo)
              const aid = ev.areaId || ev.AreaId;
              const areaInfo = (() => {
                if (!aid) return { text: 'Global', full: 'Todas as áreas do sistema', count: 0, isGlobal: true };
                const ids = String(aid).split(',').filter(x => x !== '');
                if (ids.length === 0) return { text: 'Global', full: 'Todas as áreas do sistema', count: 0, isGlobal: true };
                
                const names = ids.map(id => {
                  const a = (areas || []).find(x => String(x.id) === String(id));
                  return a ? a.nome : null;
                }).filter(Boolean);
                
                if (names.length === 0) return { text: 'Áreas Selecionadas', full: 'Áreas não identificadas', count: ids.length, isGlobal: false };
                if (names.length === 1) return { text: names[0], full: names[0], count: 1, isGlobal: false };
                return { text: `${names.length} Áreas`, full: names.join(', '), count: names.length, isGlobal: false };
              })();

              return (
                <div
                  key={ev.id || ev.Id}
                  className="glass-card"
                  style={{
                    padding: '20px',
                    borderRadius: 'var(--radius-lg)',
                    border: `1px solid var(--line)`,
                    borderLeft: `4px solid ${style.color}`,
                    opacity: isPast ? 0.75 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    position: 'relative'
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ 
                        width: '36px', 
                        height: '36px', 
                        borderRadius: 'var(--radius-sm)', 
                        background: tipo === 'Aniversário' ? 'linear-gradient(135deg, rgba(255,51,153,0.2), rgba(255,204,0,0.2))' : style.bg, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        flexShrink: 0,
                        boxShadow: tipo === 'Aniversário' ? '0 0 12px rgba(255,51,153,0.3)' : 'none'
                      }}>
                        <span 
                          className="material-symbols-outlined" 
                          style={{ 
                            fontSize: '18px',
                            background: tipo === 'Aniversário' ? 'linear-gradient(135deg, #ff3399, #ff9900)' : 'none',
                            WebkitBackgroundClip: tipo === 'Aniversário' ? 'text' : 'none',
                            WebkitTextFillColor: tipo === 'Aniversário' ? 'transparent' : style.color,
                            color: tipo === 'Aniversário' ? 'transparent' : style.color,
                          }}
                        >
                          {style.icon}
                        </span>
                      </div>
                      <span style={{ background: style.bg, color: style.color, padding: '2px 10px', borderRadius: '6px', fontSize: '.7rem', fontWeight: 800, letterSpacing: '0.04em' }}>{tipo}</span>
                    </div>
                    {(() => {
                      const relTime = getRelativeTime(ev.dataInicio || ev.DataInicio || ev.inicio, tipo);
                      if (!relTime) return null;
                      const isPastBadge = relTime === 'PASSADO';
                      return (
                        <span style={{ 
                          fontSize: '.62rem', 
                          fontWeight: 900, 
                          color: isPastBadge ? 'var(--muted)' : '#fff', 
                          background: isPastBadge ? 'var(--panel-strong)' : 'var(--primary)', 
                          padding: '3px 10px', 
                          borderRadius: 'var(--radius-sm)', 
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          border: isPastBadge ? '1px solid var(--line)' : 'none',
                          boxShadow: isPastBadge ? 'none' : '0 4px 12px rgba(51, 204, 204, 0.2)',
                          flexShrink: 0,
                          whiteSpace: 'nowrap'
                        }}>
                          {relTime}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Title + Description */}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--title)', lineHeight: 1.35, wordBreak: 'break-word' }}>{ev.titulo || ev.Titulo}</div>
                    {(ev.descricao || ev.Descricao) && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '4px', wordBreak: 'break-word' }}>
                        {ev.descricao || ev.Descricao}
                      </div>
                    )}
                  </div>

                  <div style={{ width: '100%', height: '1px', background: 'var(--line)', margin: '4px 0' }}></div>

                  {/* Meta info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.78rem', color: isPast ? 'var(--muted)' : 'var(--text)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: style.color }}>calendar_today</span>
                      <span style={{ fontWeight: 700 }}>{formatEventDate(ev.dataInicio || ev.DataInicio || ev.inicio, tipo)}</span>
                      {endObj && startObj && endObj.toDateString() !== startObj.toDateString() && (
                        <span style={{ color: 'var(--muted)' }}>→ {formatEventDate(ev.dataFim || ev.DataFim || ev.fim, tipo)}</span>
                      )}
                    </div>
                    {respNome && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.78rem', color: 'var(--muted)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>person</span>
                        {respNome}
                      </div>
                    )}
                    
                    <div 
                      title={areaInfo.full}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        fontSize: '.78rem', 
                        color: areaInfo.isGlobal ? 'var(--muted)' : 'var(--primary)',
                        background: areaInfo.isGlobal ? 'transparent' : 'rgba(51,204,204,0.08)',
                        padding: areaInfo.isGlobal ? '0' : '4px 8px',
                        borderRadius: '6px',
                        width: 'fit-content',
                        cursor: 'help',
                        marginTop: '2px'
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{areaInfo.isGlobal ? 'public' : 'category'}</span>
                      <span style={{ fontWeight: areaInfo.isGlobal ? 400 : 700 }}>
                        {areaInfo.text}
                      </span>
                    </div>
                  </div>

                  {/* Actions (Creator or Admin only) */}
                  {(currentUser?.isAdmin || String(ev.criadorId || ev.CriadorId) === String(currentUser?.colaboradorId)) && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                      <button
                        className="admin-action-btn"
                        onClick={() => startEdit(ev)}
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                        Editar
                      </button>
                      <button
                        className="admin-action-btn danger"
                        onClick={() => deleteEvento(ev)}
                        disabled={isDeleting}
                        style={{ flex: 1, justifyContent: 'center', opacity: isDeleting ? 0.7 : 1 }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{isDeleting ? 'hourglass_empty' : 'delete'}</span>
                        {isDeleting ? 'Excluindo...' : 'Excluir'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
