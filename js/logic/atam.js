// Перенос базы из программы Атама (файл «Скачать резервную копию», JSON).
// Только чтение файла и перевод полей. К его облаку не подключаемся.
// Номера записей постоянные: 'atam-' и номер у Атама. Повторный перенос перезаписывает те же записи, двойников нет.
import { normPhone } from './format.js?v=79063987';
import { sameAnswer } from './visit.js?v=79063987';
import { productFromAny, findSame, itemsSum, LINES } from './products.js?v=79063987';

export const SRC = 'atam';
export const atamId = (id) => 'atam-' + String(id ?? '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 200);
const arr = (x) => (Array.isArray(x) ? x : []);
const str = (x) => String(x ?? '').trim();
const numOr = (x, d = null) => (Number.isFinite(Number(x)) && x !== '' && x !== null ? Number(x) : d);
const day = (x) => (/^\d{4}-\d{2}-\d{2}/.test(str(x)) ? str(x).slice(0, 10) : '');
const point = (lat, lng) => {
  const a = numOr(lat);
  const b = numOr(lng);
  return a !== null && b !== null && Math.abs(a) <= 90 && Math.abs(b) <= 180 && !(a === 0 && b === 0) ? { lat: a, lng: b } : null;
};
const owner = (x) => str(x?._ownerUserId);

// Что в файле: люди и сколько записей. Ошибка, если файл не от программы Атама.
export function readAtam(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.shops) || !Array.isArray(data.orders)) {
    return { error: 'Это не резервная копия программы Атама: нет точек и заказов' };
  }
  const meta = data._workspaceBackup || {};
  const people = new Map();
  for (const m of arr(meta.members)) {
    if (!m?.user_id) continue;
    people.set(m.user_id, { userId: m.user_id, email: str(m.email).toLowerCase(), name: str(m.display_name), role: str(m.role) || 'sales',
      supervisorUserId: str(m.supervisor_user_id), active: m.active !== false, records: 0 });
  }
  const cols = ['shops', 'visits', 'orders', 'returns', 'payments'];
  for (const c of cols) for (const x of arr(data[c])) {
    const id = owner(x);
    if (!people.has(id)) people.set(id, { userId: id, email: '', name: id ? '' : 'Без владельца', role: 'sales', supervisorUserId: '', active: true, records: 0 });
    people.get(id).records += 1;
  }
  const goals = countGoals(data);
  return {
    exportedAt: str(meta.exportedAt), workspace: str(meta.workspace?.name),
    people: [...people.values()].sort((a, b) => b.records - a.records),
    counts: {
      shops: arr(data.shops).length, visits: arr(data.visits).length, orders: arr(data.orders).length,
      returns: arr(data.returns).length, payments: arr(data.payments).length, products: arr(data.products).length, plans: goals,
    },
  };
}

function goalsByUser(data) {
  const meta = data._workspaceBackup || {};
  const out = new Map();
  for (const [uid, s] of Object.entries(meta.settingsByUser || {})) out.set(uid, s?.monthlyPackageGoals || {});
  const own = data.settings?.monthlyPackageGoals;
  if (own && typeof own === 'object') {
    const boss = arr(meta.members).find((m) => m.role === 'owner')?.user_id || '';
    if (!out.has(boss)) out.set(boss, own);
  }
  return out;
}
const countGoals = (data) => [...goalsByUser(data).values()]
  .reduce((n, g) => n + Object.entries(g).filter(([k, v]) => /^\d{4}-\d{2}$/.test(k) && Number(v) > 0).length, 0);

const NEXT = { 'Написать в WhatsApp': 'whatsapp', 'Позвонить': 'call', 'Приехать': 'visit', 'Действий не требуется': 'none' };
const PAY = { 'Оплата водителю': 'driver', 'Не указано': 'unknown', 'Оплачено': 'cash', 'Долг': 'debt', 'Частично': 'partial' };
const POINT_SRC = { 'manual-map': 'Карта', gps: 'GPS', GPS: 'GPS' };
const guessLine = (name) => LINES.find((l) => String(name).toLowerCase().includes(l.toLowerCase())) || '';

