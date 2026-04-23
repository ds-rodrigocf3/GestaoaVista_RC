function EventsView({ eventos, areas, colaboradores, authToken, fetchAll, currentUser, setToast }) {
  const TIPO_OPTIONS = ['Reunião', 'Workshop', 'Apresentação', 'Treinamento', 'Evento Corporativo', 'Aniversário', 'Outro'];

  const emptyForm = { id: null, titulo: '', descricao: '', dataInicio: '', dataFim: '', tipo: 'Reunião', areaId: '', responsavelId: '' };
  const [form, setForm] = useState(emptyForm);
  const [filterTipo, setFilterTipo] = useState('');
  const [filterPeriodo, setFilterPeriodo] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const inputStyle = { width: '100%', border: '1px solid var(--line)', borderRadius: '8px', padding: '8px 12px', fontSize: '.875rem', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' };
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

  const formatEventDate = (d) => {
    const obj = parseDateSafe(d);
    if (!obj) return '—';
    return obj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + obj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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

  const filteredEventos = useMemo(() => {
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
    if (filterSearch) {
      const s = filterSearch.toLowerCase();
      list = list.filter(ev => 
        (ev.titulo || ev.Titulo || '').toLowerCase().includes(s) || 
        (ev.descricao || ev.Descricao || '').toLowerCase().includes(s)
      );
    }
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
        return true;
      });
    }
    return list.sort((a, b) => {
      const da = parseDateSafe(a.dataInicio || a.DataInicio || a.inicio);
      const db = parseDateSafe(b.dataInicio || b.DataInicio || b.inicio);
      return (da || 0) - (db || 0);
    });
  }, [eventos, filterTipo, filterPeriodo, filterSearch, currentUser]);


  const upcomingCount = useMemo(() => {
    const now = new Date();
    return (eventos || []).filter(ev => {
      const d = parseDateSafe(ev.dataInicio || ev.DataInicio || ev.inicio);
      return d && d >= now;
    }).length;
  }, [eventos]);

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <header className="page-header">
        <div>
          <h2>Eventos</h2>
          <p>Gerencie a agenda corporativa — reuniões, aniversários e atividades da equipe.</p>
        </div>
      </header>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        {[
          { label: 'Total de Eventos', value: (eventos || []).length, icon: 'event', color: 'var(--primary)' },
          { label: 'Próximos Eventos', value: upcomingCount, icon: 'upcoming', color: '#10b981' },
          { label: 'Tipos Cadastrados', value: new Set((eventos || []).map(ev => ev.tipo || ev.Tipo)).size, icon: 'category', color: '#8b5cf6' },
        ].map(kpi => (
          <div key={kpi.label} className="glass-card" style={{ padding: '20px 24px', borderRadius: '20px', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${kpi.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ color: kpi.color, fontSize: '22px' }}>{kpi.icon}</span>
            </div>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--title)', lineHeight: 1.1 }}>{kpi.value}</div>
              <div style={{ fontSize: '.72rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Form Card */}
      <div className="glass-card" style={{ padding: '28px', borderRadius: '24px', border: '1px solid var(--line)' }}>
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
      <div className="glass-card" style={{ padding: '24px', borderRadius: '24px', border: '1px solid var(--line)', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
           <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>filter_list</span>
            Filtros e Busca
          </h3>
          <span style={{ fontSize: '.75rem', color: 'var(--muted)', fontWeight: 600 }}>{filteredEventos.length} eventos encontrados</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
          {/* Search */}
          <div style={{ flex: 2 }}>
            <label style={labelStyle}>Buscar por Título ou Descrição</label>
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: 'var(--muted)' }}>search</span>
              <input 
                style={{ ...inputStyle, paddingLeft: '40px' }} 
                value={filterSearch} 
                onChange={e => setFilterSearch(e.target.value)} 
                placeholder="Ex: Reunião mensal..." 
              />
            </div>
          </div>

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
          {(filterTipo || filterPeriodo || filterSearch) && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => { setFilterTipo(''); setFilterPeriodo(''); setFilterSearch(''); }}
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
      <div className="glass-card" style={{ padding: '28px', borderRadius: '24px', border: '1px solid var(--line)' }}>
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
              const areaInfo = React.useMemo(() => {
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
              }, [aid, areas]);

              return (
                <div
                  key={ev.id || ev.Id}
                  className="glass-card"
                  style={{
                    padding: '20px',
                    borderRadius: '20px',
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
                        borderRadius: '10px', 
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
                    {isPast && (
                      <span style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--muted)', background: 'var(--panel-strong)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}>PASSADO</span>
                    )}
                  </div>

                  {/* Title + Description */}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '.95rem', color: 'var(--title)', lineHeight: 1.35 }}>{ev.titulo || ev.Titulo}</div>
                    {(ev.descricao || ev.Descricao) && (
                      <div style={{ fontSize: '.82rem', color: 'var(--muted)', marginTop: '4px', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {ev.descricao || ev.Descricao}
                      </div>
                    )}
                  </div>

                  <div style={{ width: '100%', height: '1px', background: 'var(--line)', margin: '4px 0' }}></div>

                  {/* Meta info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.78rem', color: isPast ? 'var(--muted)' : 'var(--text)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: style.color }}>calendar_today</span>
                      <span style={{ fontWeight: 700 }}>{formatEventDate(ev.dataInicio || ev.DataInicio || ev.inicio)}</span>
                      {endObj && startObj && endObj.toDateString() !== startObj.toDateString() && (
                        <span style={{ color: 'var(--muted)' }}>→ {formatEventDate(ev.dataFim || ev.DataFim || ev.fim)}</span>
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

                  {/* Actions */}
                  {(currentUser?.isAdmin || (ev.responsavelId || ev.ResponsavelId) && currentUser?.colaboradorId && String(ev.responsavelId || ev.ResponsavelId) === String(currentUser.colaboradorId)) && (
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
