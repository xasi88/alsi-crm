// Расчёты для графиков: выручка по дням и месяцам, сравнение с прошлым периодом, темп плана,
// доли категорий, воронка визитов, долги по срокам. Без облака: под тестами (tests/dash.test.mjs).
import { addDays, daysBetween, monthKey, monthStart, monthEnd, parseDay } from './dates.js?v=2f681d03';
import { round2 } from './format.js?v=2f681d03';
import { itemSum, itemsPacks, groupOf } from './products.js?v=2f681d03';
import { orderSum as orderMoney, returnSum as returnMoney } from './money.js?v=2f681d03';

const live = (x) => x && !x.deleted;

// Прошлый период той же длины. Месяц с первого числа сравниваем с теми же днями прошлого месяца.
export function prevRange(range) {
  if (!range.from || !range.to) return null;
  const len = daysBetween(range.from, range.to) + 1;
  if (range.from.endsWith('-01') && monthKey(range.from) === monthKey(range.to)) {
    const pm = monthKey(addDays(range.from, -1));
    const end = monthEnd(pm);
    const to = addDays(monthStart(pm), len - 1);
    return { from: monthStart(pm), to: to > end ? end : to };
  }
  return { from: addDays(range.from, -len), to: addDays(range.from, -1) };
}

// Изменение в процентах. Не с чем сравнить: null
export function delta(cur, prev) {
  if (!(prev > 0)) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { pct, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
}

// Чистая выручка (заказы минус возвраты) за даты from..to
export function netBetween(orders, returns, from, to) {
  const ok = (x) => live(x) && x.date >= from && x.date <= to;
  return round2(orders.filter(ok).reduce((n, o) => n + orderMoney(o), 0) - returns.filter(ok).reduce((n, r) => n + returnMoney(r), 0));
}

// Ряд для графика: по дням до 62 дней, дальше по месяцам. Пустые дни тоже в ряду (ноль).
export function series(orders, returns, range, today) {
  const dated = [...orders, ...returns].filter((x) => live(x) && x.date);
  const from = range.from || (dated.length ? dated.reduce((a, x) => (x.date < a ? x.date : a), today) : today);
  const to = range.to || today;
  const days = daysBetween(from, to) + 1;
  const byMonth = days > 62;
  const key = (d) => (byMonth ? monthKey(d) : d);
  const map = new Map();
  if (byMonth) {
    for (let m = monthKey(from); m <= monthKey(to); m = monthKey(addDays(monthEnd(m), 1))) map.set(m, { key: m, sum: 0, packs: 0, orders: 0 });
  } else {
    for (let d = from; d <= to; d = addDays(d, 1)) map.set(d, { key: d, sum: 0, packs: 0, orders: 0 });
  }
  for (const o of orders) {
    if (!live(o) || !o.date || o.date < from || o.date > to) continue;
    const b = map.get(key(o.date));
    if (!b) continue;
    b.sum += orderMoney(o);
    b.packs += itemsPacks(o.items, 'drinks');
    b.orders += 1;
  }
  for (const r of returns) {
    if (!live(r) || !r.date || r.date < from || r.date > to) continue;
    const b = map.get(key(r.date));
    if (!b) continue;
    b.sum -= returnMoney(r);
    b.packs -= itemsPacks(r.items, 'drinks');
  }
  const points = [...map.values()].map((b) => ({ ...b, sum: round2(b.sum), packs: Math.max(0, b.packs) }));
  return { unit: byMonth ? 'month' : 'day', points };
}

// Выручка по категориям: напитки, сладости, снеки (после возвратов)
export function groupMoney(orders, returns) {
  const out = { drinks: 0, sweets: 0, snacks: 0 };
  for (const o of orders) if (live(o)) for (const i of o.items || []) out[groupOf(i)] += itemSum(i);
  for (const r of returns) if (live(r)) for (const i of r.items || []) out[groupOf(i)] -= itemSum(i);
  for (const k of Object.keys(out)) out[k] = round2(Math.max(0, out[k]));
  return out;
}

// Темп плана месяца: сколько должно быть к сегодня и сколько выйдет к концу месяца при этом темпе
export function planPace(plan, fact, today) {
  const days = parseDay(monthEnd(monthKey(today))).getDate();
  const day = parseDay(today).getDate();
  const p = Number(plan) || 0;
  const expected = p ? Math.round((p * day) / days) : 0;
  const forecast = Math.round((fact / day) * days);
  return { plan: p, fact, day, days, expected, forecast, ahead: fact - expected,
    pct: p ? Math.min(100, Math.round((fact / p) * 100)) : 0, forecastPct: p ? Math.round((forecast / p) * 100) : 0 };
}

// Воронка визитов: все визиты, ЛПР на месте, с заказом. Визит с заказом считаем визитом с ЛПР.
export function funnel(visits) {
  const vs = visits.filter((v) => live(v) && v.kind !== 'contact');
  const order = vs.filter((v) => v.result === 'order').length;
  const lpr = vs.filter((v) => v.result === 'order' || v.lpr === true).length;
  return [
    { id: 'visits', label: 'Визиты', value: vs.length },
    { id: 'lpr', label: 'ЛПР на месте', value: lpr },
    { id: 'order', label: 'С заказом', value: order },
  ];
}

// Долги по сроку заказа: до 7 дней, 8-14, 15-30, больше 30. На входе карта долгов shopDebts.
export const AGES = [
  { id: 'a7', label: 'До 7 дней', max: 7 },
  { id: 'a14', label: '8-14 дней', max: 14 },
  { id: 'a30', label: '15-30 дней', max: 30 },
  { id: 'old', label: 'Больше 30 дней', max: Infinity },
];
export function debtAging(debts, today) {
  const rows = AGES.map((a) => ({ ...a, sum: 0, shops: new Set() }));
  for (const [shopId, b] of debts) {
    for (const x of b.orders || []) {
      const age = Math.max(0, daysBetween(x.order.date, today));
      const row = rows.find((r) => age <= r.max);
      row.sum += x.debt;
      row.shops.add(shopId);
    }
  }
  return rows.map((r) => ({ id: r.id, label: r.label, sum: round2(r.sum), shops: r.shops.size }));
}

// Закупки точки по месяцам за последние n месяцев (пустые месяцы тоже)
export function shopMonths(orders, returns, shopId, today, n = 6) {
  const keys = [];
  let m = monthKey(today);
  for (let i = 0; i < n; i++) { keys.unshift(m); m = monthKey(addDays(monthStart(m), -1)); }
  const map = new Map(keys.map((k) => [k, 0]));
  for (const o of orders) if (live(o) && o.shopId === shopId && map.has(monthKey(o.date))) map.set(monthKey(o.date), map.get(monthKey(o.date)) + orderMoney(o));
  for (const r of returns) if (live(r) && r.shopId === shopId && map.has(monthKey(r.date))) map.set(monthKey(r.date), map.get(monthKey(r.date)) - returnMoney(r));
  return keys.map((k) => ({ key: k, sum: round2(Math.max(0, map.get(k))) }));
}

// Средняя выручка за день с заказами (для сравнения «сегодня против обычного дня»)
export function avgDay(orders, returns, from, to) {
  const days = new Set(orders.filter((o) => live(o) && o.date >= from && o.date <= to).map((o) => o.date));
  if (!days.size) return 0;
  return round2(netBetween(orders, returns, from, to) / days.size);
}

// Красивые деления шкалы: 0, шаг, 2 шага... до значения не меньше max
export function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * pow).find((s) => s >= raw);
  const out = [];
  for (let v = 0; v < max + step * 0.999; v += step) out.push(round2(v));
  return out;
}

// Короткая запись числа для шкалы: 950, 12 тыс., 1,2 млн
export function shortNum(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return (Math.round(n / 1e5) / 10).toString().replace('.', ',') + ' млн';
  if (a >= 1e3) return (a >= 1e4 ? Math.round(n / 1e3) : Math.round(n / 100) / 10).toString().replace('.', ',') + ' тыс.';
  return String(Math.round(n));
}
