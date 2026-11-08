// Фильтры списков: период, район, населённый пункт, поиск, сортировка точек.
// Один и тот же отбор даёт и список, и цифры над ним: они не расходятся.
import { addDays, parseDay, monthKey, monthStart, monthEnd } from './dates.js?v=895b33d7';
import { norm } from './format.js?v=895b33d7';
import { itemsPacks, itemsUnits } from './products.js?v=895b33d7';
import { orderSum, returnSum } from './money.js?v=895b33d7';

export const PERIODS = [
  ['today', 'Сегодня'], ['week', 'Неделя'], ['month', 'Месяц'], ['year', 'Год'], ['all', 'Всё время'], ['custom', 'Свои даты'],
];

// Начало и конец периода, включительно. Пусто: без границы.
export function periodRange(id, today, from = '', to = '') {
  if (id === 'today') return { from: today, to: today };
  if (id === 'week') return { from: addDays(today, -((parseDay(today).getDay() + 6) % 7)), to: today };
  if (id === 'month') return { from: monthStart(monthKey(today)), to: today };
  if (id === 'prev') {
    const m = monthKey(addDays(monthStart(monthKey(today)), -1));
    return { from: monthStart(m), to: monthEnd(m) };
  }
  if (id === 'year') return { from: today.slice(0, 4) + '-01-01', to: today };
  if (id === 'custom') {
    const a = from || '';
    const b = to || '';
    return a && b && a > b ? { from: b, to: a } : { from: a, to: b };
  }
  return { from: '', to: '' };
}

export const inRange = (date, r) => !!date && (!r.from || date >= r.from) && (!r.to || date <= r.to);

const clean = (s) => String(s || '').trim();

export function districtsOf(shops) {
  return [...new Set(shops.filter((s) => !s.deleted).map((s) => clean(s.district)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
}

// Пункты только выбранного района
export function localitiesOf(shops, district = '') {
  return [...new Set(shops.filter((s) => !s.deleted && (!district || clean(s.district) === district))
    .map((s) => clean(s.locality)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
}

export const geoMatch = (shop, district, locality) => (!district || clean(shop?.district) === district)
  && (!locality || clean(shop?.locality) === locality);

// Записи (визиты, заказы, возвраты, оплаты) по периоду, месту точки и поиску
export function filterRecords(list, { range = { from: '', to: '' }, district = '', locality = '', q = '', shops = new Map(), text = null } = {}) {
  const words = norm(q).split(' ').filter(Boolean);
  return list.filter((x) => {
    if (x.deleted || !inRange(x.date, range)) return false;
    const shop = shops.get(x.shopId);
    if ((district || locality) && !geoMatch(shop || x.shop, district, locality)) return false;
    if (!words.length) return true;
    const hay = norm([x.shopName, shop?.name, shop?.locality, shop?.address, text ? text(x) : ''].join(' '));
    return words.every((w) => hay.includes(w));
  }).sort((a, b) => (a.date === b.date ? ((a.at || '') < (b.at || '') ? 1 : -1) : a.date < b.date ? 1 : -1));
}

// Цифры над списком заказов
export function ordersSummary(orders) {
  return {
    count: orders.length,
    packs: orders.reduce((n, o) => n + itemsPacks(o.items), 0),
    units: orders.reduce((n, o) => n + itemsUnits(o.items), 0),
    sum: Math.round(orders.reduce((n, o) => n + orderSum(o), 0) * 100) / 100,
  };
}

export function returnsSummary(returns) {
  return {
    count: returns.length,
    packs: returns.reduce((n, r) => n + itemsPacks(r.items), 0),
    units: returns.reduce((n, r) => n + itemsUnits(r.items), 0),
    sum: Math.round(returns.reduce((n, r) => n + returnSum(r), 0) * 100) / 100,
  };
}

export const SORTS = [['name', 'Название'], ['district', 'Район'], ['locality', 'Пункт'], ['lastVisit', 'Последний визит']];
export const VISITED = [['all', 'Все'], ['today', 'Был сегодня'], ['notToday', 'Не был сегодня']];

// Список точек: поиск, место, был ли визит сегодня, сортировка
export function shopRows(shops, { q = '', district = '', locality = '', visited = 'all', sort = 'name', lastVisit = new Map(), today = '' } = {}, match) {
  const rows = shops.filter((s) => !s.deleted && geoMatch(s, district, locality) && match(s, q)
    && (visited === 'all' || (visited === 'today') === (lastVisit.get(s.id) === today)));
  const txt = (a, b) => String(a || '').localeCompare(String(b || ''), 'ru', { sensitivity: 'base' });
  return rows.sort((a, b) => {
    if (sort === 'district') return txt(a.district, b.district) || txt(a.name, b.name);
    if (sort === 'locality') return txt(a.locality, b.locality) || txt(a.name, b.name);
    if (sort === 'lastVisit') return txt(lastVisit.get(b.id), lastVisit.get(a.id)) || txt(a.name, b.name);
    return txt(a.name, b.name);
  });
}

// Последний визит каждой точки (без запланированных звонков)
export function lastVisits(visits) {
  const m = new Map();
  for (const v of visits) {
    if (v.deleted || v.kind === 'contact') continue;
    if ((m.get(v.shopId) || '') < v.date) m.set(v.shopId, v.date);
  }
  return m;
}
