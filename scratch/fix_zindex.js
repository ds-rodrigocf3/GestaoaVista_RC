const fs = require('fs');
const stylesPath = 'public/styles.css';
let f = fs.readFileSync(stylesPath, 'utf8');

// 1. Make topbar-header sticky with z-index: 900
const stickyHeader = `.topbar-header {
  display: none;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  margin: -12px -12px 16px -12px;
  border-bottom: 1px solid var(--line);
  position: sticky;
  top: 0;
  z-index: 900;
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}`;

f = f.replace(/\.topbar-header\s*\{\s*display:\s*none;[\s\S]*?\}/, stickyHeader);

// 2. Increase sidebar z-index in the media query (max-width: 768px)
// We look for the media query that defines .sidebar as position: fixed
f = f.replace(/(\@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\.sidebar\s*\{[\s\S]*?z-index:\s*)1000/g, '$11100');

// 3. Adjust sidebar-overlay z-index
f = f.replace(/(\.sidebar-overlay\s*\{[\s\S]*?z-index:\s*)9990/, '$11050');

fs.writeFileSync(stylesPath, f, 'utf8');
console.log('Z-indices and sticky header updated.');
