// Деньги: долг по каждому заказу, оплаты, деньги на руках у торгового.
// Долг дают только заказы «В долг» и «Часть сразу». Возврат уменьшает сумму заказа и его долг.
// Оплата долга записывается на заказ (orderId). Оплата без заказа гасит самые старые долги точки.
import { round2 } from './format.js?v=79063987';
import { daysBetween } from './dates.js?v=79063987';
import { itemsSum } from './products.js?v=79063987';

export const PAYMENTS = [
  { id: 'driver', label: 'Оплата водителю', note: 'Деньги возьмёт водитель при доставке' },
  { id: 'cash', label: 'Наличные торговому', note: 'Оплатили всё сразу, деньги у вас' },
  { id: 'transfer', label: 'Перевод', note: 'Деньги придут на счёт' },
  { id: 'debt', label: 'В долг', note: 'Точка заплатит позже' },
  { id: 'partial', label: 'Часть сразу', note: 'Часть сейчас, остальное в долг' },
  { id: 'unknown', label: 'Не указано', note: '' },
];
export const payLabel = (id) => PAYMENTS.find((p) => p.id === id)?.label || 'Не указано';
export const createsDebt = (o) => o?.payment === 'debt' || o?.payment === 'partial';
// Деньги при заказе попадают к торговому
export const takesCash = (o) => o?.payment === 'cash' || o?.payment === 'partial';

const live = (x) => !x.deleted;

export function orderSum(o) {
  return Array.isArray(o?.items) && o.items.length ? itemsSum(o.items) : round2(o?.total);
}

export function returnSum(r) {
  return typeof r?.total === 'number' ? round2(r.total) : itemsSum(r?.items);
}

// Индекс: возвраты и оплаты по заказу
export function indexMoney(returns = [], payments = []) {
  const ret = new Map();
  const pay = new Map();
  for (const r of returns) {
    if (!live(r) || !r.orderId) continue;
    ret.set(r.orderId, round2((ret.get(r.orderId) || 0) + returnSum(r)));
  }
  for (const p of payments) {
    if (!live(p) || p.kind === 'order' || !p.orderId) continue;
    pay.set(p.orderId, round2((pay.get(p.orderId) || 0) + Math.max(0, Number(p.amount) || 0)));
  }
  return { ret, pay };
}

// Сумма заказа после возвратов
export const orderNet = (o, idx) => Math.max(0, round2(orderSum(o) - (idx.ret.get(o.id) || 0)));

// Сразу при заказе: «Наличные торговому» всё, «Часть сразу» сколько отдали
export function paidAtOrder(o, idx) {
  if (o?.payment === 'cash') return orderNet(o, idx);
  if (o?.payment === 'partial') return Math.max(0, Number(o.paidNow) || 0);
  return 0;
}

export function orderDebt(o, idx) {
  if (!createsDebt(o) || o.deleted) return 0;
  return Math.max(0, round2(orderNet(o, idx) - paidAtOrder(o, idx) - (idx.pay.get(o.id) || 0)));
}

// Долги по точкам: shopId -> { owed, age, orders: [{ order, debt }] }
// Оплаты без заказа гасят старые заказы первыми.
export function shopDebts(orders, returns, payments, today = '') {
  const idx = indexMoney(returns, payments);
  const loose = new Map();
  for (const p of payments) {
    if (!live(p) || p.kind === 'order' || p.orderId) continue;
    loose.set(p.shopId, (loose.get(p.shopId) || 0) + Math.max(0, Number(p.amount) || 0));
  }
  const map = new Map();
  const sorted = orders.filter(live).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const o of sorted) {
    let debt = orderDebt(o, idx);
    if (debt <= 0) continue;
    const left = loose.get(o.shopId) || 0;
    if (left > 0) {
      const take = Math.min(left, debt);
      loose.set(o.shopId, left - take);
      debt = round2(debt - take);
      if (debt <= 0.004) continue;
    }
    if (!map.has(o.shopId)) map.set(o.shopId, { owed: 0, age: 0, orders: [] });
    const b = map.get(o.shopId);
    b.owed = round2(b.owed + debt);
    b.orders.push({ order: o, debt });
    if (b.orders.length === 1 && today) b.age = Math.max(0, daysBetween(o.date, today));
  }
  return map;
}

export const owedOf = (debts, shopId) => debts.get(shopId)?.owed || 0;

// Раскладка оплаты точки по её долгам: старые первыми
export function allocate(amount, debtRows) {
  let left = round2(amount);
  const out = [];
  for (const row of debtRows) {
    if (left <= 0) break;
    const take = round2(Math.min(left, row.debt));
    if (take > 0) out.push({ orderId: row.order.id, amount: take });
    left = round2(left - take);
  }
  return { parts: out, rest: left };
}

// Деньги на руках: оплаты, которые торговый ещё не передал
export function inHand(payments, rep = '', shopId = '') {
  const list = payments.filter((p) => live(p) && !p.handedAt && (!rep || p.rep === rep) && (!shopId || p.shopId === shopId)
    && Number(p.amount) > 0);
  return { sum: round2(list.reduce((s, p) => s + Number(p.amount), 0)), list };
}

// Строки экрана «Долги»: долг или деньги к передаче. Точка уходит, только когда оба нуля.
export function debtRows(shops, debts, payments) {
  const hand = new Map();
  for (const p of payments) {
    if (!live(p) || p.handedAt || !(Number(p.amount) > 0)) continue;
    hand.set(p.shopId, round2((hand.get(p.shopId) || 0) + Number(p.amount)));
  }
  const rows = [];
  for (const s of shops) {
    if (s.deleted) continue;
    const d = debts.get(s.id);
    const owed = d?.owed || 0;
    const toHand = hand.get(s.id) || 0;
    if (owed > 0 || toHand > 0) rows.push({ shop: s, owed, age: d?.age || 0, toHand, orders: d?.orders || [] });
  }
  return rows.sort((a, b) => b.age - a.age || b.owed - a.owed || b.toHand - a.toHand);
}

// Оплаты, которые пишутся вместе с заказом: деньги, которые торговый взял сразу
export function paymentsForOrder(order) {
  if (order.payment === 'cash') return [{ amount: round2(order.total), kind: 'order' }];
  if (order.payment === 'partial' && Number(order.paidNow) > 0) {
    return [{ amount: round2(Math.min(order.paidNow, order.total)), kind: 'order' }];
  }
  return [];
}

export function paymentError(amount, owed) {
  if (!(amount > 0)) return 'Введите сумму больше нуля';
  if (owed > 0 && amount > owed + 0.004) return 'Сумма больше долга';
  return '';
}

// «Часть сразу»: сумма больше нуля и меньше заказа
export function partialError(paid, total) {
  if (!(paid > 0)) return 'Введите, сколько отдали сразу';
  if (paid >= total) return 'Отдали всё: выберите «Наличные торговому»';
  return '';
}
