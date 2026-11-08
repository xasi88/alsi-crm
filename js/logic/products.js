// Товары: категории, упаковки и штуки, снимок цены в заказе.
// Напитки продаются упаковками. Сладости и снеки можно и штуками, если в карточке товара так задано.
import { round2, norm } from './format.js?v=92040873';

export const CATS = [
  { id: 'drinks', label: 'Напитки', group: 'drinks' },
  { id: 'chocolate', label: 'Шоколад', group: 'sweets' },
  { id: 'marmalade', label: 'Мармелад', group: 'sweets' },
  { id: 'candy', label: 'Конфеты', group: 'sweets' },
  { id: 'snacks', label: 'Снеки', group: 'snacks' },
];
export const GROUPS = [
  { id: 'drinks', label: 'Напитки' },
  { id: 'sweets', label: 'Сладости' },
  { id: 'snacks', label: 'Снеки' },
];
export const LINES = ['Alsi Cola', 'Code Red', 'FIFA', 'Nerve', 'Leemo'];

export const catOf = (x) => (CATS.some((c) => c.id === x?.cat) ? x.cat : 'drinks');
export const catLabel = (id) => (CATS.find((c) => c.id === id) || CATS[0]).label;
export const groupOf = (x) => (CATS.find((c) => c.id === catOf(x)) || CATS[0]).group;
export const groupLabel = (id) => (GROUPS.find((g) => g.id === id) || GROUPS[0]).label;
export const perPackOf = (x) => Math.max(1, Number(x?.perPack) || 1);

// Цена штуки: своя, иначе доля цены упаковки (так считается возврат штук)
export function unitPriceOf(x) {
  const u = Number(x?.unitPrice) || 0;
  if (u > 0) return u;
  return round2((Number(x?.packPrice) || 0) / perPackOf(x));
}

export const sellsUnits = (p) => p?.units === true && unitPriceOf(p) > 0;

export function measure(p) {
  if (Number(p?.weightG) > 0) return p.weightG + ' г';
  if (Number(p?.volumeMl) > 0) return p.volumeMl + ' мл';
  return '';
}

export function sortProducts(list) {
  const key = (p) => (Number(p.sort) > 0 ? Number(p.sort) : 1e9);
  return list.slice().sort((a, b) => key(a) - key(b) || String(a.name).localeCompare(String(b.name), 'ru'));
}

export const activeProducts = (list) => sortProducts(list.filter((p) => !p.deleted && p.active !== false));

// Строка заказа: снимок товара на момент продажи
export function itemOf(p, packs = 0, units = 0) {
  return {
    productId: p.id, name: p.name, cat: catOf(p), line: p.line || '', perPack: perPackOf(p),
    packPrice: Number(p.packPrice) || 0, unitPrice: sellsUnits(p) ? unitPriceOf(p) : 0,
    packs: Math.max(0, Number(packs) || 0), units: Math.max(0, Number(units) || 0),
  };
}

export const itemPacks = (i) => Math.max(0, Number(i?.packs) || 0);
export const itemUnits = (i) => Math.max(0, Number(i?.units) || 0);
export const itemSum = (i) => round2(itemPacks(i) * (Number(i?.packPrice) || 0) + itemUnits(i) * unitPriceOf(i));
// Всего штук в строке: упаковки переводим в штуки по снимку
export const itemAllUnits = (i) => itemPacks(i) * perPackOf(i) + itemUnits(i);
export const itemsSum = (items) => round2((items || []).reduce((s, i) => s + itemSum(i), 0));
export const itemsPacks = (items, group = '') => (items || [])
  .reduce((n, i) => n + (!group || groupOf(i) === group ? itemPacks(i) : 0), 0);
export const itemsUnits = (items, group = '') => (items || [])
  .reduce((n, i) => n + (!group || groupOf(i) === group ? itemUnits(i) : 0), 0);

