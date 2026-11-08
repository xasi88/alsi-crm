// Возвраты: упаковками и штуками, по заказу, не больше проданного.
import { itemAllUnits, itemSum, perPackOf, itemsSum, qtyText } from './products.js?v=79063987';

const live = (x) => !x.deleted;

// Продано по заказу в штуках (упаковки переведены в штуки по снимку заказа)
export function soldUnits(order, productId) {
  return (order?.items || []).filter((i) => i.productId === productId).reduce((n, i) => n + itemAllUnits(i), 0);
}

export function returnedUnits(returns, orderId, productId, exceptId = '') {
  return returns.filter((r) => live(r) && r.orderId === orderId && r.id !== exceptId)
    .reduce((n, r) => n + (r.items || []).filter((i) => i.productId === productId).reduce((m, i) => m + itemAllUnits(i), 0), 0);
}

// Сколько ещё можно вернуть по строке заказа: всего штук и в виде «упаковки и штуки»
export function available(order, productId, returns, exceptId = '') {
  const item = (order?.items || []).find((i) => i.productId === productId);
  const left = Math.max(0, soldUnits(order, productId) - returnedUnits(returns, order?.id, productId, exceptId));
  const per = perPackOf(item);
  return { units: left, packs: Math.floor(left / per), rest: left % per, text: qtyText(Math.floor(left / per), left % per) };
}

// Строки возврата из заказа: цена из снимка заказа
export function returnItems(order, pick) {
  const out = [];
  for (const i of order?.items || []) {
    const q = pick[i.productId];
    if (!q) continue;
    const packs = Math.max(0, Number(q.packs) || 0);
    const units = Math.max(0, Number(q.units) || 0);
    if (packs || units) {
      out.push({ productId: i.productId, name: i.name, cat: i.cat || 'drinks', line: i.line || '', perPack: perPackOf(i),
        packPrice: Number(i.packPrice) || 0, unitPrice: Number(i.unitPrice) || 0, packs, units });
    }
  }
  return out;
}

export function returnErrors(order, items, returns, exceptId = '') {
  const e = [];
  if (!order) e.push('Выберите заказ');
  if (!items.length) e.push('Укажите, что возвращают');
  for (const i of items) {
    const a = available(order, i.productId, returns, exceptId);
    if (itemAllUnits(i) > a.units) e.push(i.name + ': можно вернуть не больше ' + a.text);
  }
  return e;
}

export const returnTotal = (items) => itemsSum(items);
export const returnLineSum = itemSum;

// Новый состав заказа не меньше уже возвращённого
export function editBlockedBy(orderId, newItems, returns) {
  const bad = [];
  const old = new Set(returns.filter((r) => live(r) && r.orderId === orderId).flatMap((r) => (r.items || []).map((i) => i.productId)));
  for (const pid of old) {
    const back = returnedUnits(returns, orderId, pid);
    const next = newItems.filter((i) => i.productId === pid).reduce((n, i) => n + itemAllUnits(i), 0);
    if (next < back) bad.push(pid);
  }
  return bad;
}

// Заказ с возвратами удалять нельзя: сначала удалить возвраты
export const deleteBlocked = (orderId, returns) => returns.some((r) => live(r) && r.orderId === orderId);
