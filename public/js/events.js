function EventsView({ eventos, areas, colaboradores, authToken, fetchAll, currentUser, setToast }) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  const TIPO_OPTIONS = ['Reunião', 'Reunião Executiva', 'Workshop', 'Apresentação', 'Treinamento', 'Evento Corporativo', 'Aniversário', 'Aniversário de Tempo de casa', 'Outro'];

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
  const [filterTipo, setFilterTipo] = React.useState([]);
  const [filterPeriodo, setFilterPeriodo] = React.useState('upcoming'); // Default to upcoming
  const [filterArea, setFilterArea] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState(null);
  const [showModal, setShowModal] = React.useState(false);

  const inputStyle = { width: '100%', height: '42px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '0 12px', fontSize: '0.875rem', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box', cursor: 'pointer' };
  const labelStyle = { fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' };

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
      const toLocalISO = (d) => {
        if (!d) return null;
        const obj = new Date(d);
        if (isNaN(obj.getTime())) return null;
        return new Date(obj.getTime() - obj.getTimezoneOffset() * 60000).toISOString().replace('Z', '');
      };

      const payload = {
        ...form,
        dataInicio: toLocalISO(form.dataInicio),
        dataFim: toLocalISO(form.dataFim)
      };
      await apiCall(url, form.id ? 'PUT' : 'POST', payload);
      await fetchAll({ silent: true });
      setForm(emptyForm);
      setShowModal(false);
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
    setShowModal(true);
  };


  const TYPE_STYLE = EVENT_TYPE_STYLES;

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

    if (filterTipo && filterTipo.length > 0) {
      list = list.filter(ev => filterTipo.includes(ev.tipo || ev.Tipo));
    }
    if (filterPeriodo) {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

      list = list.filter(ev => {
        const d = parseDateSafe(ev.dataInicio || ev.DataInicio || ev.inicio);
        if (!d) return false;

        // Normaliza a data do evento para comparação (meio-dia local para evitar shifts)
        const dNorm = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);

        if (filterPeriodo === 'upcoming') return dNorm >= startOfToday;
        if (filterPeriodo === 'past') return dNorm < startOfToday;

        if (filterPeriodo === 'week') {
          const dayOfWeek = startOfToday.getDay();
          const startLimit = new Date(startOfToday);
          startLimit.setDate(startOfToday.getDate() - dayOfWeek);
          startLimit.setHours(0, 0, 0, 0);

          const endLimit = new Date(startLimit);
          endLimit.setDate(startLimit.getDate() + 6);
          endLimit.setHours(23, 59, 59, 999);

          return dNorm >= startLimit && dNorm <= endLimit;
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
    <div style={{ animation: 'fadeIn 0.4s ease-out', display: 'contents' }}>

      {/* Sidebar: Filtros, KPIs e Botão de Novo Evento */}
      <aside className="events-sidebar top-filters glass-card">
        <div className="events-add-wrapper" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <button 
            onClick={() => { setForm(emptyForm); setShowModal(true); }}
            className="btn-primary"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '8px', 
              padding: '12px 24px', 
              borderRadius: 'var(--radius-md)', 
              fontWeight: 800, 
              fontSize: '0.85rem',
              boxShadow: '0 8px 20px var(--primary)30',
              width: '100%'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>add_circle</span>
            NOVO EVENTO
          </button>
        </div>

        <div className="filter-group">
          <label>Área</label>
          <MultiSelect
            options={(areas || []).filter(a => a.ativo !== false).map(a => ({ value: a.id, label: a.nome }))}
            value={filterArea}
            onChange={val => setFilterArea(val)}
            placeholder="Todas"
          />
        </div>

        <div className="filter-group">
          <label>Período</label>
          <select
            value={filterPeriodo}
            onChange={e => setFilterPeriodo(e.target.value)}
          >
            <option value="">Todo o Período</option>
            <option value="upcoming">Próximos</option>
            <option value="week">Esta Semana</option>
            <option value="month">Este Mês</option>
            <option value="past">Passados</option>
          </select>
        </div>

        <div className="filter-group" style={{ flex: '0 0 auto', marginTop: '4px' }}>
          <label style={{ marginBottom: '8px' }}>Tipos de Evento</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {TIPO_OPTIONS.map(tipo => {
              const style = TYPE_STYLE[tipo] || TYPE_STYLE['Outro'];
              const isSelected = filterTipo.includes(tipo);
              return (
                <button
                  key={tipo}
                  className="event-filter-pill"
                  onClick={() => setFilterTipo(prev => isSelected ? prev.filter(t => t !== tipo) : [...prev, tipo])}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: '1.5px solid',
                    borderColor: isSelected ? style.color : 'var(--line)',
                    background: isSelected ? `${style.color}15` : 'transparent',
                    color: isSelected ? style.color : 'var(--text)',
                    textAlign: 'left'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{style.icon}</span>
                  {tipo}
                </button>
              );
            })}
          </div>
        </div>

        {(filterTipo.length > 0 || filterPeriodo || filterArea) && (
          <button
            onClick={() => { setFilterTipo([]); setFilterPeriodo(''); setFilterArea(''); }}
            className="btn-clear"
            style={{ marginTop: '8px', width: '100%', justifyContent: 'center' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>filter_alt_off</span>
            Limpar Filtros
          </button>
        )}
      </aside>

      {/* Modal de Cadastro/Edição de Evento */}
      {showModal && (
        <div className="status-modal-overlay" style={{ zIndex: 10005 }}>
          <div className="glass-card" style={{ 
            width: '95%', 
            maxWidth: '900px', 
            padding: '32px', 
            borderRadius: 'var(--radius-xl)', 
            border: '1px solid var(--line)',
            background: 'var(--surface)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--title)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '24px', color: 'var(--primary)' }}>{form.id ? 'edit_calendar' : 'add_event'}</span>
                {form.id ? 'Editar Evento' : 'Novo Evento'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="icon-btn"
                style={{ background: 'var(--bg-soft)', borderRadius: '50%', width: '36px', height: '36px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>

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
                    {(colaboradores || []).map(c => <option key={c.id} value={c.id}>{shortenName(c.name)}</option>)}
                  </select>
                </div>
              </div>

              {/* Col 4: Descrição */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', gridColumn: '1 / -1' }}>
                <div>
                  <label style={labelStyle}>Descrição / Pauta</label>
                  <textarea
                    style={{ ...inputStyle, height: '100px', resize: 'none', padding: '12px' }}
                    value={form.descricao}
                    onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                    placeholder="Breve pauta ou observações importantes sobre o evento..."
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '32px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
                style={{ height: '46px', padding: '0 32px' }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={saveEvento}
                disabled={saving}
                style={{ height: '46px', padding: '0 48px', fontWeight: 800 }}
              >
                {saving ? 'Salvando...' : (form.id ? 'ATUALIZAR EVENTO' : 'SALVAR EVENTO')}
              </button>
            </div>
          </div>
        </div>
      )}



      <main className="events-main">
        {/* KPI Strip */}
        <div className="stats-summary-bar glass-card" style={{ 
          display: 'flex', 
          flexWrap: 'nowrap',
          justifyContent: 'space-between', 
          gap: '12px', 
          padding: '12px 16px', 
          marginBottom: '16px', 
          borderRadius: 'var(--radius-xl)', 
          border: '1px solid var(--line)', 
          flexShrink: 0,
          overflow: 'hidden'
        }}>
          {[
            { label: 'Total de Eventos', value: filteredEventos.length, icon: 'event', color: 'var(--primary)' },
            { label: 'Próximos Eventos', value: upcomingCount, icon: 'upcoming', color: '#10b981' },
            { label: 'Eventos esta Semana', value: eventsThisWeekCount, icon: 'date_range', color: '#8b5cf6' },
          ].map(kpi => (
            <div key={kpi.label} className="stats-summary-item" style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              padding: '12px 16px', 
              background: 'var(--surface)', 
              borderRadius: 'var(--radius-lg)', 
              border: '1px solid var(--line)',
              minWidth: 0
            }}>
              <div className="stats-summary-icon" style={{ background: `${kpi.color}15`, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ color: kpi.color, fontSize: '20px' }}>{kpi.icon}</span>
              </div>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div className="stats-summary-label" style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{kpi.label}</div>
                <div className="stats-summary-value" style={{ color: kpi.label.includes('Total') ? 'var(--title)' : kpi.color, fontSize: '1.25rem', fontWeight: 800 }}>{kpi.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* List Container */}
        <div className="glass-card events-list-container" style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--line)', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>list_alt</span>
              Lista de Eventos
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 700 }}>
              {filteredEventos.length} resultados
            </div>
          </div>


        {filteredEventos.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--line)', display: 'block', marginBottom: '12px' }}>event_busy</span>
            <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>Nenhum evento encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="custom-scrollbar events-grid-inner" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gridAutoRows: 'min-content', gap: '16px', overflowY: 'auto', paddingRight: '8px', alignContent: 'start', flex: '1 1 0' }}>
            {filteredEventos.map(ev => {
              const tipo = ev.tipo || ev.Tipo || 'Outro';
              const style = TYPE_STYLE[tipo] || TYPE_STYLE['Outro'];
              const startObj = parseDateSafe(ev.dataInicio || ev.DataInicio || ev.inicio);
              const endObj = parseDateSafe(ev.dataFim || ev.DataFim || ev.fim);
              const isPast = startObj && startObj < new Date();
              const respNome = ev.responsavelNome || ev.ResponsavelNome;
              const relTime = getRelativeTime(ev.dataInicio || ev.DataInicio || ev.inicio, tipo, ev.dataFim || ev.DataFim || ev.fim);
              const isHappeningSoon = relTime === 'Em breve' || relTime === 'AGORA';
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
                  className={`glass-card ${isHappeningSoon ? 'pulse-emphasis' : ''}`}
                  style={{
                    padding: '20px',
                    borderRadius: 'var(--radius-lg)',
                    border: `1px solid var(--line)`,
                    borderLeft: `4px solid ${style.color}`,
                    opacity: isPast ? 0.75 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: isHappeningSoon ? 'transform 0.2s ease' : 'transform 0.2s ease, box-shadow 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden' // Garante que o beam não escape
                  }}
                >
                  {isHappeningSoon && <div className="border-beam"></div>}

                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-sm)',
                        background: (tipo === 'Aniversário' || tipo === 'Aniversário de Tempo de casa') ? 'linear-gradient(135deg, rgba(255,51,153,0.2), rgba(255,204,0,0.2))' : style.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: (tipo === 'Aniversário' || tipo === 'Aniversário de Tempo de casa') ? '0 0 12px rgba(255,51,153,0.3)' : 'none'
                      }}>
                        <span
                          className="material-symbols-outlined"
                          style={{
                            fontSize: '18px',
                            background: (tipo === 'Aniversário' || tipo === 'Aniversário de Tempo de casa') ? 'linear-gradient(135deg, #ff3399, #ff9900)' : 'none',
                            WebkitBackgroundClip: (tipo === 'Aniversário' || tipo === 'Aniversário de Tempo de casa') ? 'text' : 'none',
                            WebkitTextFillColor: (tipo === 'Aniversário' || tipo === 'Aniversário de Tempo de casa') ? 'transparent' : style.color,
                            color: (tipo === 'Aniversário' || tipo === 'Aniversário de Tempo de casa') ? 'transparent' : style.color,
                          }}
                        >
                          {style.icon}
                        </span>
                      </div>
                      <span style={{ background: style.bg, color: style.color, padding: '2px 10px', borderRadius: '6px', fontSize: '.7rem', fontWeight: 800, letterSpacing: '0.04em' }}>{tipo}</span>
                    </div>
                    {(() => {
                      const relTime = getRelativeTime(ev.dataInicio || ev.DataInicio || ev.inicio, tipo, ev.dataFim || ev.DataFim || ev.fim);
                      if (!relTime) return null;
                      const isPastBadge = relTime === 'PASSADO';
                      const isToday = relTime === 'Hoje' || relTime === 'AGORA';
                      return (
                        <span style={{
                          fontSize: '.62rem',
                          fontWeight: 900,
                          color: isPastBadge ? 'var(--muted)' : '#fff',
                          background: isPastBadge ? 'var(--panel-strong)' : (isToday ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--primary)'),
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
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--title)', lineHeight: 1.35, wordBreak: 'break-word' }}>
                      {ev.titulo || ev.Titulo}
                      {ev.anos ? ` (${ev.anos} anos)` : ''}
                    </div>
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
                        {shortenName(respNome)}
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
      </main>

    </div>
  );
}