// Перевод всех записей. people: Map userId -> { email, lead }. ours: наши товары.
export function convertAtam(data, { people, ours = [], now = new Date().toISOString() }) {
  const problems = [];
  const who = (x) => people.get(owner(x)) || people.get('') || { email: '', lead: '' };
  const tag = (x) => {
    const p = who(x);
    return { rep: p.email, lead: p.lead || '', src: SRC, srcId: str(x.id), importedAt: now };
  };
  const shopsById = new Map(arr(data.shops).map((s) => [s.id, s]));
  const prodById = new Map(arr(data.products).map((p) => [p.id, p]));

  // Товары: тот же товар у нас (артикул или название) или новый
  const prodMap = new Map();
  const products = [];
  const matched = [];
  for (const p of arr(data.products)) {
    const same = findSame(ours, p);
    if (same) {
      prodMap.set(p.id, same.id);
      const price = numOr(p.price, 0);
      if (price && Math.abs(price - (Number(same.packPrice) || 0)) > 0.004) matched.push({ name: same.name, ours: same.packPrice, atam: price });
      continue;
    }
    const doc = productFromAny(p);
    if (!doc.name) { problems.push('Товар без названия пропущен'); continue; }
    if (!doc.line && doc.cat === 'drinks') doc.line = guessLine(doc.name);
    const id = atamId(p.id);
    prodMap.set(p.id, id);
    products.push([id, { ...doc, src: SRC, srcId: str(p.id), importedAt: now }]);
  }

  const item = (it) => {
    const p = prodById.get(it.productId) || {};
    const unitMode = it.saleMode === 'unit';
    const packs = it.packageQty !== undefined && it.packageQty !== null ? numOr(it.packageQty, 0)
      : it.packages !== undefined ? numOr(it.packages, 0) : unitMode ? 0 : numOr(it.qty, 0);
    const units = it.unitQty !== undefined && it.unitQty !== null ? numOr(it.unitQty, 0)
      : it.cans !== undefined ? numOr(it.cans, 0) : it.units !== undefined ? numOr(it.units, 0) : unitMode ? numOr(it.qty, 0) : 0;
    const name = str(p.name) || str(it.name) || 'Удалённый товар';
    const cat = productFromAny({ ...p, category: p.category || it.category }).cat;
    return {
      productId: prodMap.get(it.productId) || atamId(it.productId), name, cat, line: guessLine(name),
      perPack: Math.max(1, numOr(it.cansPerPackage, 0) || numOr(p.cansPerPackage, 0) || 1),
      packPrice: numOr(it.price, numOr(p.price, 0)), unitPrice: numOr(it.unitPrice, 0) || numOr(p.unitPrice, 0) || 0,
      packs: Math.max(0, packs), units: Math.max(0, units),
    };
  };
  const shopName = (x) => str(shopsById.get(x.shopId)?.name) || str(x.shopSnapshot?.name) || 'Точка';
  const at = (x) => str(x.createdAt) || (day(x.date) ? day(x.date) + 'T12:00:00.000Z' : now);
  const missingShop = (x, what) => { if (!shopsById.has(x.shopId)) problems.push(what + ' без точки в файле: ' + str(x.id)); };

  const shops = arr(data.shops).map((s) => {
    const pt = point(s.latitude, s.longitude);
    return [atamId(s.id), {
      name: str(s.name) || 'Точка без названия', district: str(s.district), locality: str(s.locality), contact: str(s.contact),
      phone: normPhone(s.phone) || str(s.phone), address: str(s.address), note: str(s.notes ?? s.note),
      lat: pt ? pt.lat : null, lng: pt ? pt.lng : null,
      pointSrc: pt ? POINT_SRC[s.mapSource] || str(s.mapSource) || 'GPS' : '', pointLink: str(s.mapLink), pointAt: str(s.locationUpdatedAt),
      createdAt: str(s.createdAt) || now, updatedAt: now, ...tag(s),
    }];
  });

  const visits = arr(data.visits).map((v) => {
    missingShop(v, 'Визит');
    const r = str(v.result);
    const result = r === 'Заказа нет' ? 'none' : r === 'Заказ есть' || r === 'Заказ был' || v.orderId ? 'order' : 'none';
    const lpr = v.lprPresent === 'Да' ? true : v.lprPresent === 'Нет' ? false : null;
    let refusal = null;
    if (result === 'none' && lpr === true) {
      refusal = { reason: sameAnswer(v.refusalReason), other: str(v.refusalOther), change: arr(v.refusalChanges).map(sameAnswer),
        product: str(v.productEvaluation), demand: str(v.demandEvaluation), again: str(v.revisitPotential) };
      if (!refusal.reason && !refusal.change.length && !refusal.product) refusal = null;
    }
    const nt = NEXT[str(v.nextAction)] || (day(v.nextContact) ? 'visit' : 'none');
    const pt = point(v.latitude, v.longitude);
    return [atamId(v.id), {
      shopId: atamId(v.shopId), shopName: shopName(v), date: day(v.date) || day(v.createdAt), at: at(v), result,
      orderId: v.orderId ? atamId(v.orderId) : null, lpr: result === 'none' ? lpr : null, refusal,
      next: { type: nt, date: nt === 'none' ? null : day(v.nextContact) || null, doneAt: str(v.nextActionCompletedAt) || null },
      nextText: str(v.nextAction), note: str(v.note),
      geo: pt ? { ...pt, acc: numOr(v.geoAccuracy), src: str(v.geoSource), link: str(v.geoLink) } : null,
      ...tag(v),
    }];
  });

  const orders = arr(data.orders).map((o) => {
    missingShop(o, 'Заказ');
    const items = arr(o.items).map(item).filter((i) => i.packs > 0 || i.units > 0);
    if (!items.length) problems.push('Заказ без товаров: ' + str(o.id));
    const pay = PAY[str(o.payment)] || 'unknown';
    if (!PAY[str(o.payment)] && str(o.payment)) problems.push('Незнакомая оплата «' + str(o.payment) + '» записана как «Не указано»');
    const live = shopsById.get(o.shopId) || {};
    const snap = o.shopSnapshot || {};
    return [atamId(o.id), {
      shopId: atamId(o.shopId), shopName: shopName(o), date: day(o.date) || day(o.createdAt), at: at(o),
      shop: { name: str(live.name || snap.name), contact: str(live.contact || snap.contact), phone: str(live.phone || snap.phone),
        address: str(live.address || snap.address), district: str(live.district || snap.district), locality: str(live.locality || snap.locality) },
      visitId: o.visitId ? atamId(o.visitId) : null, items, total: items.length ? itemsSum(items) : numOr(o.total, 0),
      payment: pay, paymentText: str(o.payment), paidNow: pay === 'partial' ? numOr(o.initialPaid, 0) : 0, note: str(o.note ?? o.comment),
      ...tag(o),
    }];
  });

  const returns = arr(data.returns).map((r) => {
    missingShop(r, 'Возврат');
    const items = arr(r.items).map(item).filter((i) => i.packs > 0 || i.units > 0);
    return [atamId(r.id), {
      shopId: atamId(r.shopId), shopName: shopName(r), orderId: r.orderId ? atamId(r.orderId) : null,
      date: day(r.date) || day(r.createdAt), at: at(r), items, total: typeof r.total === 'number' ? r.total : itemsSum(items),
      note: str(r.note), ...tag(r),
    }];
  });

  const payments = arr(data.payments).map((p) => [atamId(p.id), {
    shopId: atamId(p.shopId), shopName: shopName(p), orderId: p.orderId ? atamId(p.orderId) : null,
    date: day(p.date) || day(p.createdAt), at: at(p), amount: Math.max(0, numOr(p.amount, 0)), kind: 'debt',
    handedAt: str(p.handedOverAt) || null, handedDate: day(p.handedOverDate) || (str(p.handedOverAt) ? day(p.handedOverAt) : null),
    note: str(p.note), ...tag(p),
  }]);

  const plans = [];
  for (const [uid, goals] of goalsByUser(data)) {
    const email = people.get(uid)?.email;
    if (!email) continue;
    for (const [month, n] of Object.entries(goals)) {
      if (!/^\d{4}-\d{2}$/.test(month) || !(Number(n) > 0)) continue;
      plans.push([month + '__' + email, { month, rep: email, packs: Math.round(Number(n)), src: SRC }]);
    }
  }
  return { shops, visits, orders, returns, payments, products, plans, matched, problems: [...new Set(problems)] };
}


// Сверка после переноса: сколько записей в файле и сколько у нас с отметкой «из программы Атама»
export function reconcile(counts, have) {
  return Object.keys(counts).filter((k) => k !== 'products').map((k) => ({ key: k, file: counts[k], ours: have[k] || 0, ok: (have[k] || 0) === counts[k] }));
}
