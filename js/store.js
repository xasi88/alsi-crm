// Данные приложения: подписка на облако, роль, запись.
// Запись не ждёт облака: она сразу видна на экране, а в облако уходит сама, когда есть связь.
import { db, collection, doc, setDoc, updateDoc, getDoc, onSnapshot, query, where, writeBatch, newId } from './fb.js?v=5db8579d';
import { isoDay } from './logic/dates.js?v=5db8579d';
import { paymentsForOrder } from './logic/money.js?v=5db8579d';
import { round2 } from './logic/format.js?v=5db8579d';

export const S = {
  user: null, email: '', me: null, role: '', lead: false, owner: false, denied: false, ready: false,
  shops: [], visits: [], orders: [], payments: [], products: [], team: [], plans: [],
  pending: {}, loaded: {}, online: navigator.onLine,
};

const subs = new Set();
let raf = 0;
export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export function emit() {
  if (raf) return;
  raf = requestAnimationFrame(() => { raf = 0; subs.forEach((f) => f()); });
}
addEventListener('online', () => { S.online = true; emit(); });
addEventListener('offline', () => { S.online = false; emit(); });

export const pendingCount = () => Object.values(S.pending).reduce((a, b) => a + b, 0);

let onError = () => {};
export const setErrorHandler = (fn) => { onError = fn; };
const fire = (p) => p.catch((e) => onError(e));

const now = () => new Date().toISOString();
const clean = (o) => {
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || k === 'id') continue;
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? clean(v) : v;
  }
  return out;
};
const ref = (col, id) => doc(db, col, id);

const unsubs = [];
function listen(name, q) {
  unsubs.push(onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
    S[name] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    S.pending[name] = snap.docs.filter((d) => d.metadata.hasPendingWrites).length;
    S.loaded[name] = true;
    emit();
  }, (e) => { console.warn('ALSI', name, e.code); S.loaded[name] = true; emit(); }));
}

const timeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

// Вход: роль из списка команды. Первый вход владельца сам записывает его в команду
// (правила базы разрешают это только почте владельца).
export async function start(user) {
  S.user = user;
  S.email = String(user.email || '').toLowerCase();
  let me = null;
  try {
    const snap = await getDoc(ref('team', S.email));
    if (snap.exists()) me = snap.data();
  } catch (e) { /* нет связи и нет копии: ниже попробуем записать */ }
  if (!me && navigator.onLine) {
    const data = { role: 'owner', name: user.displayName || S.email, active: true, at: now() };
    try { await timeout(setDoc(ref('team', S.email), data), 15000); me = data; } catch (e) { /* не владелец */ }
  }
  if (!me || me.active === false) { S.denied = true; S.ready = true; emit(); return; }
  S.me = me;
  S.role = me.role;
  S.owner = me.role === 'owner';
  S.lead = S.owner || me.role === 'supervisor';
  const mine = (name) => (S.lead ? collection(db, name) : query(collection(db, name), where('rep', '==', S.email)));
  listen('team', collection(db, 'team'));
  listen('products', collection(db, 'products'));
  listen('shops', collection(db, 'shops'));
  listen('visits', mine('visits'));
  listen('orders', mine('orders'));
  listen('payments', mine('payments'));
  listen('plans', collection(db, 'plans'));
  S.ready = true;
  emit();
}

export function stop() {
  while (unsubs.length) unsubs.pop()();
  Object.assign(S, { user: null, email: '', me: null, role: '', lead: false, owner: false, denied: false, ready: false,
    shops: [], visits: [], orders: [], payments: [], products: [], team: [], plans: [], pending: {}, loaded: {} });
  emit();
}

const stamp = () => ({ at: now(), by: S.email });

// Точка
export function saveShop(shop) {
  const id = shop.id || newId('shops');
  const base = shop.id ? {} : { createdAt: now(), rep: shop.rep || S.email };
  fire(setDoc(ref('shops', id), clean({ ...shop, ...base, updatedAt: now(), by: S.email }), { merge: true }));
  return id;
}

// Визит с заказом и оплатой: одним пакетом, всё или ничего
export function saveVisit(d) {
  const date = isoDay();
  const at = now();
  const batch = writeBatch(db);
  const visitId = d.lateVisitId || newId('visits');
  let orderId = null;
  if (d.result === 'order') {
    orderId = newId('orders');
    const order = {
      shopId: d.shopId, shopName: d.shopName, date, at, rep: S.email, visitId: d.withVisit === false ? null : visitId,
      items: d.items, total: d.total, payment: d.payment, note: d.note || '',
    };
    batch.set(ref('orders', orderId), clean(order));
    for (const p of paymentsForOrder(order, d.paidNow || 0)) {
      batch.set(ref('payments', newId('payments')), clean({
        shopId: d.shopId, shopName: d.shopName, date, at, rep: S.email, amount: p.amount, kind: p.kind, orderId,
      }));
    }
  }
  if (d.lateVisitId) {
    // Поздний заказ: визит того же дня становится «Заказ есть», ответы об отказе убираются
    batch.update(ref('visits', visitId), { result: 'order', orderId, lpr: null, refusal: null, by: S.email });
  } else if (d.withVisit !== false) {
    batch.set(ref('visits', visitId), clean({
      shopId: d.shopId, shopName: d.shopName, date, at, rep: S.email, result: d.result,
      orderId: orderId || undefined, lpr: d.result === 'none' ? d.lpr : undefined,
      refusal: d.result === 'none' && d.lpr ? d.refusal : undefined,
      next: d.next ? { type: d.next.type, date: d.next.type === 'none' ? null : d.next.date } : undefined,
      note: d.note || '', lat: d.lat, lng: d.lng,
    }));
  }
  fire(batch.commit());
  return { visitId, orderId };
}

// Следующее действие выполнено (звонок, сообщение, приезд)
export function doneNext(visitId) {
  fire(updateDoc(ref('visits', visitId), { 'next.doneAt': now() }));
}

// Новое действие без визита: после звонка или по плану
export function addContact(shop, next, note = '') {
  fire(setDoc(ref('visits', newId('visits')), clean({
    kind: 'contact', shopId: shop.id, shopName: shop.name, date: isoDay(), at: now(), rep: S.email,
    next: { type: next.type, date: next.type === 'none' ? null : next.date }, note,
  })));
}

export function addPayment(shop, amount) {
  fire(setDoc(ref('payments', newId('payments')), clean({
    shopId: shop.id, shopName: shop.name, date: isoDay(), at: now(), rep: S.email, amount: round2(amount), kind: 'debt',
  })));
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
  fire(setDoc(ref('products', id), clean({ ...p, ...stamp() }), { merge: true }));
  return id;
}

export function saveMember(email, data) {
  fire(setDoc(ref('team', String(email).toLowerCase().trim()), clean({ ...data, ...stamp() }), { merge: true }));
}

export function savePlan(month, rep, packs) {
  fire(setDoc(ref('plans', month + '__' + rep), { month, rep, packs: Number(packs) || 0, ...stamp() }));
}

export const planOf = (month, rep) => S.plans.find((p) => p.id === month + '__' + rep)?.packs || 0;
export const shopById = (id) => S.shops.find((s) => s.id === id);
export const memberName = (email) => S.team.find((m) => m.id === email)?.name || email;
