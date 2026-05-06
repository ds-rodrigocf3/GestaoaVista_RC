function LoginModal({ onLogin }) {
  const [email, setEmail] = React.useState('');
  const [senha, setSenha] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const [isDark, setIsDark] = React.useState(() => {
    const saved = localStorage.getItem('gbi_theme');
    if (saved) return saved === 'dark';
    return true; // Default to dark if nothing saved, common in this app
  });

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('gbi_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🔑 Tentando login com email:', email);
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), senha })
      });
      const data = await res.json();
      console.log('📡 Resposta do login - status:', res.status, 'sucesso:', res.ok);
      if (!res.ok) { 
        console.error('❌ Login falhou:', data.error);
        setError(data.error || 'Credenciais inválidas'); 
        setLoading(false); 
        return; 
      }
      console.log('✅ Login bem-sucedido, chamando onLogin');
      onLogin(data.user, data.token);
    } catch (err) {
      console.error('❌ Erro na requisição:', err.message);
      setError('Servidor indisponível. Verifique se o backend está rodando.');
    }
    setLoading(false);
  };

  return (
    <div className="login-overlay">
      <div className="login-card" style={{ position: 'relative' }}>
        <button 
          onClick={() => setIsDark(!isDark)} 
          style={{ 
            position: 'absolute', top: '16px', right: '16px', background: 'transparent', 
            border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', padding: '6px', 
            borderRadius: '50%', transition: 'background 0.2s' 
          }}
          title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(128,128,128,0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
            {isDark ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
        <div className="login-logo">
          <div className="login-logo-icon">📊</div>
          <div>
            <h1>Superintendência de Finanças</h1>
            <p>Gestão à Vista — Acesso Restrito</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label>E-mail corporativo</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu.email@elopar.com.br"
              autoFocus
              required
            />
          </div>
          <div className="login-field">
            <label>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="Digite sua senha"
              required
            />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          <div className="login-error">{error}</div>
        </form>
        <div style={{ textAlign: 'center', marginTop: '20px', color: 'var(--muted)', fontSize: '.75rem' }}>
          ℹ️ Para acesso, use seu e-mail corporativo cadastrado no sistema.
        </div>
      </div>
    </div>
  );
}
