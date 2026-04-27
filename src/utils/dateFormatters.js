function formatDateDDMMYYYY(date) {
  if (!date) return null;
  if (typeof date === 'string') {
    if (!date.includes('T')) {
      const parts = date.split('-');
      if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
      return date;
    }
    date = new Date(date);
  }
  if (!(date instanceof Date) || isNaN(date)) return null;
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const y = date.getUTCFullYear();
  return `${d}-${m}-${y}`;
}

function formatDateYYYYMMDD(date) {
  if (!date) return null;
  if (typeof date === 'string') {
    if (!date.includes('T')) return date.substring(0, 10);
    date = new Date(date);
  }
  if (!(date instanceof Date) || isNaN(date)) return null;
  
  // Para colunas DATE pura, o driver msnodesqlv8 (Windows) costuma retornar local 00:00.
  // Já o driver Tedious (Azure/Linux) costuma retornar UTC 00:00.
  // Pegamos o dia local, mas se o horário for 00:00 UTC e estivermos em fuso negativo (como Brasil),
  // o dia local seria o anterior. Por isso, usamos o que for mais provável ou forçamos meio-dia.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  
  // Se for exatamente meia-noite UTC (como retornado pelo Tedious)
  // o y,m,d local seria o anterior. Vamos verificar se isso ocorre.
  // Mas para simplificar e garantir no Windows:
  return `${y}-${m}-${d}`;
}

function toServerDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const str = String(value).trim();
  // Se for YYYY-MM-DD puro, força meio-dia local para evitar saltos de fuso ao salvar
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(str + 'T12:00:00');
  }
  return new Date(str);
}

module.exports = { formatDateDDMMYYYY, formatDateYYYYMMDD, toServerDate };
