// Minimal unit helper so we can normalize to base units consistently
const toNum = (v, d = 0) => {
  if (v === null || v === undefined || v === '') return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const normalizeUnit = (u) => String(u || '').trim().toLowerCase();

// Convert qty to a canonical unit if you want (optional). Here we just pass-through.
// You can later add g↔kg, ml↔l, etc. and store a baseUnit on Ingredient.
const convertQty = (qty, fromUnit, toUnit) => {
  const f = normalizeUnit(fromUnit);
  const t = normalizeUnit(toUnit);
  if (!t || !f || f === t) return qty;

  // Simple examples:
  if (f === 'g' && t === 'kg') return qty / 1000;
  if (f === 'kg' && t === 'g') return qty * 1000;
  if (f === 'lb' && t === 'kg') return qty * 0.453592;
  if (f === 'kg' && t === 'lb') return qty / 0.453592;

  // Unknown conversion: fallback (don’t block movement)
  return qty;
};

module.exports = { toNum, normalizeUnit, convertQty };
