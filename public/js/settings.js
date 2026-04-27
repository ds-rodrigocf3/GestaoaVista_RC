function SettingsModal({ 
  currentUser, authToken, onClose, onProfileUpdate, 
  colaboradores, areas, cargos, hierarquia, statusTipos, eventos, fetchAll, refreshEmployees 
}) {
  const { Fragment } = React;
  const [tab, setTab] = React.useState('senha');
  const [msg, setMsg] = React.useState('');

  // Senha
  const [senhaAtual, setSenhaAtual] = React.useState('');
  const [novaSenha, setNovaSenha] = React.useState('');
  const [confSenha, setConfSenha] = React.useState('');

  // Perfil
  const [avatarFile, setAvatarFile] = React.useState(null);
  const [previewUrl, setPreviewUrl] = React.useState(currentUser.avatarUrl || '');

  // Form state
  const [formColab, setFormColab] = React.useState({ id: null, nome: '', email: '', nivelHierarquia: '', areaId: '', cargoId: '', gestorId: '', dataNascimento: '' });
  const [formArea, setFormArea] = React.useState({ id: null, nome: '', cor: '#33CCCC' });
  const [formCargo, setFormCargo] = React.useState({ id: null, nome: '' });
  const [formNivel, setFormNivel] = React.useState({ id: null, descricao: '' });
  const [formStatus, setFormStatus] = React.useState({ id: null, nome: '', cor: '#c4c4c4', aplicacao: 'Ambos', ordem: 99 });


  const TABS = [
    { id: 'perfil', label: 'Meu Perfil', icon: 'person', admin: false },
    { id: 'senha', label: 'Senha', icon: 'lock', admin: false },
    { id: 'colaboradores', label: 'Colaboradores', icon: 'group', admin: true },
    { id: 'areas', label: 'Áreas', icon: 'category', admin: true },
    { id: 'cargos', label: 'Cargos', icon: 'badge', admin: true },
    { id: 'hierarquia', label: 'Hierarquia', icon: 'account_tree', admin: true },
    { id: 'status', label: 'Status', icon: 'label', admin: true },
  ];

  const headers = React.useCallback(() => apiHeaders(authToken), [authToken]);

  // File handling
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) { setAvatarFile(file); setPreviewUrl(URL.createObjectURL(file)); }
  };

  // API calls
  const apiCall = async (url, method, body) => {
    const res = await fetch(url, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro na operação');
    return data;
  };

  const salvarPerfil = async () => {
    setMsg('');
    try {
      const formData = new FormData();
      if (avatarFile) formData.append('avatarFile', avatarFile);
      else formData.append('avatarUrl', previewUrl);
      const res = await fetch(API_BASE + '/api/auth/profile', { method: 'PUT', headers: { Authorization: 'Bearer ' + authToken }, body: formData });
      if (res.ok) { const d = await res.json(); setMsg('Foto atualizada!'); if (onProfileUpdate) onProfileUpdate(d.avatarUrl); }
      else { const e = await res.json(); setMsg(e.error || 'Erro.'); }
    } catch { setMsg('Erro de conexão.'); }
  };

  const trocarSenha = async () => {
    if (novaSenha !== confSenha) { setMsg('Senhas não coincidem.'); return; }
    if (novaSenha.length < 6) { setMsg('Mínimo 6 caracteres.'); return; }
    const res = await fetch(API_BASE + '/api/auth/change-password', { method: 'POST', headers: headers(), body: JSON.stringify({ senhaAtual, novaSenha }) });
    const d = await res.json();
    if (res.ok) { setMsg('Senha alterada!'); setNovaSenha(''); setConfSenha(''); setSenhaAtual(''); }
    else setMsg(d.error || 'Erro.');
  };

  // Generic CRUD handlers
  const saveColab = async () => {
    if (!formColab.nome || !formColab.email || !formColab.nivelHierarquia) { alert('Nome, email e nível obrigatórios'); return; }
    try {
      const url = formColab.id ? `${API_BASE}/api/colaboradores/${formColab.id}` : `${API_BASE}/api/colaboradores`;
      await apiCall(url, formColab.id ? 'PUT' : 'POST', formColab);
      fetchAll({ silent: true }); if (refreshEmployees) refreshEmployees({ silent: true });
      setFormColab({ id: null, nome: '', email: '', nivelHierarquia: '', areaId: '', cargoId: '', gestorId: '', dataNascimento: '' });
      setMsg('Colaborador salvo!');
    } catch (e) { alert(e.message); }
  };

  const toggleColabAtivo = async (c) => {
    if (!confirm(`${c.ativo !== false ? 'Inativar' : 'Reativar'} ${c.name}?`)) return;
    try { await apiCall(`${API_BASE}/api/colaboradores/${c.id}`, 'PUT', { ativo: !(c.ativo !== false) }); fetchAll({ silent: true }); if (refreshEmployees) refreshEmployees({ silent: true }); }
    catch (e) { alert(e.message); }
  };

  const saveArea = async () => {
    if (!formArea.nome) { alert('Nome obrigatório'); return; }
    try {
      const url = formArea.id ? `${API_BASE}/api/areas/${formArea.id}` : `${API_BASE}/api/areas`;
      await apiCall(url, formArea.id ? 'PUT' : 'POST', { nome: formArea.nome, ativo: true });
      fetchAll({ silent: true }); setFormArea({ id: null, nome: '' }); setMsg('Área salva!');
    } catch (e) { alert(e.message); }
  };

  const toggleAreaAtivo = async (a) => {
    if (!confirm(`${a.ativo ? 'Inativar' : 'Reativar'} ${a.nome}?`)) return;
    try { await apiCall(`${API_BASE}/api/areas/${a.id}`, 'PUT', { ativo: !a.ativo }); fetchAll({ silent: true }); }
    catch (e) { alert(e.message); }
  };

  const saveCargo = async () => {
    if (!formCargo.nome) { alert('Nome obrigatório'); return; }
    try {
      const url = formCargo.id ? `${API_BASE}/api/cargos/${formCargo.id}` : `${API_BASE}/api/cargos`;
      await apiCall(url, formCargo.id ? 'PUT' : 'POST', { nome: formCargo.nome });
      fetchAll({ silent: true }); setFormCargo({ id: null, nome: '' }); setMsg('Cargo salvo!');
    } catch (e) { alert(e.message); }
  };

  const deleteCargo = async (c) => {
    if (!confirm(`Excluir cargo "${c.Nome || c.nome}"? Colaboradores vinculados serão desvinculados.`)) return;
    try { await apiCall(`${API_BASE}/api/cargos/${c.Id || c.id}`, 'DELETE'); fetchAll({ silent: true }); }
    catch (e) { alert(e.message); }
  };

  const saveNivel = async () => {
    if (!formNivel.descricao) { alert('Descrição obrigatória'); return; }
    try {
      const url = formNivel.id ? `${API_BASE}/api/hierarquia/${formNivel.id}` : `${API_BASE}/api/hierarquia`;
      const body = formNivel.id ? { descricao: formNivel.descricao } : { descricao: formNivel.descricao };
      await apiCall(url, formNivel.id ? 'PUT' : 'POST', body);
      fetchAll({ silent: true }); setFormNivel({ id: null, descricao: '' }); setMsg('Nível salvo!');
    } catch (e) { alert(e.message); }
  };

  const deleteNivel = async (n) => {
    if (!confirm(`Excluir nível "${n.Descricao || n.descricao}"?`)) return;
    try { await apiCall(`${API_BASE}/api/hierarquia/${n.Id || n.id}`, 'DELETE'); fetchAll({ silent: true }); }
    catch (e) { alert(e.message); }
  };

  const saveStatus = async () => {
    if (!formStatus.nome) { alert('Nome obrigatório'); return; }
    try {
      const url = formStatus.id ? `${API_BASE}/api/status-tipos/${formStatus.id}` : `${API_BASE}/api/status-tipos`;
      await apiCall(url, formStatus.id ? 'PUT' : 'POST', formStatus);
      fetchAll({ silent: true }); setFormStatus({ id: null, nome: '', cor: '#c4c4c4', aplicacao: 'Ambos', ordem: 99 }); setMsg('Status salvo!');
    } catch (e) { alert(e.message); }
  };

  const toggleStatusAtivo = async (s) => {
    try { await apiCall(`${API_BASE}/api/status-tipos/${s.Id || s.id}`, 'PUT', { ativo: !(s.Ativo !== false) }); fetchAll({ silent: true }); }
    catch (e) { alert(e.message); }
  };

  const deleteStatus = async (s) => {
    if (!confirm(`Excluir status "${s.Nome || s.nome}"?`)) return;
    try { await apiCall(`${API_BASE}/api/status-tipos/${s.Id || s.id}`, 'DELETE'); fetchAll({ silent: true }); }
    catch (e) { alert(e.message); }
  };



  // Reusable table row style
  const labelStyle = { fontSize: '.8rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '4px' };
  const inputStyle = { width: '100%', border: '1px solid var(--line)', borderRadius: '6px', padding: '7px 10px', fontSize: '.875rem', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' };

  const APLICACAO_OPTIONS = ['Demanda', 'Tarefa', 'Ambos'];

  return (
    <div className="settings-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal" style={{ maxWidth: '1000px', width: '97%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-lg)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{currentUser.isAdmin ? 'Painel Administrativo' : 'Configurações'}</h2>
            <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: '.82rem' }}>{currentUser.email}</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', padding: '12px 24px 0', borderBottom: '1px solid var(--line)', overflowX: 'auto', flexShrink: 0 }}>
          {TABS.filter(t => !t.admin || currentUser.isAdmin).map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setMsg(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', border: 'none', cursor: 'pointer',
                borderRadius: '8px 8px 0 0', fontSize: '.82rem', fontWeight: 600,
                whiteSpace: 'nowrap',
                background: tab === t.id ? 'var(--primary)' : 'transparent',
                color: tab === t.id ? '#fff' : 'var(--muted)',
                borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                transition: 'all .15s'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="settings-modal-inner" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {msg && <div style={{ marginBottom: '12px', padding: '8px 14px', background: 'rgba(51,204,204,.1)', border: '1px solid rgba(51,204,204,.3)', borderRadius: 'var(--radius-sm)', fontSize: '.85rem', color: 'var(--primary)', fontWeight: 600 }}>{msg}</div>}

          {/* ===== PERFIL ===== */}
          {tab === 'perfil' && (
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: '260px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Foto de Perfil</label>
                  <input type="file" accept="image/*" onChange={handleFileChange} style={{ fontSize: '.85rem' }} />
                </div>
                <button className="btn btn-primary" onClick={salvarPerfil}>Atualizar Foto</button>
              </div>
              <div style={{ textAlign: 'center' }}>
                <img src={previewUrl || 'https://ui-avatars.com/api/?name=U&background=33CCCC&color=fff'} loading="lazy" style={{ width: '100px', height: '100px', borderRadius: 'var(--radius-md)', objectFit: 'cover', border: '2px solid var(--line)' }} />
              </div>
            </div>
          )}

          {/* ===== SENHA ===== */}
          {tab === 'senha' && (
            <div style={{ maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {!currentUser.isAdmin && (
                <div>
                  <label style={labelStyle}>Senha Atual</label>
                  <input type="password" style={inputStyle} value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} />
                </div>
              )}
              <div>
                <label style={labelStyle}>Nova Senha</label>
                <input type="password" style={inputStyle} value={novaSenha} onChange={e => setNovaSenha(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Confirmar Nova Senha</label>
                <input type="password" style={inputStyle} value={confSenha} onChange={e => setConfSenha(e.target.value)} />
              </div>
              <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={trocarSenha}>Alterar Senha</button>
            </div>
          )}

          {/* ===== COLABORADORES ===== */}
          {tab === 'colaboradores' && (
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '280px', flex: '0 0 280px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '.9rem' }}>{formColab.id ? 'Editar' : 'Novo'} Colaborador</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div><label style={labelStyle}>Nome*</label><input style={inputStyle} value={formColab.nome} onChange={e => setFormColab(p => ({ ...p, nome: e.target.value }))} /></div>
                  <div><label style={labelStyle}>Email*</label><input style={inputStyle} value={formColab.email} onChange={e => setFormColab(p => ({ ...p, email: e.target.value }))} /></div>
                  <div>
                    <label style={labelStyle}>Nível Hierárquico*</label>
                    <select style={inputStyle} value={formColab.nivelHierarquia} onChange={e => setFormColab(p => ({ ...p, nivelHierarquia: e.target.value }))}>
                      <option value="">Selecione...</option>
                      {hierarquia.map(h => <option key={h.Id || h.id} value={h.Id || h.id}>{h.Id || h.id} — {h.Descricao || h.descricao}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Área</label>
                    <select style={inputStyle} value={formColab.areaId} onChange={e => setFormColab(p => ({ ...p, areaId: e.target.value }))}>
                      <option value="">Selecione...</option>
                      {areas.filter(a => a.ativo !== false).map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Cargo</label>
                    <select style={inputStyle} value={formColab.cargoId} onChange={e => setFormColab(p => ({ ...p, cargoId: e.target.value }))}>
                      <option value="">Selecione...</option>
                      {cargos.map(c => <option key={c.Id || c.id} value={c.Id || c.id}>{c.Nome || c.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Gestor Direto</label>
                    <select style={inputStyle} value={formColab.gestorId} onChange={e => setFormColab(p => ({ ...p, gestorId: e.target.value }))}>
                      <option value="">Nenhum (topo)</option>
                      {colaboradores.filter(c => c.id !== formColab.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Data de Aniversário</label>
                    <input type="date" style={inputStyle} value={formColab.dataNascimento} onChange={e => setFormColab(p => ({ ...p, dataNascimento: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveColab}>Salvar</button>
                    {formColab.id && <button className="btn btn-secondary" onClick={() => setFormColab({ id: null, nome: '', email: '', nivelHierarquia: '', areaId: '', cargoId: '', gestorId: '', dataNascimento: '' })}>Cancelar</button>}
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '280px', overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead><tr><th>Nome</th><th>Nível</th><th>Área</th><th>Gestor</th><th>Ativo</th><th>Ações</th></tr></thead>
                  <tbody>
                    {colaboradores.slice().sort((a, b) => (a.nivelHierarquia || 99) - (b.nivelHierarquia || 99) || (a.name || '').localeCompare(b.name || '')).map(c => {
                      const gestor = colaboradores.find(g => g.id === (c.gestorId || c.GestorId));
                      return (
                        <tr key={c.id} style={{ opacity: c.ativo === false ? 0.5 : 1 }}>
                          <td style={{ fontWeight: 600 }}>{c.name}</td>
                          <td><span style={{ background: 'rgba(51,204,204,.12)', color: 'var(--primary)', borderRadius: 'var(--radius-sm)', padding: '1px 7px', fontSize: '.75rem', fontWeight: 700 }}>N{c.nivelHierarquia || '?'}</span></td>
                          <td style={{ fontSize: '.8rem', color: 'var(--muted)' }}>{c.areaNome || '—'}</td>
                          <td style={{ fontSize: '.8rem' }}>{gestor ? gestor.name : <span style={{ color: 'var(--muted)' }}>— Topo</span>}</td>
                          <td><span style={{ fontSize: '.75rem', fontWeight: 600, color: c.ativo !== false ? '#10b981' : '#ef4444' }}>{c.ativo !== false ? 'Ativo' : 'Inativo'}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button className="admin-action-btn" onClick={() => setFormColab({ 
                                id: c.id, 
                                nome: c.name, 
                                email: c.email || '', 
                                nivelHierarquia: c.nivelHierarquia || '', 
                                areaId: c.AreaId || c.areaId || '', 
                                cargoId: c.CargoId || c.cargoId || '', 
                                gestorId: c.gestorId || c.GestorId || '',
                                dataNascimento: (() => {
                                  if (!c.dataNascimento) return '';
                                  const d = new Date(c.dataNascimento);
                                  if (isNaN(d.getTime())) return String(c.dataNascimento).slice(0, 10);
                                  // For HTML5 date input (YYYY-MM-DD), we want the UTC date if it came from SQL DATE
                                  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
                                })()
                              })}>Editar</button>
                              <button className="admin-action-btn" onClick={() => toggleColabAtivo(c)} style={{ color: c.ativo !== false ? '#f59e0b' : '#10b981', borderColor: c.ativo !== false ? '#f59e0b' : '#10b981' }}>{c.ativo !== false ? 'Inativar' : 'Reativar'}</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== ÁREAS ===== */}
          {tab === 'areas' && (
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '260px', flex: '0 0 260px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '.9rem' }}>{formArea.id ? 'Editar' : 'Nova'} Área</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>Nome da Área*</label>
                    <input style={inputStyle} value={formArea.nome} onChange={e => setFormArea(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Controladoria" />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Cor de Identificação</label>
                      <input type="color" value={formArea.cor || '#33CCCC'} onChange={e => setFormArea(p => ({ ...p, cor: e.target.value }))} style={{ width: '100%', height: '36px', borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--line)' }} />
                    </div>
                    <div style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: formArea.cor || '#33CCCC', color: '#fff', fontSize: '.75rem', fontWeight: 700, marginBottom: '1px', opacity: 0.9 }}>
                      {formArea.nome || 'Prévia'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveArea}>Salvar</button>
                    {formArea.id && <button className="btn btn-secondary" onClick={() => setFormArea({ id: null, nome: '', cor: '#33CCCC' })}>Cancelar</button>}
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '280px', overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead><tr><th>Cor</th><th>Área</th><th>Colaboradores</th><th>Ativo</th><th>Ações</th></tr></thead>
                  <tbody>
                    {areas.map(a => {
                      const count = colaboradores.filter(c => (c.AreaId || c.areaId) === a.id && c.ativo !== false).length;
                      return (
                        <tr key={a.id} style={{ opacity: a.ativo === false ? 0.45 : 1 }}>
                          <td><span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: a.cor || '#33CCCC', verticalAlign: 'middle' }} /></td>
                          <td style={{ fontWeight: 600 }}>{a.nome}</td>
                          <td style={{ fontSize: '.8rem', color: 'var(--muted)' }}>{count} colaborador(es)</td>
                          <td><span style={{ fontSize: '.75rem', fontWeight: 600, color: a.ativo !== false ? '#10b981' : '#ef4444' }}>{a.ativo !== false ? 'Ativa' : 'Inativa'}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button className="admin-action-btn" onClick={() => setFormArea({ id: a.id, nome: a.nome, cor: a.cor || '#33CCCC' })}>Editar</button>
                              <button className="admin-action-btn" onClick={() => toggleAreaAtivo(a)} style={{ color: a.ativo !== false ? '#f59e0b' : '#10b981', borderColor: a.ativo !== false ? '#f59e0b' : '#10b981' }}>{a.ativo !== false ? 'Inativar' : 'Reativar'}</button>
                              <button className="admin-action-btn danger" onClick={async () => {
                                if (!confirm(`Excluir área "${a.nome}"? Isso não pode ser desfeito.`)) return;
                                try {
                                  const res = await fetch(`${API_BASE}/api/areas/${a.id}`, { method: 'DELETE', headers: headers() });
                                  const d = await res.json();
                                  if (!res.ok) { alert(d.error); return; }
                                  fetchAll(); setMsg('Área excluída!');
                                } catch (e) { alert(e.message); }
                              }}>Excluir</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== CARGOS ===== */}
          {tab === 'cargos' && (
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '240px', flex: '0 0 240px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '.9rem' }}>{formCargo.id ? 'Editar' : 'Novo'} Cargo</h4>
                <div><label style={labelStyle}>Nome do Cargo*</label><input style={inputStyle} value={formCargo.nome} onChange={e => setFormCargo(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Analista Sênior" /></div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveCargo}>Salvar</button>
                  {formCargo.id && <button className="btn btn-secondary" onClick={() => setFormCargo({ id: null, nome: '' })}>Cancelar</button>}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <table className="admin-table">
                  <thead><tr><th>Cargo</th><th>Ações</th></tr></thead>
                  <tbody>
                    {cargos.map(c => (
                      <tr key={c.Id || c.id}>
                        <td style={{ fontWeight: 500 }}>{c.Nome || c.nome}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button className="admin-action-btn" onClick={() => setFormCargo({ id: c.Id || c.id, nome: c.Nome || c.nome })}>Editar</button>
                            <button className="admin-action-btn danger" onClick={() => deleteCargo(c)}>Excluir</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== HIERARQUIA ===== */}
          {tab === 'hierarquia' && (
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '260px', flex: '0 0 260px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '.9rem' }}>{formNivel.id ? 'Editar' : 'Novo'} Nível</h4>
                <div><label style={labelStyle}>Descrição do Nível*</label><input style={inputStyle} value={formNivel.descricao} onChange={e => setFormNivel(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Gerente Executivo" /></div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveNivel}>Salvar</button>
                  {formNivel.id && <button className="btn btn-secondary" onClick={() => setFormNivel({ id: null, descricao: '' })}>Cancelar</button>}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <table className="admin-table">
                  <thead><tr><th>ID</th><th>Descrição</th><th>Colaboradores</th><th>Ações</th></tr></thead>
                  <tbody>
                    {hierarquia.map(h => {
                      const count = colaboradores.filter(c => String(c.nivelHierarquia) === String(h.Id || h.id)).length;
                      return (
                        <tr key={h.Id || h.id}>
                          <td><span style={{ background: 'rgba(51,204,204,.12)', color: 'var(--primary)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', fontWeight: 700, fontSize: '.8rem' }}>N{h.Id || h.id}</span></td>
                          <td style={{ fontWeight: 500 }}>{h.Descricao || h.descricao}</td>
                          <td style={{ fontSize: '.8rem', color: 'var(--muted)' }}>{count} pessoa(s)</td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button className="admin-action-btn" onClick={() => setFormNivel({ id: h.Id || h.id, descricao: h.Descricao || h.descricao })}>Editar</button>
                              <button className="admin-action-btn danger" onClick={() => deleteNivel(h)}>Excluir</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== STATUS ===== */}
          {tab === 'status' && (
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '280px', flex: '0 0 280px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '.9rem' }}>{formStatus.id ? 'Editar' : 'Novo'} Status</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div><label style={labelStyle}>Nome do Status*</label><input style={inputStyle} value={formStatus.nome} onChange={e => setFormStatus(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Em Revisão" /></div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Cor</label>
                      <input type="color" value={formStatus.cor} onChange={e => setFormStatus(p => ({ ...p, cor: e.target.value }))} style={{ width: '100%', height: '36px', borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--line)' }} />
                    </div>
                    <div style={{ flex: 2 }}>
                      <label style={labelStyle}>Aplica-se a</label>
                      <select style={inputStyle} value={formStatus.aplicacao} onChange={e => setFormStatus(p => ({ ...p, aplicacao: e.target.value }))}>
                        {APLICACAO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  <div><label style={labelStyle}>Ordem de exibição</label><input type="number" style={inputStyle} value={formStatus.ordem} onChange={e => setFormStatus(p => ({ ...p, ordem: parseInt(e.target.value) || 99 }))} /></div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveStatus}>Salvar</button>
                    {formStatus.id && <button className="btn btn-secondary" onClick={() => setFormStatus({ id: null, nome: '', cor: '#c4c4c4', aplicacao: 'Ambos', ordem: 99 })}>Cancelar</button>}
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <table className="admin-table">
                  <thead><tr><th>Status</th><th>Cor</th><th>Aplica-se a</th><th>Ordem</th><th>Ativo</th><th>Ações</th></tr></thead>
                  <tbody>
                    {statusTipos.map(s => (
                      <tr key={s.Id || s.id} style={{ opacity: s.Ativo === false || s.Ativo === 0 ? 0.5 : 1 }}>
                        <td style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: s.Cor || '#c4c4c4', flexShrink: 0, display: 'inline-block' }}></span>
                          {s.Nome || s.nome}
                        </td>
                        <td><span style={{ fontFamily: 'monospace', fontSize: '.8rem' }}>{s.Cor}</span></td>
                        <td style={{ fontSize: '.8rem' }}>{s.Aplicacao}</td>
                        <td style={{ fontSize: '.8rem', textAlign: 'center' }}>{s.Ordem}</td>
                        <td><span style={{ fontSize: '.75rem', fontWeight: 600, color: s.Ativo !== false && s.Ativo !== 0 ? '#10b981' : '#ef4444' }}>{s.Ativo !== false && s.Ativo !== 0 ? 'Ativo' : 'Inativo'}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button className="admin-action-btn" onClick={() => setFormStatus({ id: s.Id || s.id, nome: s.Nome || s.nome, cor: s.Cor || '#c4c4c4', aplicacao: s.Aplicacao || 'Ambos', ordem: s.Ordem || 99 })}>Editar</button>
                            <button className="admin-action-btn" onClick={() => toggleStatusAtivo(s)} style={{ color: s.Ativo !== false ? '#f59e0b' : '#10b981', borderColor: s.Ativo !== false ? '#f59e0b' : '#10b981' }}>{s.Ativo !== false ? 'Inativar' : 'Ativar'}</button>
                            <button className="admin-action-btn danger" onClick={() => deleteStatus(s)}>Excluir</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== EVENTOS (moved to sidebar page) ===== */}
          {false && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="glass-card" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)' }}>
                <h4 style={{ margin: '0 0 16px', fontSize: '.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>{formEvento.id ? 'edit_calendar' : 'add_event'}</span>
                  {formEvento.id ? 'Editar Evento' : 'Novo Evento'}
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                  {/* Row 1: Title & Type */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 2 }}>
                      <label style={labelStyle}>Título do Evento*</label>
                      <input style={inputStyle} value={formEvento.titulo} onChange={e => setFormEvento(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Reunião Mensal" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Tipo</label>
                      <select style={inputStyle} value={formEvento.tipo} onChange={e => setFormEvento(p => ({ ...p, tipo: e.target.value }))}>
                        {TIPO_EVENTO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Dates */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Início*</label>
                      <input type="datetime-local" style={inputStyle} value={formEvento.dataInicio} onChange={e => setFormEvento(p => ({ ...p, dataInicio: e.target.value }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Término</label>
                      <input type="datetime-local" style={inputStyle} value={formEvento.dataFim} onChange={e => setFormEvento(p => ({ ...p, dataFim: e.target.value }))} />
                    </div>
                  </div>

                  {/* Row 3: Areas & Responsavel */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Áreas Participantes</label>
                      <MultiSelect 
                        options={areas.filter(a => a.ativo !== false).map(a => ({ value: a.id, label: a.nome }))}
                        value={formEvento.areaId}
                        onChange={val => setFormEvento(p => ({ ...p, areaId: val }))}
                        placeholder="Todas (Global)"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Responsável</label>
                      <select style={inputStyle} value={formEvento.responsavelId} onChange={e => setFormEvento(p => ({ ...p, responsavelId: e.target.value }))}>
                        <option value="">Nenhum</option>
                        {colaboradores.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Row 4: Description & Save */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Descrição / Pauta</label>
                      <input style={inputStyle} value={formEvento.descricao} onChange={e => setFormEvento(p => ({ ...p, descricao: e.target.value }))} placeholder="Breve pauta ou observações..." />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-primary" onClick={saveEvento} style={{ padding: '0 24px', height: '42px' }}>Salvar</button>
                      {formEvento.id && <button className="btn btn-secondary" onClick={() => setFormEvento({ id: null, titulo: '', descricao: '', dataInicio: '', dataFim: '', tipo: 'Reunião', areaId: '', responsavelId: '' })} style={{ height: '42px' }}>Cancelar</button>}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)' }}>
                <table className="admin-table">
                  <thead><tr><th>Evento</th><th>Tipo</th><th>Responsável</th><th>Início</th><th>Ações</th></tr></thead>
                  <tbody>
                    {eventos.map(ev => {
                      const parseDateSafe = (d) => {
                        if (!d) return null;
                        if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
                        let dateObj = new Date(d);
                        if (isNaN(dateObj.getTime()) && typeof d === 'string') {
                          dateObj = new Date(d.replace(/-/g, '/').replace('T', ' ')); 
                        }
                        return isNaN(dateObj.getTime()) ? null : dateObj;
                      };

                      const formatEventDate = (d, tipo) => {
                        const dateObj = parseDateSafe(d);
                        if (!dateObj) return '—';
                        const dateStr = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        if (tipo === 'Aniversário') return dateStr;
                        return dateStr + ' ' + dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                      };

                      const getTypeBadgeColor = (type) => {
                        switch(type) {
                          case 'Reunião': return { bg: 'rgba(51,204,204,0.12)', color: 'var(--primary)' };
                          case 'Workshop': return { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6' };
                          case 'Treinamento': return { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' };
                          case 'Aniversário': return { bg: 'rgba(236,72,153,0.12)', color: '#ec4899' }; // Pink color for birthdays
                          default: return { bg: 'rgba(100,116,139,0.12)', color: 'var(--muted)' };
                        }
                      };
                      const badge = getTypeBadgeColor(ev.tipo || ev.Tipo);

                      return (
                        <tr key={ev.id || ev.Id} style={{ borderBottom: '1px solid var(--panel-strong)' }}>
                          <td style={{ padding: '12px 6px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--title)', fontSize: '.88rem' }}>{ev.titulo || ev.Titulo}</div>
                            {(ev.descricao || ev.Descricao) && <div style={{ fontSize: '.72rem', color: 'var(--muted)', fontWeight: 400, marginTop: '2px' }}>{(ev.descricao || ev.Descricao).substring(0, 80)}{(ev.descricao || ev.Descricao).length > 80 ? '...' : ''}</div>}
                          </td>
                          <td style={{ padding: '12px 6px' }}>
                            <span style={{ background: badge.bg, color: badge.color, padding: '2px 8px', borderRadius: '4px', fontSize: '.7rem', fontWeight: 700 }}>{ev.tipo || ev.Tipo}</span>
                          </td>
                          <td style={{ padding: '12px 6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--panel-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--muted)', fontWeight: 700 }}>{((ev.responsavelNome || ev.ResponsavelNome) || 'A').charAt(0)}</div>
                              <span style={{ fontSize: '.78rem', color: 'var(--text)' }}>{(ev.responsavelNome || ev.ResponsavelNome) || '—'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 6px', fontSize: '.78rem', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                            {formatEventDate(ev.dataInicio || ev.DataInicio || ev.inicio, ev.tipo || ev.Tipo)}
                            {ev.dataFim && (ev.tipo || ev.Tipo) !== 'Aniversário' && (
                              <><br /><span style={{ color: 'var(--muted)' }}>até {formatEventDate(ev.dataFim || ev.DataFim || ev.fim, ev.tipo || ev.Tipo).split(' ')[1] || '—'}</span></>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button className="admin-action-btn" onClick={() => {
                                const formatForInput = (d) => {
                                  if (!d) return '';
                                  const dateObj = new Date(d);
                                  if (isNaN(dateObj.getTime())) return '';
                                  const offset = dateObj.getTimezoneOffset() * 60000;
                                  return new Date(dateObj.getTime() - offset).toISOString().slice(0, 16);
                                };
                                setFormEvento({ 
                                  id: ev.id || ev.Id, 
                                  titulo: ev.titulo || ev.Titulo || '', 
                                  descricao: ev.descricao || ev.Descricao || '', 
                                  dataInicio: formatForInput(ev.dataInicio || ev.DataInicio || ev.inicio), 
                                  dataFim: formatForInput(ev.dataFim || ev.DataFim || ev.fim), 
                                  tipo: ev.tipo || ev.Tipo || 'Reunião',
                                  areaId: ev.areaId || ev.AreaId || '',
                                  responsavelId: ev.responsavelId || ev.ResponsavelId || ''
                                });
                              }}>Editar</button>
                              <button className="admin-action-btn danger" onClick={() => deleteEvento(ev)}>Excluir</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div> {/* /settings-modal-inner */}

        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--line)', textAlign: 'right', flexShrink: 0 }}>
          <button className="btn btn-secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
