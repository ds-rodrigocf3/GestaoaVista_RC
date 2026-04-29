const employees = [];
const initialRequests = [];
const initialTasks = [];

const initialFilters = {
  employeeId: '',
  type: 'Férias integrais',
  startDate: '',
  endDate: '',
  coverage: '',
  note: ''
};

// Resolução Dinâmica do Backend
const API_BASE = window.location.protocol === 'file:'
  ? 'http://localhost:3000'
  : window.location.origin;

const views = [
  { id: 'dashboard', title: 'Resumo geral', caption: 'Panorama com status e equipe', icon: 'dashboard' },
  { id: 'tasks', title: 'Gestão de Demandas', caption: 'Tarefas e alocações', icon: 'view_kanban' },
  { id: 'requests', title: 'Agendamentos', caption: 'Férias e afastamentos', icon: 'add_circle' },
  { id: 'approvals', title: 'Aprovações', caption: 'Gestão de solicitações', icon: 'fact_check' },
  { id: 'scale', title: 'Escala Mensal', caption: 'Dias presenciais e remotos', icon: 'calendar_month' },
  { id: 'eventos', title: 'Eventos', caption: 'Agenda corporativa da equipe', icon: 'event' }
];


function apiHeaders(token) {
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) };
}

function getStatusPillClass(s) {
  if (s === 'Concluído') return 'done';
  if (s === 'Em Andamento') return 'working';
  if (s === 'Bloqueio') return 'stuck';
  if (s === 'Pausado') return 'warning';
  if (s === 'Cancelado') return 'rejected';
  return 'not-started';
}

const EVENT_TYPE_STYLES = {
  'Reunião':           { bg: 'rgba(51,204,204,0.12)',   color: 'var(--primary)',  icon: 'groups' },
  'Workshop':          { bg: 'rgba(139,92,246,0.12)',   color: '#8b5cf6',         icon: 'school' },
  'Apresentação':      { bg: 'rgba(59,130,246,0.12)',   color: '#3b82f6',         icon: 'present_to_all' },
  'Treinamento':       { bg: 'rgba(245,158,11,0.12)',   color: '#f59e0b',         icon: 'menu_book' },
  'Evento Corporativo': { bg: 'rgba(100,116,139,0.12)', color: 'var(--muted)',    icon: 'business' },
  'Aniversário':       { bg: 'rgba(255, 51, 153, 0.15)', color: '#ff3399',         icon: 'celebration' },
  'Outro':             { bg: 'rgba(51,204,204,0.08)',   color: 'var(--primary)',  icon: 'event' }
};

const weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function toDate(value) {
  if (!value) return new Date(NaN);
  let d;
  
  if (value instanceof Date) {
    d = new Date(value.getTime());
  } else {
    const str = String(value).trim();
    
    // 1. Caso especial: DD/MM/YYYY
    const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (brMatch) {
      d = new Date(parseInt(brMatch[3], 10), parseInt(brMatch[2], 10) - 1, parseInt(brMatch[1], 10));
    } else {
      // 2. Caso ISO: YYYY-MM-DD
      const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        const y = parseInt(isoMatch[1], 10);
        const m = parseInt(isoMatch[2], 10) - 1;
        const day = parseInt(isoMatch[3], 10);
        
        const tMatch = str.match(/T(\d{2}):(\d{2})/);
        if (tMatch && (parseInt(tMatch[1], 10) !== 0 || parseInt(tMatch[2], 10) !== 0)) {
          d = new Date(str);
        } else {
          d = new Date(y, m, day);
        }
      } else {
        d = new Date(str);
      }
    }
  }
  
  if (!isNaN(d.getTime())) {
    d.setHours(12, 0, 0, 0);
  }
  return d;
}

