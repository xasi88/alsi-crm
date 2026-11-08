// Долги точек и деньги на руках у торгового.
// Заказ «наличными» сразу даёт оплату на всю сумму: деньги у торгового, их надо передать.
// Заказ «в долг»: точка должна сумму, оплату получают потом (можно часть сразу).
// Заказ «переводом»: деньги идут на счёт, торговый их не держит, долга нет.
import { round2 } from './format.js?v=36adbe7e';
import { daysBetween } from './dates.js?v=36adbe7e';

export const PAYMENTS = [
  { id: 'cash', label: 'Наличные' },
  { id: 'debt', label: 'В долг' },
  { id: 'transfer', label: 'Перевод' },
];

const owes = (o) => o.payment === 'cash' || o.payment === 'debt';

// shopId -> { owed, age } (age: сколько дней не оплачен самый старый заказ)
export function balances(orders, payments, today) {
  const map = new Map();
  const get = (id) => {
    if (!map.has(id)) map.set(id, { owed: 0, orders: [], paid: 0 });
    return map.get(id);
  };
  for (const o of orders) {
    if (!owes(o) || o.deleted) continue;
    const b = get(o.shopId);
    b.owed += Number(o.total) || 0;
    b.orders.push(o);
  }
  for (const p of payments) {
    if (p.deleted) continue;
    const b = get(p.shopId);
    b.owed -= Number(p.amount) || 0;
    b.paid += Number(p.amount) || 0;
  }
  const out = new Map();
  for (const [id, b] of map) {
    const owed = round2(b.owed);
    let age = 0;
    if (owed > 0 && today) {
      // Оплаты гасят самые старые заказы первыми
      let left = b.paid;
      const sorted = b.orders.slice().sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
      for (const o of sorted) {
        left -= Number(o.total) || 0;
        if (left < -0.004) { age = Math.max(0, daysBetween(o.date, today)); break; }
      }
    }
    out.set(id, { owed, age });
  }
  return out;
}

export function owedOf(bal, shopId) {
  return bal.get(shopId)?.owed || 0;
}

// Деньги на руках у торгового: оплаты, которые он ещё не передал
export function inHand(payments, rep) {
  const list = payments.filter((p) => !p.deleted && p.rep === rep && !p.handedAt);
  return { sum: round2(list.reduce((s, p) => s + (Number(p.amount) || 0), 0)), list };
}

// Оплаты, которые надо записать вместе с заказом
export function paymentsForOrder(order, paidNow) {
  if (order.payment === 'cash') return [{ amount: round2(order.total), kind: 'order' }];
  if (order.payment === 'debt' && paidNow > 0) {
    return [{ amount: round2(Math.min(paidNow, order.total)), kind: 'order' }];
  }
  return [];
}

// Проверка оплаты от точки
export function paymentError(amount, owed) {
  if (!(amount > 0)) return 'Введите сумму больше нуля';
  if (owed > 0 && amount > owed + 0.004) return 'Сумма больше долга';
  return '';
}
