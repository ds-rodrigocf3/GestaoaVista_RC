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
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = { formatDateDDMMYYYY, formatDateYYYYMMDD };
