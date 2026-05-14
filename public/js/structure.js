const { useState, useEffect, useRef, useCallback, useMemo } = React;

const parseDateToComparable = (dateStr) => {
  if (!dateStr) return 0;
  const months = {
    'JAN': '01', 'FEV': '02', 'MAR': '03', 'ABR': '04', 'MAI': '05', 'JUN': '06',
    'JUL': '07', 'AGO': '08', 'SET': '09', 'OUT': '10', 'NOV': '11', 'DEZ': '12'
  };
  
  const parts = String(dateStr).toUpperCase().split('/');
  if (parts.length === 2) {
    const month = months[parts[0]] || '00';
    const year = parts[1];
    return parseInt(year + month);
  }
  
  if (String(dateStr).length === 4 && !isNaN(dateStr)) {
    return parseInt(dateStr + '00');
  }
  
  return 0;
};

function StructureView({ employees, areas, currentUser, authToken, fetchAll, setToast }) {
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const viewportRef = useRef(null);
  const treeRef = useRef(null);

  // Pan & Zoom State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Reset view when searching
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [searchQuery]);

  const handleWheel = (e) => {
    const zoomSensitivity = 0.001;
    const delta = e.deltaY * -zoomSensitivity;
    setScale(s => Math.min(Math.max(0.2, s + delta), 3.0));
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStart.current = { 
        x: e.touches[0].clientX - position.x, 
        y: e.touches[0].clientY - position.y 
      };
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPosition({
      x: e.touches[0].clientX - dragStart.current.x,
      y: e.touches[0].clientY - dragStart.current.y
    });
  };

  const zoomIn = () => setScale(s => Math.min(s + 0.2, 3.0));
  const zoomOut = () => setScale(s => Math.max(s - 0.2, 0.2));
  const resetZoom = () => { setScale(1); setPosition({ x: 0, y: 0 }); };


  const buildTree = useCallback(() => {
    if (!employees || employees.length === 0) return [];
    const map = {};
    employees.forEach(emp => { map[emp.id] = { ...emp, children: [] }; });
    const roots = [];
    employees.forEach(emp => {
      if (emp.gestorId && map[emp.gestorId]) map[emp.gestorId].children.push(map[emp.id]);
      else roots.push(map[emp.id]);
    });

    // Helper to calculate recursive counts
    const calculateSubordinates = (node) => {
      let count = node.children.length;
      node.children.forEach(child => {
        count += calculateSubordinates(child);
      });
      node.subordinateCount = count;
      return count;
    };

    roots.forEach(calculateSubordinates);
    return roots;
  }, [employees]);

  const treeData = useMemo(() => buildTree(), [buildTree]);

  // Calculate levels relative to the visible roots
  const employeeLevels = useMemo(() => {
    const levels = {};
    const setLevel = (nodes, lvl) => {
      nodes.forEach(node => {
        levels[node.id] = lvl;
        if (node.children) setLevel(node.children, lvl + 1);
      });
    };
    setLevel(treeData, 0);
    return levels;
  }, [treeData]);

  // Track which levels currently have expanded nodes
  const expandedLevels = useMemo(() => {
    const levels = new Set();
    expandedNodes.forEach(id => {
      if (employeeLevels[id] !== undefined) {
        // Only mark level as expanded if it actually HAS children
        const emp = (employees || []).find(e => e.id === id);
        if (emp && employees.some(e => e.gestorId === id)) {
          levels.add(employeeLevels[id]);
        }
      }
    });
    return levels;
  }, [expandedNodes, employeeLevels, employees]);

  const toggleNode = (id) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOpenProfile = async (emp) => {
    try {
      const res = await fetch(`${API_BASE}/api/colaboradores/${emp.id}/profile`, {
        headers: apiHeaders(authToken)
      });
      if (res.ok) {
        const profile = await res.json();
        // Mesclamos os dados básicos com os dados detalhados do perfil
        setSelectedProfile({ 
          ...emp, 
          ...profile,
          avatarUrl: profile.avatarFull || emp.avatarUrl // Prioriza o avatar em alta resolução se existir
        });
      } else {
        setSelectedProfile(emp);
      }
    } catch (e) {
      console.error('Erro ao carregar perfil detalhado:', e);
      setSelectedProfile(emp);
    }
  };

  // Auto-expand search results
  useEffect(() => {
    if (searchQuery.length < 2) return;
    
    const matches = employees.filter(emp => 
      (emp.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.cargoNome || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.areaNome || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (matches.length > 0) {
      setExpandedNodes(prev => {
        const next = new Set(prev);
        matches.forEach(match => {
          let current = match;
          // Subir a hierarquia e expandir todos os gestores
          while (current && current.gestorId) {
            next.add(current.gestorId);
            current = employees.find(e => e.id === current.gestorId);
          }
        });
        return next;
      });
    }
  }, [searchQuery, employees]);

  if (selectedProfile) {
    return (
      <ProfileFeed 
        employee={selectedProfile} 
        onBack={() => setSelectedProfile(null)} 
        currentUser={currentUser}
        authToken={authToken}
        onUpdate={() => { fetchAll(); setSelectedProfile(null); }}
        setToast={setToast}
      />
    );
  }

  return (
    <div className="structure-container animate-fade-in">
      <div className="structure-header-actions glass-card">
        <div className="structure-search">
          <span className="material-symbols-outlined">search</span>
          <input type="text" placeholder="Buscar colaborador ou área..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div className="structure-legend">
          <div className="legend-item"><span className="dot" style={{background: 'var(--primary)'}}></span> Ativo</div>
          <div className="flex gap-2">
            <button className="btn-action-exe" onClick={() => setExpandedNodes(new Set(employees.map(e => e.id)))}>
              <span className="material-symbols-outlined">unfold_more</span> Expandir Tudo
            </button>
            <button className="btn-action-exe" onClick={() => setExpandedNodes(new Set())}>
              <span className="material-symbols-outlined">unfold_less</span> Recolher Tudo
            </button>
          </div>
        </div>
      </div>
      <div 
        className="organogram-viewport" 
        ref={viewportRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        style={{ 
          cursor: isDragging ? 'grabbing' : 'grab',
          overflow: 'hidden',
          position: 'relative',
          userSelect: 'none',
          touchAction: 'none'
        }}
      >
        <div className="zoom-controls" style={{
          position: 'fixed', bottom: '30px', right: '30px', zIndex: 1000,
          display: 'flex', flexDirection: 'column', gap: '8px',
          background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(12px)',
          padding: '8px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6)'
        }}>
          <button className="btn-action-exe !p-2 !min-w-0 flex items-center justify-center hover:scale-110 transition-transform" onClick={zoomIn} title="Aumentar Zoom"><span className="material-symbols-outlined">add</span></button>
          <button className="btn-action-exe !p-2 !min-w-0 flex items-center justify-center hover:scale-110 transition-transform" onClick={resetZoom} title="Centralizar e Resetar Zoom"><span className="material-symbols-outlined">center_focus_strong</span></button>
          <button className="btn-action-exe !p-2 !min-w-0 flex items-center justify-center hover:scale-110 transition-transform" onClick={zoomOut} title="Diminuir Zoom"><span className="material-symbols-outlined">remove</span></button>
        </div>

        <div 
          className="organogram-tree" 
          ref={treeRef}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'top center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            willChange: 'transform'
          }}
        >
          {treeData.map(root => (
            <OrganogramNode 
              key={root.id} 
              node={root} 
              expandedNodes={expandedNodes} 
              expandedLevels={expandedLevels}
              toggleNode={toggleNode} 
              onOpenProfile={handleOpenProfile} 
              searchQuery={searchQuery} 
              level={0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function OrganogramNode({ node, expandedNodes, expandedLevels, toggleNode, onOpenProfile, searchQuery, level = 0 }) {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  
  // A node is compact if it's expanded OR if ANY node at its level is expanded (superior/sibling focus)
  const isCompact = (isExpanded && hasChildren) || (expandedLevels && expandedLevels.has(level));

  const hasMatch = (n, query) => {
    const q = query.toLowerCase();
    const selfMatch = (n.name || '').toLowerCase().includes(q) || (n.cargoNome || '').toLowerCase().includes(q) || (n.areaNome || '').toLowerCase().includes(q);
    if (selfMatch) return true;
    if (n.children && n.children.length > 0) return n.children.some(child => hasMatch(child, query));
    return false;
  };

  const matchesSearch = searchQuery === '' || (node.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (node.cargoNome || '').toLowerCase().includes(searchQuery.toLowerCase()) || (node.areaNome || '').toLowerCase().includes(searchQuery.toLowerCase());
  const shouldRender = searchQuery === '' || matchesSearch || hasMatch(node, searchQuery);
  if (searchQuery !== '' && !shouldRender) return null;

  return (
    <div className={`tree-node level-${level}`}>
      <div className={`collaborator-card glass-card ${isCompact ? 'compact-parent' : ''} ${node.subordinateCount > 0 ? 'has-subordinates' : ''} ${isExpanded ? 'expanded' : ''} ${matchesSearch && searchQuery !== '' ? 'highlight' : ''}`}>
        <div className="org-avatar-wrapper" onClick={() => hasChildren && toggleNode(node.id)}>
          {node.avatarUrl ? (
            <img 
              src={node.avatarUrl} 
              alt={node.name || 'Colaborador'} 
              className="org-avatar"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div className="org-avatar-placeholder" style={{ 
            display: node.avatarUrl ? 'none' : 'flex', 
            background: (node.color && node.color !== '#ffffff' && node.color !== '#fff') ? node.color : 'var(--primary)' 
          }}>
            {(node.name || '?').charAt(0).toUpperCase()}
          </div>
          {hasChildren && <div className={`expand-indicator ${isExpanded ? 'rotated' : ''}`}><span className="material-symbols-outlined">expand_more</span></div>}
        </div>
        <div className="org-info">
          <h4 className="org-name">{node.name}</h4>
          <div className="org-badge-group">
            <p className="org-role">{node.cargoNome || 'Colaborador'}</p>
            <p className="org-area">{node.areaNome || 'Sem Área'}</p>
          </div>
          {node.subordinateCount > 0 && (
            <div className="subordinate-badge" title={`${node.subordinateCount} colaboradores na hierarquia`}>
              <span className="material-symbols-outlined">group</span>
              <span>{node.subordinateCount}</span>
            </div>
          )}
          <button className="btn-open-profile" onClick={(e) => { e.stopPropagation(); onOpenProfile(node); }}>
            <span className="material-symbols-outlined">visibility</span> Visualizar Perfil
          </button>
          <button className="btn-open-profile-mini" onClick={(e) => { e.stopPropagation(); onOpenProfile(node); }} title="Ver Perfil">
            <span className="material-symbols-outlined">info</span>
          </button>
        </div>
      </div>
      {hasChildren && isExpanded && (
        <div className="node-children">
          {node.children.map(child => (
            <OrganogramNode 
              key={child.id} 
              node={child} 
              expandedNodes={expandedNodes} 
              expandedLevels={expandedLevels}
              toggleNode={toggleNode} 
              onOpenProfile={onOpenProfile} 
              searchQuery={searchQuery} 
              level={level + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileFeed({ employee, onBack, currentUser, authToken, onUpdate, setToast }) {
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const [isEditing, setIsEditing] = useState(false);
  const [activeSection, setActiveSection] = useState(null); // 'timeline' | 'education' | 'merit' | null
  const [modalConfig, setModalConfig] = useState(null); // { type: 'timeline'|'education'|'merit', index: number|null, data: object }
  const [formData, setFormData] = useState({
    ...employee,
    nome: employee.name, // Mapeamento necessário para o backend
    resumoProfissional: employee.resumoProfissional || '',
    timelineRealizacoes: employee.timelineRealizacoes || '[]',
    formacoes: employee.formacoes || '[]',
    meritosPromocoes: employee.meritosPromocoes || '[]',
    avatarUrl: employee.avatarUrl || '',
    exibirIdade: employee.exibirIdade || false
  });

  const canEdit = currentUser.isAdmin || String(currentUser.colaboradorId) === String(employee.id) || String(currentUser.colaboradorId) === String(employee.gestorId);
  const timeline = useMemo(() => { 
    try { 
      const data = JSON.parse(formData.timelineRealizacoes); 
      return Array.isArray(data) ? [...data].sort((a, b) => parseDateToComparable(b.year) - parseDateToComparable(a.year)) : [];
    } catch(e) { return []; } 
  }, [formData.timelineRealizacoes]);

  const formacoes = useMemo(() => { 
    try { 
      const data = JSON.parse(formData.formacoes); 
      return Array.isArray(data) ? [...data].sort((a, b) => parseDateToComparable(b.yearConclusion) - parseDateToComparable(a.yearConclusion)) : [];
    } catch(e) { return []; } 
  }, [formData.formacoes]);

  const meritos = useMemo(() => { 
    try { 
      const data = JSON.parse(formData.meritosPromocoes); 
      return Array.isArray(data) ? [...data].sort((a, b) => parseDateToComparable(b.date) - parseDateToComparable(a.date)) : [];
    } catch(e) { return []; } 
  }, [formData.meritosPromocoes]);

  const handleSave = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/colaboradores/${employee.id}`, {
        method: 'PUT',
        headers: apiHeaders(authToken),
        body: JSON.stringify(formData)
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Falha ao salvar');
      }
      setToast({ title: 'Sucesso', message: 'Perfil atualizado com sucesso!' });
      setIsEditing(false);
      onUpdate();
    } catch (e) { setToast({ title: 'Erro', message: e.message, type: 'error' }); }
  };

  const openModal = (type, index = null) => {
    let data = {};
    if (index !== null) {
      if (type === 'timeline') data = timeline[index];
      if (type === 'education') data = formacoes[index];
      if (type === 'merit') data = meritos[index];
    } else {
      if (type === 'timeline') data = { year: '', title: '', desc: '' };
      if (type === 'education') data = { course: '', school: '', yearConclusion: '' };
      if (type === 'merit') data = { title: '', date: '', type: '' };
    }
    setModalConfig({ type, index, data });
  };

  const saveModalData = (newData) => {
    const { type, index } = modalConfig;
    if (type === 'timeline') {
      const nl = [...timeline];
      if (index !== null) nl[index] = newData; else nl.push(newData);
      setFormData(p => ({ ...p, timelineRealizacoes: JSON.stringify(nl) }));
    }
    if (type === 'education') {
      const nl = [...formacoes];
      if (index !== null) nl[index] = newData; else nl.push(newData);
      setFormData(p => ({ ...p, formacoes: JSON.stringify(nl) }));
    }
    if (type === 'merit') {
      const nl = [...meritos];
      if (index !== null) nl[index] = newData; else nl.push(newData);
      setFormData(p => ({ ...p, meritosPromocoes: JSON.stringify(nl) }));
    }
    setModalConfig(null);
  };

  const removeItem = (type, index) => {
    if (!confirm('Deseja realmente remover este item?')) return;
    if (type === 'timeline') {
      const nl = timeline.filter((_, i) => i !== index);
      setFormData(p => ({ ...p, timelineRealizacoes: JSON.stringify(nl) }));
    }
    if (type === 'education') {
      const nl = formacoes.filter((_, i) => i !== index);
      setFormData(p => ({ ...p, formacoes: JSON.stringify(nl) }));
    }
    if (type === 'merit') {
      const nl = meritos.filter((_, i) => i !== index);
      setFormData(p => ({ ...p, meritosPromocoes: JSON.stringify(nl) }));
    }
  };

  return (
    <div className="profile-feed-container animate-slide-up p-4 lg:p-6 max-w-[1600px] mx-auto">
      {/* Header com Ações Principais */}
      <header className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <button 
          className="btn-back-exe"
          onClick={onBack}
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Voltar para Estrutura
        </button>
        
        <div className="flex items-center gap-3">
          {canEdit && (
            <button 
              className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all shadow-lg ${
                isEditing 
                ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20' 
                : 'bg-primary text-white hover:opacity-90 shadow-primary/20'
              }`}
              onClick={isEditing ? handleSave : () => setIsEditing(true)}
            >
              <span className="material-symbols-outlined text-lg">
                {isEditing ? 'check_circle' : 'edit'}
              </span>
              {isEditing ? 'Salvar Alterações' : 'Editar Perfil'}
            </button>
          )}
          {isEditing && (
            <button 
              className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-bold transition-all"
              onClick={() => setIsEditing(false)}
            >
              Cancelar
            </button>
          )}
        </div>
      </header>
      
      {/* Grid Principal: 30% Sidebar | 70% Main */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        
        {/* Sidebar (30%) */}
        <aside className="lg:col-span-3">
          <div className="glass-card compact-premium rounded-[2rem] p-6 sticky top-6 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="relative group mb-6">
                <div className="w-32 h-32 rounded-3xl overflow-hidden border-4 border-primary/30 shadow-2xl">
                  {employee.avatarUrl ? (
                    <img 
                      src={`${API_BASE}/api/colaboradores/${employee.id}/avatar?full=true`} 
                      className="w-full h-full object-cover" 
                      alt={employee.name}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="avatar-placeholder-exe w-full h-full flex items-center justify-center text-4xl font-black text-primary" style={{ display: employee.avatarUrl ? 'none' : 'flex' }}>
                    {(employee.name || '?').charAt(0).toUpperCase()}
                  </div>
                </div>
              </div>

              <h2 className="profile-name-exe mb-1 tracking-tight dark:text-white">{employee.name}</h2>
              <p className="profile-role-exe mb-1 dark:text-white">{employee.cargoNome}</p>
              <p className="text-muted dark:text-slate-400 text-xs font-semibold mb-6 opacity-80">{employee.areaNome}</p>
              
              <div className="w-full space-y-3 mb-8">
                <div className="profile-info-box-exe text-left">
                  <span className="material-symbols-outlined text-primary text-xl">mail</span>
                  <span className="text-slate-600 dark:text-slate-100 text-xs truncate font-medium">{employee.email}</span>
                </div>
                <div className="profile-info-box-exe text-left">
                  <span className="material-symbols-outlined text-primary text-xl">calendar_today</span>
                  <span className="text-slate-600 dark:text-slate-100 text-xs font-medium">Desde {formatDate(employee.dataAdmissao)}</span>
                </div>
              </div>

              <div className="w-full text-left">
                <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500 dark:text-slate-400 mb-3 ml-1">Resumo Profissional</h4>
                {isEditing ? (
                  <textarea 
                    className="profile-summary-edit-exe min-h-[120px]"
                    value={formData.resumoProfissional} 
                    onChange={(e) => setFormData(prev => ({ ...prev, resumoProfissional: e.target.value }))}
                    placeholder="Sua trajetória..."
                  />
                ) : (
                  <div className="profile-summary-box-exe text-left">
                    <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-100 font-medium whitespace-pre-wrap">
                      {employee.resumoProfissional || 'Nenhum resumo profissional cadastrado.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
        
        {/* Main Content (70%) */}
        <main className="lg:col-span-7 flex flex-col gap-6">
          
          {activeSection === null ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-full">
              
              {/* TIMELINE (Span 2 columns if mobile, 1 in XL) */}
              <section 
                className="glass-card timeline-exe-card rounded-[2rem] p-5 flex flex-col hover:border-primary/30 transition-all cursor-pointer group relative overflow-hidden"
                onClick={() => setActiveSection('timeline')}
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                      <span className="material-symbols-outlined text-primary text-xl">timeline</span>
                    </div>
                    <div>
                      <h3 className="label-exe-large text-sm dark:text-white">Linha do Tempo</h3>
                      <p className="text-muted dark:text-slate-400 text-[10px] font-bold opacity-70">Principais marcos e realizações</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditing && (
                      <button 
                        className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-emerald-500/20"
                        onClick={(e) => { e.stopPropagation(); openModal('timeline'); }}
                      >
                        <span className="material-symbols-outlined text-lg">add</span>
                      </button>
                    )}
                    <span className="material-symbols-outlined text-slate-600 group-hover:text-primary transition-colors">open_in_full</span>
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  {timeline.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="relative pl-6 pb-4 last:pb-0 group/item">
                      <div className="absolute left-[3px] top-1 w-[2px] h-full bg-slate-700 group-last/item:h-2"></div>
                      <div className="absolute left-0 top-1 w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(51,204,204,0.5)]"></div>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-black text-primary dark:text-primary-2 mb-1 block uppercase">{item.year || '---'}</span>
                          <h4 className="text-xs font-bold text-slate-600 dark:text-white line-clamp-1">{item.title}</h4>
                        </div>
                        {isEditing && (
                          <button 
                            className="text-slate-600 hover:text-red-400 transition-colors p-1"
                            onClick={(e) => { e.stopPropagation(); removeItem('timeline', idx); }}
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {timeline.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-600 opacity-40 italic">
                      <span className="material-symbols-outlined text-4xl mb-2">history</span>
                      <p className="text-[10px] font-bold uppercase tracking-widest">Nenhum registro</p>
                    </div>
                  )}
                </div>
              </section>

              {/* RECOGNITION & EDUCATION (Vertical Stack in XL) */}
              <div className="flex flex-col gap-6">
                
                {/* RECOGNITION */}
                <section 
                  className="glass-card recognition-exe-card rounded-[2rem] p-5 flex flex-col hover:border-primary/30 transition-all cursor-pointer group"
                  onClick={() => setActiveSection('merit')}
                >
                  <div className="flex justify-between items-start mb-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                        <span className="material-symbols-outlined text-amber-500 text-xl">workspace_premium</span>
                      </div>
                      <div>
                        <h3 className="label-exe-large text-sm">Reconhecimento</h3>
                        <p className="text-muted text-[10px] font-bold opacity-70">Conquistas de destaque</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing && (
                        <button 
                          className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-emerald-500/20"
                          onClick={(e) => { e.stopPropagation(); openModal('merit'); }}
                        >
                          <span className="material-symbols-outlined text-lg">add</span>
                        </button>
                      )}
                      <span className="material-symbols-outlined text-slate-600 group-hover:text-amber-500 transition-colors">open_in_full</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {meritos.slice(0, 3).map((item, idx) => {
                      const typeClass = 
                        item.type === 'TKS' ? 'type-tks' : 
                        item.type === 'Promoção' ? 'type-promotion' : 
                        item.type === 'Mérito' ? 'type-merit' : 
                        item.type === 'Recompensa' ? 'type-reward' : 'type-merit';
                        
                      return (
                        <div key={idx} className="profile-item-exe">
                          <div className="flex items-center gap-3">
                            <div className={`profile-item-icon-exe ${typeClass}`}>
                              <span className="material-symbols-outlined">
                                {item.type === 'TKS' && 'volunteer_activism'}
                                {item.type === 'Recompensa' && 'redeem'}
                                {item.type === 'Mérito' && 'workspace_premium'}
                                {item.type === 'Promoção' && 'trending_up'}
                                {(!['TKS', 'Recompensa', 'Mérito', 'Promoção'].includes(item.type)) && 'stars'}
                              </span>
                            </div>
                            <div>
                              <span className={`text-[9px] font-black uppercase ${typeClass.replace('type-', 'text-')}`}>{item.type}</span>
                              <h4 className="text-xs font-bold text-slate-600 dark:text-white line-clamp-2">{item.title}</h4>
                            </div>
                          </div>
                          {isEditing && (
                            <button 
                              className="text-slate-600 hover:text-red-400 transition-colors"
                              onClick={(e) => { e.stopPropagation(); removeItem('merit', idx); }}
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {meritos.length === 0 && (
                      <div className="py-4 text-center text-slate-600 opacity-40 italic">
                        <p className="text-[9px] font-bold uppercase tracking-widest">Sem méritos registrados</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* EDUCATION */}
                <section 
                  className="glass-card education-exe-card rounded-[2rem] p-5 flex flex-col hover:border-primary/30 transition-all cursor-pointer group"
                  onClick={() => setActiveSection('education')}
                >
                  <div className="flex justify-between items-start mb-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <span className="material-symbols-outlined text-emerald-500 text-xl">school</span>
                      </div>
                      <div>
                        <h3 className="label-exe-large text-sm">Formação</h3>
                        <p className="text-muted text-[10px] font-bold opacity-70">Educação e certificados</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing && (
                        <button 
                          className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-emerald-500/20"
                          onClick={(e) => { e.stopPropagation(); openModal('education'); }}
                        >
                          <span className="material-symbols-outlined text-lg">add</span>
                        </button>
                      )}
                      <span className="material-symbols-outlined text-slate-600 group-hover:text-emerald-500 transition-colors">open_in_full</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {formacoes.slice(0, 2).map((item, idx) => (
                      <div key={idx} className="profile-item-exe">
                        <div className="flex items-center gap-3">
                          <div className="profile-item-icon-exe edu-item-icon-exe">
                            <span className="material-symbols-outlined">school</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-slate-600 dark:text-white mb-0.5 line-clamp-2">{item.course}</h4>
                            <p className="text-[10px] text-muted dark:text-slate-400 font-bold opacity-70 uppercase tracking-wider">{item.school}</p>
                          </div>
                        </div>
                        {isEditing && (
                          <button 
                            className="text-slate-600 hover:text-red-400 transition-colors"
                            onClick={(e) => { e.stopPropagation(); removeItem('education', idx); }}
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        )}
                      </div>
                    ))}
                    {formacoes.length === 0 && (
                      <div className="py-4 text-center text-slate-600 opacity-40 italic">
                        <p className="text-[9px] font-bold uppercase tracking-widest">Sem formação cadastrada</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          ) : (
            /* VISUALIZAÇÃO DETALHADA (MODAL) */
            <div className="glass-card rounded-[2.5rem] p-8 min-h-[600px] flex flex-col relative animate-zoom-in shadow-2xl">
              <button 
                className="absolute top-8 left-8 flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-bold text-xs uppercase tracking-widest"
                onClick={() => setActiveSection(null)}
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                Voltar
              </button>

              <div className="mt-12 mb-8 flex justify-between items-end border-b border-slate-200 dark:border-white/5 pb-6">
                <div>
                  <h3 className="text-3xl font-black text-title tracking-tighter uppercase">
                    {activeSection === 'timeline' && 'Linha do Tempo'}
                    {activeSection === 'merit' && 'Reconhecimentos'}
                    {activeSection === 'education' && 'Formação Acadêmica'}
                  </h3>
                  <p className="text-muted font-bold text-xs uppercase tracking-widest mt-2">Detalhamento completo e histórico</p>
                </div>
                {isEditing && (
                  <button 
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-105 transition-all"
                    onClick={() => openModal(activeSection)}
                  >
                    <span className="material-symbols-outlined">add</span>
                    Adicionar Novo
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                {activeSection === 'timeline' && (
                  <div className="space-y-8 pl-4">
                    {timeline.map((item, idx) => (
                      <div key={idx} className="relative pl-10 group/item">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200 dark:bg-slate-700/50 rounded-full"></div>
                        <div className="absolute -left-[5px] top-1 w-4 h-4 rounded-full bg-primary border-4 border-white dark:border-slate-900 shadow-[0_0_15px_rgba(51,204,204,0.4)]"></div>
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-primary font-black text-xs uppercase tracking-widest mb-2 block">{item.year}</span>
                            <h4 className="text-lg font-bold text-title mb-2">{item.title}</h4>
                            <p className="text-muted text-sm leading-relaxed max-w-2xl">{item.desc}</p>
                          </div>
                          {isEditing && (
                           <div className="flex gap-2">
                              <button onClick={() => openModal('timeline', idx)} className="p-2 bg-slate-100 dark:bg-slate-700/50 hover:bg-primary/20 text-slate-400 hover:text-primary rounded-xl transition-all"><span className="material-symbols-outlined">edit</span></button>
                              <button onClick={() => removeItem('timeline', idx)} className="p-2 bg-slate-100 dark:bg-slate-700/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl transition-all"><span className="material-symbols-outlined">delete</span></button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeSection === 'merit' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {meritos.map((item, idx) => {
                      const typeClass = 
                        item.type === 'TKS' ? 'type-tks' : 
                        item.type === 'Promoção' ? 'type-promotion' : 
                        item.type === 'Mérito' ? 'type-merit' : 
                        item.type === 'Recompensa' ? 'type-reward' : 'type-merit';
                        
                      return (
                        <div key={idx} className="profile-item-modal-exe">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${typeClass}`} style={{ fontSize: '20px' }}>
                              <span className="material-symbols-outlined">
                                {item.type === 'TKS' && 'volunteer_activism'}
                                {item.type === 'Recompensa' && 'redeem'}
                                {item.type === 'Mérito' && 'workspace_premium'}
                                {item.type === 'Promoção' && 'trending_up'}
                                {(!['TKS', 'Recompensa', 'Mérito', 'Promoção'].includes(item.type)) && 'stars'}
                              </span>
                            </div>
                            <div>
                              <span className={`font-black text-[9px] uppercase tracking-widest ${typeClass.replace('type-', 'text-')}`}>{item.type}</span>
                              <h4 className="text-title font-bold text-base mt-0.5 dark:text-white">{item.title}</h4>
                              <p className="text-muted text-[10px] mt-0.5 font-bold dark:text-slate-400">{item.date}</p>
                            </div>
                          </div>
                          {isEditing && (
                            <div className="flex gap-2">
                              <button onClick={() => openModal('merit', idx)} className="p-2 text-slate-500 hover:text-primary transition-colors"><span className="material-symbols-outlined">edit</span></button>
                              <button onClick={() => removeItem('merit', idx)} className="p-2 text-slate-500 hover:text-red-400 transition-colors"><span className="material-symbols-outlined">delete</span></button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeSection === 'education' && (
                  <div className="space-y-4">
                    {formacoes.map((item, idx) => (
                      <div key={idx} className="profile-item-modal-exe">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-2xl edu-item-icon-exe flex items-center justify-center shrink-0" style={{ fontSize: '28px' }}>
                            <span className="material-symbols-outlined">school</span>
                          </div>
                          <div>
                            <h4 className="text-title font-bold text-lg leading-tight dark:text-white">{item.course}</h4>
                            <div className="flex items-center gap-3 mt-1.5">
                              <p className="text-muted font-black text-[10px] uppercase tracking-widest dark:text-slate-400">{item.school}</p>
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[9px] font-black rounded border border-emerald-500/20">{item.yearConclusion}</span>
                            </div>
                          </div>
                        </div>
                         {isEditing && (
                          <div className="flex gap-2">
                             <button onClick={() => openModal('education', idx)} className="p-3 bg-slate-100 dark:bg-white/5 hover:bg-primary/20 text-slate-500 hover:text-primary rounded-2xl transition-all"><span className="material-symbols-outlined">edit</span></button>
                             <button onClick={() => removeItem('education', idx)} className="p-3 bg-slate-100 dark:bg-white/5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-2xl transition-all"><span className="material-symbols-outlined text-lg">delete</span></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {modalConfig && (
        <EditModal 
          config={modalConfig} 
          onClose={() => setModalConfig(null)} 
          onSave={saveModalData} 
        />
      )}
    </div>
  );
}

function EditModal({ config, onClose, onSave }) {
  const [localData, setLocalData] = React.useState({ ...config.data });
  const titles = { timeline: 'Realização', education: 'Formação Acadêmica', merit: 'Reconhecimento' };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />
      
      <div className="relative w-full max-w-xl glass-card rounded-[2.5rem] shadow-2xl overflow-hidden animate-zoom-in" onClick={e => e.stopPropagation()}>
        <header className="p-8 border-b border-slate-200 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-white/5">
          <div>
            <h3 className="text-xl font-black text-title uppercase tracking-tighter">
              {config.index !== null ? 'Editar' : 'Adicionar'} {titles[config.type]}
            </h3>
            <p className="text-muted text-[10px] font-bold uppercase tracking-widest mt-1">Gestão de Perfil Profissional</p>
          </div>
          <button 
            className="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-title transition-all flex items-center justify-center" 
            onClick={onClose}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="p-8 space-y-6">
          {config.type === 'timeline' && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-2 ml-1">Mês/Ano</label>
                  <input 
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-2xl p-4 text-sm text-title focus:border-primary outline-none transition-all" 
                    value={localData.year} 
                    onChange={e => setLocalData(p => ({ ...p, year: e.target.value }))} 
                    placeholder="MAI/2026" 
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-2 ml-1">Título da Conquista</label>
                  <input 
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-2xl p-4 text-sm text-title focus:border-primary outline-none transition-all" 
                    value={localData.title} 
                    onChange={e => setLocalData(p => ({ ...p, title: e.target.value }))} 
                    placeholder="Ex: Promoção a Líder" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-2 ml-1">Descrição Detalhada</label>
                <textarea 
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-2xl p-4 text-sm text-title focus:border-primary outline-none min-h-[120px] transition-all" 
                  value={localData.desc} 
                  onChange={e => setLocalData(p => ({ ...p, desc: e.target.value }))} 
                  placeholder="Descreva os detalhes deste marco..." 
                />
              </div>
            </div>
          )}

          {config.type === 'education' && (
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-2 ml-1">Curso / Graduação</label>
                <input 
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-2xl p-4 text-sm text-title focus:border-primary outline-none transition-all" 
                  value={localData.course} 
                  onChange={e => setLocalData(p => ({ ...p, course: e.target.value }))} 
                  placeholder="Ex: Ciência da Computação" 
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-2 ml-1">Instituição</label>
                  <input 
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-2xl p-4 text-sm text-title focus:border-primary outline-none transition-all" 
                    value={localData.school} 
                    onChange={e => setLocalData(p => ({ ...p, school: e.target.value }))} 
                    placeholder="Universidade Federal" 
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-2 ml-1">Conclusão</label>
                  <input 
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-2xl p-4 text-sm text-title focus:border-primary outline-none transition-all" 
                    value={localData.yearConclusion} 
                    onChange={e => setLocalData(p => ({ ...p, yearConclusion: e.target.value }))} 
                    placeholder="2020" 
                  />
                </div>
              </div>
            </div>
          )}

          {config.type === 'merit' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-2 ml-1">Tipo de Mérito</label>
                  <select 
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-2xl p-4 text-sm text-title focus:border-primary outline-none transition-all appearance-none"
                    value={localData.type} 
                    onChange={e => setLocalData(p => ({ ...p, type: e.target.value }))}
                  >
                    <option value="">Selecione...</option>
                    <option value="TKS">TKS</option>
                    <option value="Recompensa">Recompensa</option>
                    <option value="Mérito">Mérito</option>
                    <option value="Promoção">Promoção</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-2 ml-1">Título</label>
                  <input 
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-2xl p-4 text-sm text-title focus:border-primary outline-none transition-all" 
                    value={localData.title} 
                    onChange={e => setLocalData(p => ({ ...p, title: e.target.value }))} 
                    placeholder="Colaborador do Mês" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Data</label>
                <input 
                  className="w-full bg-slate-800 border border-white/5 rounded-2xl p-4 text-sm text-white focus:border-primary outline-none transition-all" 
                  value={localData.date} 
                  onChange={e => setLocalData(p => ({ ...p, date: e.target.value }))} 
                  placeholder="MAI/2026" 
                />
              </div>
            </div>
          )}
        </div>

        <footer className="p-8 border-t border-white/5 flex gap-4 bg-white/5">
          <button 
            className="flex-1 px-6 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold transition-all" 
            onClick={onClose}
          >
            Cancelar
          </button>
          <button 
            className="flex-1 px-6 py-4 bg-primary hover:opacity-90 text-white rounded-2xl font-bold shadow-xl shadow-primary/20 transition-all" 
            onClick={() => onSave(localData)}
          >
            Confirmar Alterações
          </button>
        </footer>
      </div>
    </div>
  );
}