// '2 уп. и 3 шт.' (знак «плюс» в приложении не используем: брендбук)
export function qtyText(packs, units) {
  const p = Number(packs) || 0;
  const u = Number(units) || 0;
  const out = [];
  if (p > 0) out.push(p + ' уп.');
  if (u > 0) out.push(u + ' шт.');
  return out.join(' и ') || '0';
}

// Строки заказа из выбора: { productId: { packs, units } }
export function itemsFromPick(pick, products) {
  const out = [];
  for (const p of products) {
    const q = pick[p.id];
    if (!q) continue;
    const packs = Math.max(0, Number(q.packs) || 0);
    const units = sellsUnits(p) ? Math.max(0, Number(q.units) || 0) : 0;
    if (packs > 0 || units > 0) out.push(itemOf(p, packs, units));
  }
  return out;
}

// Тот же товар у нас: по артикулу, иначе по названию
export function findSame(products, x) {
  const sku = String(x?.sku || '').trim().toUpperCase();
  if (sku) {
    const bySku = products.find((p) => !p.deleted && String(p.sku || '').trim().toUpperCase() === sku);
    if (bySku) return bySku;
  }
  const n = norm(x?.name);
  return n ? products.find((p) => !p.deleted && norm(p.name) === n) || null : null;
}

// Каталог из файла: JSON (список товаров, наш или Атама) или таблица CSV через «;» или «,».
// Столбцы CSV: название; артикул; категория; объём мл; вес г; штук в упаковке; цена упаковки; цена штуки; штуками (да/нет)
export function parseCatalog(text) {
  const t = String(text || '').trim();
  const rows = [];
  const errors = [];
  if (!t) return { rows, errors: ['Файл пустой'] };
  if (t[0] === '[' || t[0] === '{') {
    let data;
    try { data = JSON.parse(t); } catch (e) { return { rows, errors: ['Файл не читается как JSON'] }; }
    const list = Array.isArray(data) ? data : Array.isArray(data.products) ? data.products : [];
    list.forEach((x, k) => {
      const r = productFromAny(x);
      if (r.name) rows.push(r); else errors.push('Строка ' + (k + 1) + ': нет названия');
    });
    return { rows, errors };
  }
  const lines = t.split(/\r?\n/).filter((l) => l.trim());
  const sep = lines[0].includes(';') ? ';' : ',';
  const head = norm(lines[0]);
  const start = head.includes('назван') || head.includes('name') ? 1 : 0;
  for (let k = start; k < lines.length; k += 1) {
    const c = lines[k].split(sep).map((s) => s.trim());
    const r = productFromAny({
      name: c[0], sku: c[1], category: catFromText(c[2]), volumeMl: c[3], weightGrams: c[4],
      cansPerPackage: c[5], price: c[6], unitPrice: c[7], saleModes: /^(да|yes|1)/i.test(c[8] || '') ? ['package', 'unit'] : ['package'],
    });
    if (r.name) rows.push(r); else errors.push('Строка ' + (k + 1) + ': нет названия');
  }
  return { rows, errors };
}

function catFromText(s) {
  const n = norm(s);
  const hit = CATS.find((c) => c.id === n || norm(c.label) === n);
  return hit ? hit.id : 'drinks';
}

const num = (v) => {
  const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Товар из любой записи: наши поля или поля программы Атама
export function productFromAny(x) {
  const cat = CATS.some((c) => c.id === (x.cat || x.category)) ? (x.cat || x.category) : 'drinks';
  const modes = Array.isArray(x.saleModes) ? x.saleModes : [];
  return {
    name: String(x.name || '').trim(),
    sku: String(x.sku || '').trim(),
    cat,
    line: String(x.line || '').trim(),
    volumeMl: num(x.volumeMl),
    weightG: num(x.weightG ?? x.weightGrams),
    perPack: Math.max(1, Math.round(num(x.perPack ?? x.cansPerPackage ?? x.unitsPerPackage)) || 1),
    packPrice: num(x.packPrice ?? x.price),
    unitPrice: num(x.unitPrice),
    units: x.units === true || modes.includes('unit'),
    sort: Math.round(num(x.sort ?? x.sortOrder)),
    active: x.active !== false,
  };
}