function formatDateLocal(d) {
  if (!d || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(value) {
  if (!value) return '—';
  const d = toDate(value);
  if (isNaN(d.getTime())) return String(value); // Retorna o original se falhar o parse
  
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function diffDays(start, end) {
  if (!start) return 0;
  const s = toDate(start);
  const e = end ? toDate(end) : s; // Se não houver fim, considera 1 dia (o próprio início)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  const ms = e - s;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24))) + 1;
}

function getBrazilianHolidays(year) {
  // Cálculo da Páscoa (Algoritmo de Meeus/Jones/Butcher)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const pascoa = new Date(year, month - 1, day);

  const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

  const carnaval = addDays(pascoa, -47);
  const sextaSanta = addDays(pascoa, -2);
  const corpusChristi = addDays(pascoa, 60);

  const format = (d) => {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  return {
    [`${year}-01-01`]: 'Confraternização Universal',
    [format(carnaval)]: 'Carnaval',
    [format(sextaSanta)]: 'Paixão de Cristo',
    [format(pascoa)]: 'Páscoa',
    [`${year}-04-21`]: 'Tiradentes',
    [`${year}-05-01`]: 'Dia do Trabalho',
    [format(corpusChristi)]: 'Corpus Christi',
    [`${year}-09-07`]: 'Independência do Brasil',
    [`${year}-10-12`]: 'Nossa Sra. Aparecida',
    [`${year}-11-02`]: 'Finados',
    [`${year}-11-15`]: 'Proclamação da República',
    [`${year}-11-20`]: 'Dia da Consciência Negra',
    [`${year}-12-25`]: 'Natal'
  };
}

function isWithinRange(day, start, end) {
  if (!start) return false;
  const current = toDate(day);
  const s = toDate(start);
  const e = end ? toDate(end) : s;
  if (isNaN(current.getTime()) || isNaN(s.getTime()) || isNaN(e.getTime())) return false;
  return current.getTime() >= s.getTime() && current.getTime() <= e.getTime();
}

function rangesOverlap(startA, endA, startB, endB) {
  return toDate(startA) <= toDate(endB) && toDate(endA) >= toDate(startB);
}

function getConflictLevel(conflicts) {
  if (!conflicts) return 'Nenhum';
  if (conflicts.length >= 2) return 'Alto';
  if (conflicts.length === 1) return 'Médio';
  return 'Nenhum';
}

function getConflictClass(level) {
  if (level === 'Alto') return 'high';
  if (level === 'Médio') return 'medium';
  return 'none';
}

function getStatusClass(status) {
  if (status === 'Aprovado') return 'approved';
  if (status === 'Rejeitado') return 'rejected';
  return 'pending';
}

function getMonthMatrix(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];
  for (let i = 0; i < firstDay.getDay(); i += 1) days.push(null);
  for (let day = 1; day <= lastDay.getDate(); day += 1) days.push(new Date(year, month, day));
  return days;
}

// Global UI Components
function SearchableSelect({ options, value, onChange, placeholder = "Selecione..." }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const containerRef = React.useRef(null);

  const filteredOptions = React.useMemo(() => {
    const s = search.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(s));
  }, [options, search]);

  const selectedOption = options.find(o => String(o.value) === String(value));

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="searchable-select-container" ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        className="searchable-select-input"
        placeholder={selectedOption ? selectedOption.label : placeholder}
        value={isOpen ? search : ''}
        onFocus={() => { setIsOpen(true); setSearch(''); }}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', height: '42px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', padding: '0 12px', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.9rem' }}
      />
      {isOpen && (
        <div className="searchable-select-dropdown" style={{ 
          position: 'absolute', 
          top: '105%', 
          left: 0, 
          right: 0, 
          zIndex: 9999, 
          background: 'var(--card)', 
          border: '1px solid var(--line)', 
          borderRadius: 'var(--radius-md)', 
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)', 
          maxHeight: '200px', 
          overflowY: 'auto' 
        }}>
          {filteredOptions.length > 0 ? filteredOptions.map(opt => (
            <div
              key={opt.value}
              className={`searchable-select-option ${String(opt.value) === String(value) ? 'selected' : ''}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
                setSearch('');
              }}
              style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '0.88rem' }}
            >
              {opt.label}
            </div>
          )) : <div style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: '0.82rem' }}>Nenhum resultado</div>}
        </div>
      )}
    </div>
  );
}

function MultiSelect({ options, value, onChange, placeholder = "Selecione..." }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const containerRef = React.useRef(null);

  const selectedValues = React.useMemo(() => {
    if (!value) return [];
    return String(value).split(',').filter(v => v !== '').map(v => String(v));
  }, [value]);

  const filteredOptions = React.useMemo(() => {
    const s = search.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(s));
  }, [options, search]);

  const toggleValue = (val) => {
    const v = String(val);
    let next;
    if (selectedValues.includes(v)) {
      next = selectedValues.filter(x => x !== v);
    } else {
      next = [...selectedValues, v];
    }
    onChange(next.join(','));
  };

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayText = React.useMemo(() => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) {
      const opt = options.find(o => String(o.value) === selectedValues[0]);
      return opt ? opt.label : placeholder;
    }
    return `${selectedValues.length} selecionados`;
  }, [selectedValues, options, placeholder]);

  return (
    <div className="searchable-select-container" ref={containerRef} style={{ position: 'relative' }}>
      <div 
        className="searchable-select-input" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          width: '100%', minHeight: '42px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', 
          padding: '0 12px', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.9rem',
          display: 'flex', alignItems: 'center', cursor: 'pointer', justifyContent: 'space-between',
          overflow: 'hidden', boxSizing: 'border-box'
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>{displayText}</span>
        <span className="material-symbols-outlined" style={{ fontSize: '18px', opacity: 0.5, marginLeft: '8px', flexShrink: 0 }}>{isOpen ? 'expand_less' : 'expand_more'}</span>
      </div>
      
      {isOpen && (
        <div className="searchable-select-dropdown" style={{ 
          position: 'absolute', top: '105%', left: 0, right: 0, zIndex: 99999, 
          background: 'var(--surface)', backgroundColor: 'var(--surface)',
          border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', 
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)', maxHeight: '250px', overflowY: 'auto',
          opacity: 1
        }}>
          <div style={{ padding: '8px', borderBottom: '1px solid var(--line)' }}>
            <input 
              type="text" 
              autoFocus
              placeholder="Buscar áreas..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', background: 'var(--bg)' }}
            />
          </div>
          <div style={{ padding: '4px 0' }}>
            <div 
              onClick={() => onChange('')}
              style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>backspace</span>
              Limpar seleção
            </div>
            {filteredOptions.length > 0 ? filteredOptions.map(opt => {
              const isSelected = selectedValues.includes(String(opt.value));
              return (
                <div
                  key={opt.value}
                  onClick={() => toggleValue(opt.value)}
                  style={{ 
                    padding: '10px 14px', cursor: 'pointer', fontSize: '0.88rem',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: isSelected ? 'rgba(51, 204, 204, 0.05)' : 'transparent',
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{ 
                    width: '18px', height: '18px', borderRadius: '4px', border: '2px solid var(--line)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isSelected ? 'var(--primary)' : 'transparent',
                    borderColor: isSelected ? 'var(--primary)' : 'var(--line)'
                  }}>
                    {isSelected && <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#fff', fontWeight: 'bold' }}>check</span>}
                  </div>
                  <span style={{ fontWeight: isSelected ? 700 : 400, color: isSelected ? 'var(--title)' : 'var(--text)' }}>{opt.label}</span>
                </div>
              );
            }) : <div style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: '0.82rem' }}>Nenhum resultado</div>}
          </div>
        </div>
      )}
    </div>
  );
}


function ResizableHeader({ label, width, onResize, className = "", idPrefix = "" }) {
  const [isResizing, setIsResizing] = React.useState(false);
  const elementId = `th-${idPrefix}${label.replace(/\s+/g, '')}`;

  const startResizing = React.useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    const table = e.target.closest('table');
    if (table) table.classList.add('resizing');
  }, []);

  const stopResizing = React.useCallback((e) => {
    setIsResizing(false);
    const th = document.getElementById(elementId);
    if (th && e && e.clientX) {
      const rect = th.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      if (newWidth > 40 && onResize) onResize(newWidth);
    }
  }, [elementId, onResize]);

  const resize = React.useCallback((e) => {
    if (isResizing) {
      const th = document.getElementById(elementId);
      if (th) {
        const table = th.closest('table');
        if (table && !table.classList.contains('resizing')) {
          table.classList.add('resizing');
          table.style.width = 'max-content';
        }
        const rect = th.getBoundingClientRect();
        const newWidth = e.clientX - rect.left;
        if (newWidth > 40) {
           th.style.width = `${newWidth}px`;
        }
      }
    }
  }, [isResizing, elementId]);

  React.useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  return (
    <th id={elementId} className={`resizable-th ${className}`} style={{ width: width ? `${width}px` : 'auto', minWidth: width ? `${width}px` : 'auto', borderRight: '1px solid var(--line)', whiteSpace: 'nowrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: className.includes('center') ? 'center' : 'flex-start', padding: className.includes('center') ? '8px 4px' : '8px 12px', overflow: 'hidden', height: '100%' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {className.includes('tooltip-target') && <span className="material-symbols-outlined" style={{ fontSize: '14px', marginLeft: '4px', opacity: 0.5, flexShrink: 0 }}>info</span>}
      </div>
      <div className={`resizer ${isResizing ? 'resizing' : ''}`} onMouseDown={startResizing} style={{ opacity: isResizing ? 1 : 0 }} />
    </th>
  );
}

function getRelativeTime(startDateValue, type = '', endDateValue = null) {
  const now = new Date();
  const startDate = new Date(startDateValue);
  if (isNaN(startDate.getTime())) return null;

  const isAnniversary = type === 'Aniversário';
  const isAbsence = ['Férias integrais', 'Férias fracionadas', 'Day-off', 'Saúde (Exames/Consultas)', 'Licença programada', 'Folga', 'Férias', 'Saúde'].includes(type);
  const isToday = now.toLocaleDateString('pt-BR') === startDate.toLocaleDateString('pt-BR');

  const endDate = endDateValue ? new Date(endDateValue) : null;
  const hasValidEnd = endDate && !isNaN(endDate.getTime());

  if (isAnniversary) {
    if (isToday) return 'Hoje';
    const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const d2 = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'PASSADO';
    return 'Daqui ' + diffDays + (diffDays === 1 ? ' dia' : ' dias');
  }

  // Lógica AGORA / PASSADO para eventos com horário
  if (hasValidEnd) {
    if (now >= startDate && now <= endDate) return 'AGORA';
    if (now > endDate) return 'PASSADO';
  } else if (!isAbsence) {
    // Se não for ausência (que dura o dia todo), e já passou do início
    if (now > startDate) return 'PASSADO';
  }

  const diffMs = startDate - now;
  if (diffMs < 0) {
    if (isToday) return 'Hoje';
    return 'PASSADO';
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (isToday) {
    if (diffHours < 1) return 'Em breve';
    return 'Daqui ' + diffHours + (diffHours === 1 ? ' hora' : ' horas');
  }

  const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d2 = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));

  return 'Daqui ' + diffDays + (diffDays === 1 ? ' dia' : ' dias');
}
