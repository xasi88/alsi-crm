// Запись в облако. Сначала запись ложится в базу на телефоне и сразу видна, потом уходит в облако сама.
// Удаление мягкое: deleted = true, запись остаётся в базе и в резервной копии.
import { db, doc, setDoc, updateDoc, writeBatch, newId } from './fb.js?v=536b4882';
import { S, all } from './store.js?v=536b4882';
import { isoDay } from './logic/dates.js?v=536b4882';
import { round2 } from './logic/format.js?v=536b4882';
import { paymentsForOrder, takesCash } from './logic/money.js?v=536b4882';

let onError = () => {};
export const setErrorHandler = (fn) => { onError = fn; };
const fire = (p) => p.catch((e) => onError(e));

const now = () => new Date().toISOString();
// Пустые поля и служебные метки (_wait) в облако не пишем
export function clean(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || k === 'id' || k.startsWith('_')) continue;
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? clean(v) : v;
  }
  return out;
}
const ref = (col, id) => doc(db, col, id);
// Новая запись: чья она и кто её супервайзер (по правилам базы)
const owner = () => ({ rep: S.email, lead: S.me?.lead || '' });
const by = () => ({ by: S.email, updatedAt: now() });

export function saveShop(shop) {
  const id = shop.id || newId('shops');
  const base = shop.id ? {} : { createdAt: now(), ...owner() };
  fire(setDoc(ref('shops', id), clean({ ...shop, ...base, ...by() }), { merge: true }));
  return id;
}

export const hide = (col, id) => fire(updateDoc(ref(col, id), { deleted: true, deletedAt: now(), deletedBy: S.email }));
export const unhide = (col, id) => fire(updateDoc(ref(col, id), { deleted: false, ...by() }));

// Визит с заказом и оплатой: одним пакетом, всё или ничего
export function saveVisit(d) {
  const date = d.date || isoDay();
  const at = now();
  const batch = writeBatch(db);
  const visitId = d.lateVisitId || newId('visits');
  const who = owner();
  let orderId = null;
  if (d.result === 'order') {
    orderId = newId('orders');
    const order = {
      shopId: d.shopId, shopName: d.shopName, shop: d.shopSnap, date, at, ...who, visitId: d.withVisit === false ? null : visitId,
      items: d.items, total: d.total, payment: d.payment, paidNow: d.payment === 'partial' ? round2(d.paidNow) : 0, note: d.orderNote || '',
    };
    batch.set(ref('orders', orderId), clean(order));
    for (const p of paymentsForOrder(order)) {
      batch.set(ref('payments', newId('payments')), clean({ shopId: d.shopId, shopName: d.shopName, orderId, date, at, ...who, amount: p.amount, kind: p.kind }));
    }
  }
  if (d.lateVisitId) {
    // Поздний заказ: визит того же дня становится «Заказ есть», ответы об отказе убираются
    batch.update(ref('visits', visitId), { result: 'order', orderId, lpr: null, refusal: null, ...by() });
  } else if (d.withVisit !== false) {
    batch.set(ref('visits', visitId), clean({
      shopId: d.shopId, shopName: d.shopName, date, at, ...who, result: d.result, orderId: orderId || undefined,
      lpr: d.result === 'none' ? d.lpr : undefined,
      refusal: d.result === 'none' && d.lpr ? d.refusal : undefined,
      next: d.next ? { type: d.next.type, date: d.next.type === 'none' ? null : d.next.date } : undefined,
      note: d.note || '', geo: d.geo || undefined,
    }));
  }
  if (d.shopPoint) {
    batch.set(ref('shops', d.shopId), clean({ lat: d.shopPoint.lat, lng: d.shopPoint.lng, pointSrc: d.shopPoint.src,
      pointLink: d.shopPoint.link || '', pointAt: at, ...by() }), { merge: true });
  }
  fire(batch.commit());
  return { visitId, orderId };
}

// Исправить визит (дата, ответы, действие, заметка)
export function updateVisit(id, data) {
  fire(updateDoc(ref('visits', id), clean({ ...data, ...by() })));
}

export const doneNext = (visitId) => fire(updateDoc(ref('visits', visitId), { 'next.doneAt': now() }));

// Новое действие без визита: после звонка или по плану
export function addContact(shop, next, note = '') {
  fire(setDoc(ref('visits', newId('visits')), clean({
    kind: 'contact', shopId: shop.id, shopName: shop.name, date: isoDay(), at: now(), ...owner(),
    next: { type: next.type, date: next.type === 'none' ? null : next.date }, note,
  })));
}

