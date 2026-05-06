const fs = require('fs');
fs.appendFileSync('public/styles.css', `
@keyframes emphasisGlow {
  0% { box-shadow: 0 0 0 0 rgba(51, 204, 204, 0.4); }
  70% { box-shadow: 0 0 0 8px rgba(51, 204, 204, 0); }
  100% { box-shadow: 0 0 0 0 rgba(51, 204, 204, 0); }
}
.pulse-emphasis {
  animation: emphasisGlow 2.5s infinite ease-in-out !important;
  border-color: var(--primary) !important;
}
[data-theme="dark"] .pulse-emphasis {
  border-color: var(--primary) !important;
}
`);
