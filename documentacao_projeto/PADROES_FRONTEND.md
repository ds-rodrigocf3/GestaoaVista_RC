# 🎨 Padrões de Front-end — Gestão à Vista

Este documento detalha as decisões arquiteturais, bibliotecas e estilos adotados no desenvolvimento do front-end do projeto Gestão à Vista. Ele serve como referência obrigatória para novos desenvolvedores ou futuros projetos que desejem seguir o mesmo padrão visual e estrutural.

---

## 1. Arquitetura Base (No-Build React)

O projeto utiliza **React (v18)** de forma "Vanilla", sem a necessidade de ferramentas de build como Webpack, Vite ou Create React App.
- **Como funciona**: O React e o ReactDOM são carregados via CDN no `index.html`. O JSX é transpilado em tempo real pelo **Babel Standalone**.
- **Vantagem**: Reduz atrito de setup, permitindo que a aplicação seja rodada apenas abrindo o arquivo `index.html` ou servindo-o estaticamente via Node.js (`express.static`).
- **Desvantagem Consciente**: Maior tempo de processamento inicial no lado do cliente (transpilação de JSX), justificado pela simplicidade administrativa do projeto.

### 1.1. Injeção no Escopo Global
Não utilizamos módulos ES6 estritos (`import/export`). Em vez disso, os componentes são definidos como funções globais.
- O `index.html` carrega os scripts em ordem.
- Funções como `function DashboardView(props) { ... }` (em `dashboard.js`) ficam disponíveis para o arquivo principal `app.js`, que faz o `ReactDOM.render()`.

---

## 2. Padrões Visuais e "Glassmorphism"

O design system adotado é baseado em uma interface limpa, com bordas arredondadas e efeitos de vidro fosco (Glassmorphism), criando uma sensação tátil e moderna ("Bento Box UI").

### 2.1. O Estilo `.glass-card`
Todo cartão ou painel principal deve possuir a classe `glass-card` (e muitas vezes a classe `glass` para componentes menores).
```css
.glass-card {
  background: var(--glass-bg); /* Cor de fundo translúcida baseada no tema */
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: var(--radius-xl);
  box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.08);
}
```

### 2.2. Efeito de Contorno Dinâmico (Border Beam)
Para destacar eventos que estão acontecendo no momento ("Agora") ou em iminência ("Em breve"), utilizamos um contorno animado criado via CSS puro, sem sobrecarregar o DOM.
- **Implementação**: O contorno é desenhado em um pseudo-elemento ou div dedicada (`.border-beam-container`), com animação linear infinita (keyframes `beam-spin`).

---

## 3. Tipografia e Iconografia

### 3.1. Fontes
Carregadas diretamente via Google Fonts:
- **Inter**: Utilizada para o texto do corpo da página (parágrafos, tabelas, rótulos). Privilegia legibilidade e espaçamento métrico para dados densos.
- **Outfit**: Utilizada para títulos (`h1`, `h2`, `h3`, `.brand-text`) e números em destaque (KPIs). Transmite um visual premium e geométrico.

### 3.2. Ícones
O projeto utiliza o **Google Material Symbols Outlined**.
- Para exibir um ícone, usa-se a tag padrão: `<span className="material-symbols-outlined">nome_do_icone</span>`.
- Os ícones têm preenchimento `FILL 1` configurado via `font-variation-settings` para ficarem mais sólidos em algumas aplicações.

---

## 4. Estratégia de Cores (Themes)

A aplicação suporta temas Claro (Light) e Escuro (Dark).
A transição e definição das cores são feitas através de **CSS Custom Properties (Variáveis)** definidos em `:root` e sobrescritos com `[data-theme="dark"]`.

| Variável CSS | Descrição (Modo Claro) |
|--------------|--------------------------|
| `--bg` | Fundo principal da página (Cinza muito sutil) |
| `--surface` | Fundo de componentes internos (Branco puro) |
| `--panel-strong`| Fundo contrastante para cabeçalhos de tabela |
| `--text` | Texto corrido (Cinza médio-escuro) |
| `--title` | Texto em destaque (Quase preto) |
| `--primary` | Cor da marca (Teal/Turquesa moderno: `#33CCCC`) |

**Regra de Ouro**: NUNCA utilize cores fixas como `black` ou `white` em textos de componentes que transitam entre claro/escuro. Sempre use `var(--text)` ou `var(--title)`.

---

## 5. Responsividade (Mobile-First Constraints)

O dashboard contém alta densidade de dados (tabelas, Gantt, relatórios). As abordagens para garantir responsividade incluem:

1. **Fluid Typography**:
   - Os títulos utilizam funções `clamp()`, por exemplo: `font-size: clamp(1.5rem, 1.8vw, 2rem);`. O texto diminui sozinho em telas menores, sem depender de múltiplas media queries.

2. **Sidebar Colapsável**:
   - A barra lateral de navegação no Desktop ocupa ~280px e pode ser colapsada para ~80px.
   - Em mobile (`max-width: 768px`), a sidebar se transforma em um "drawer" (gaveta) oculta fora da tela, ativada por um menu sanduíche.

3. **Horizontal Scrolling para Tabelas**:
   - Componentes que estouram a largura (como o Gantt e o mapa de escala semanal) são envolvidos em `div` com `overflow-x: auto` e `white-space: nowrap` para permitir scroll pelo toque (touch scroll).

4. **Resets de Flex/Grid em Mobile**:
   - Divisões em grid como o Dashboard 360 e cartões de estatísticas mudam de `grid-template-columns: repeat(4, 1fr)` para `grid-template-columns: 1fr` em telas menores.

---

## 6. Estado e Assincronismo

Por estarmos sem um framework complexo de state management (como Redux), utilizamos a estrutura nativa de `Hooks` (`useState`, `useEffect`) de forma combinada ao longo dos módulos:
- O estado principal (`tasks`, `events`, `demandas`) é levantado (lifted) ao componente `<App />` em `app.js`.
- O `<App />` repassa os estados e os "setters" (`setTasks`) via props para as sub-views (ex: `<DashboardView />`).
- Requisições de rede utilizam `fetch` nativo e são concentradas em funções globais no `<App />` ou encapsuladas em blocos `try/catch` para capturar erros e renderizar Modais ou Toasts de feedback (`setToast`).

---
**Documento Atualizado em:** Maio de 2026.
**Mantenedores:** Rodrigo Freitas - BI EloPar Controller - Grestão à Vista