// Изменить заказ: состав, оплата. Деньги, взятые при заказе, меняются вместе с ним.
export function updateOrder(order, { items, total, payment, paidNow, note, date }) {
  const batch = writeBatch(db);
  batch.update(ref('orders', order.id), clean({ items, total, payment, paidNow: payment === 'partial' ? round2(paidNow) : 0, note, date, editedAt: now(), ...by() }));
  const cash = all('payments').find((p) => p.orderId === order.id && p.kind === 'order');
  const want = paymentsForOrder({ payment, total, paidNow })[0];
  if (cash && !want) batch.update(ref('payments', cash.id), { deleted: true, deletedAt: now(), deletedBy: S.email });
  else if (cash && want) batch.update(ref('payments', cash.id), { amount: want.amount, ...by() });
  else if (!cash && want) {
    batch.set(ref('payments', newId('payments')), clean({ shopId: order.shopId, shopName: order.shopName, orderId: order.id,
      date: order.date, at: now(), rep: order.rep, lead: order.lead || '', amount: want.amount, kind: 'order' }));
  }
  fire(batch.commit());
}

// Деньги при заказе уже переданы: менять оплату нельзя
export const cashHanded = (order) => takesCash(order) && all('payments').some((p) => p.orderId === order.id && p.kind === 'order' && p.handedAt);

export function hideOrder(order) {
  const batch = writeBatch(db);
  const mark = { deleted: true, deletedAt: now(), deletedBy: S.email };
  batch.update(ref('orders', order.id), mark);
  for (const p of all('payments')) if (p.orderId === order.id && p.kind === 'order' && !p.handedAt) batch.update(ref('payments', p.id), mark);
  for (const v of all('visits')) if (v.orderId === order.id) batch.update(ref('visits', v.id), { orderId: null, result: 'none', ...by() });
  fire(batch.commit());
}

export function saveReturn(r) {
  const id = r.id || newId('returns');
  const base = r.id ? {} : { at: now(), ...owner() };
  fire(setDoc(ref('returns', id), clean({ ...r, ...base, ...by() }), { merge: true }));
  return id;
}

// Оплата долга: по одной записи на заказ (раскладка в logic/money.js)
export function addPayments(shop, parts, note = '') {
  const batch = writeBatch(db);
  const at = now();
  for (const p of parts) {
    batch.set(ref('payments', newId('payments')), clean({ shopId: shop.id, shopName: shop.name, orderId: p.orderId || null,
      date: isoDay(), at, ...owner(), amount: round2(p.amount), kind: 'debt', note }));
  }
  fire(batch.commit());
}

// Деньги переданы руководству: оплаты остаются в истории с датой передачи
export function handOver(list) {
  const batch = writeBatch(db);
  const at = now();
  for (const p of list) batch.update(ref('payments', p.id), { handedAt: at, handedDate: isoDay(), handedBy: S.email });
  fire(batch.commit());
}

export function saveProduct(p) {
  const id = p.id || newId('products');
  fire(setDoc(ref('products', id), clean({ ...p, ...by() }), { merge: true }));
  return id;
}

export function saveMember(email, data) {
  fire(setDoc(ref('team', String(email).toLowerCase().trim()), clean({ ...data, ...by() }), { merge: true }));
}

// Человек перешёл к другому супервайзеру: его записи получают новую отметку (только владелец)
export function retag(email, lead) {
  const list = ['shops', 'visits', 'orders', 'payments', 'returns'].flatMap((c) => (S[c] || [])
    .filter((x) => x.rep === email && (x.lead || '') !== lead).map((x) => [c, x.id]));
  return writeMany(list.map(([c, id]) => ({ col: c, id, data: { lead }, merge: true })));
}

export function savePlan(month, rep, packs) {
  fire(setDoc(ref('plans', month + '__' + rep), { month, rep, packs: Number(packs) || 0, ...by() }));
}

export function saveConfig(id, data) {
  fire(setDoc(ref('config', id), clean({ ...data, ...by() }), { merge: true }));
}

// Много записей пакетами по 400 (перенос базы, загрузка копии). Нужна связь: ждём ответа облака.
export async function writeMany(list, onStep = () => {}) {
  let done = 0;
  for (let k = 0; k < list.length; k += 400) {
    const batch = writeBatch(db);
    for (const w of list.slice(k, k + 400)) batch.set(ref(w.col, w.id), clean(w.data), { merge: !!w.merge });
    await batch.commit();
    done += Math.min(400, list.length - k);
    onStep(done, list.length);
  }
  return done;
}
