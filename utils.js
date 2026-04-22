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
  { id: 'scale', title: 'Escala Mensal', caption: 'Dias presenciais e remotos', icon: 'calendar_month' }
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

const weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function toDate(value) {
  return new Date(value + 'T00:00:00');
}

function formatDate(value) {
  if (!value) return '—';
  return toDate(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function diffDays(start, end) {
  const ms = toDate(end) - toDate(start);
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
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
  if (!start || !end) return false;
  const current = toDate(day);
  return current >= toDate(start) && current <= toDate(end);
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
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef(null);

  const filteredOptions = useMemo(() => {
    const s = search.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(s));
  }, [options, search]);

  const selectedOption = options.find(o => String(o.value) === String(value));

  useEffect(() => {
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
        style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid var(--line)', padding: '0 12px', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.9rem' }}
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
          borderRadius: '12px', 
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

function ResizableHeader({ label, width, onResize, className = "", idPrefix = "" }) {
  const [isResizing, setIsResizing] = useState(false);
  const elementId = `th-${idPrefix}${label.replace(/\s+/g, '')}`;

  const startResizing = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    const table = e.target.closest('table');
    if (table) table.classList.add('resizing');
  }, []);

  const stopResizing = useCallback((e) => {
    setIsResizing(false);
    const th = document.getElementById(elementId);
    if (th && e && e.clientX) {
      const rect = th.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      if (newWidth > 40 && onResize) onResize(newWidth);
    }
  }, [elementId, onResize]);

  const resize = useCallback((e) => {
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

  useEffect(() => {
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
    <th id={elementId} className={`resizable-th ${className}`} style={{ width: width ? `${width}px` : 'auto', borderRight: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: className.includes('center') ? 'center' : 'flex-start', padding: className.includes('center') ? '8px 4px' : '8px 12px', overflow: 'hidden' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {className.includes('tooltip-target') && <span className="material-symbols-outlined" style={{ fontSize: '14px', marginLeft: '4px', opacity: 0.5, flexShrink: 0 }}>info</span>}
      </div>
      <div className={`resizer ${isResizing ? 'resizing' : ''}`} onMouseDown={startResizing} />
    </th>
  );
}
