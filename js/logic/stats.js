// Итоги: продажи, отказы, достижения. Чистая выручка: продажи минус возвраты.
// Напитки, сладости и снеки считаются отдельно, выручка общим итогом.
import { round2 } from './format.js?v=92040873';
import { groupOf, itemPacks, itemUnits, itemSum, itemsPacks, itemsUnits } from './products.js?v=92040873';
import { orderSum, returnSum } from './money.js?v=92040873';
import { REFUSAL } from './visit.js?v=92040873';

const live = (x) => !x.deleted;
const byDateAt = (a, b) => (a.date === b.date ? ((a.at || '') < (b.at || '') ? -1 : 1) : a.date < b.date ? -1 : 1);

// Первый заказ точки за всё время или повторный
export function firstOrders(allOrders) {
  const first = new Map();
  for (const o of allOrders.filter(live).sort(byDateAt)) if (!first.has(o.shopId)) first.set(o.shopId, o.id);
  return first;
}
export const orderType = (o, first) => (first.get(o.shopId) === o.id ? 'Первый' : 'Повторный');

// Упаковки и штуки по группам: продано минус возвращено
export function groupsNet(orders, returns) {
  const out = {};
  for (const g of ['drinks', 'sweets', 'snacks']) {
    out[g] = {
      packs: Math.max(0, orders.reduce((n, o) => n + itemsPacks(o.items, g), 0) - returns.reduce((n, r) => n + itemsPacks(r.items, g), 0)),
      units: Math.max(0, orders.reduce((n, o) => n + itemsUnits(o.items, g), 0) - returns.reduce((n, r) => n + itemsUnits(r.items, g), 0)),
    };
  }
  return out;
}

export function salesStats({ orders, returns, visits, allOrders = orders, shops = new Map() }) {
  const os = orders.filter(live);
  const rs = returns.filter(live);
  const vs = visits.filter((v) => live(v) && v.kind !== 'contact');
  const gross = round2(os.reduce((n, o) => n + orderSum(o), 0));
  const back = round2(rs.reduce((n, r) => n + returnSum(r), 0));
  const first = firstOrders(allOrders);
  const repeat = os.filter((o) => orderType(o, first) === 'Повторный').length;
  const withOrder = vs.filter((v) => v.result === 'order').length;
  const shopMap = new Map();
  const prodMap = new Map();
  for (const o of os) {
    const s = shopMap.get(o.shopId) || { id: o.shopId, name: shops.get(o.shopId)?.name || o.shopName || 'Точка', sum: 0, packs: 0, orders: 0 };
    s.sum += orderSum(o);
    s.packs += itemsPacks(o.items);
    s.orders += 1;
    shopMap.set(o.shopId, s);
    for (const i of o.items || []) {
      const p = prodMap.get(i.productId) || { id: i.productId, name: i.name, group: groupOf(i), packs: 0, units: 0, sum: 0 };
      p.packs += itemPacks(i);
      p.units += itemUnits(i);
      p.sum += itemSum(i);
      prodMap.set(i.productId, p);
    }
  }
  for (const r of rs) {
    const s = shopMap.get(r.shopId);
    if (s) { s.sum -= returnSum(r); s.packs -= itemsPacks(r.items); }
    for (const i of r.items || []) {
      const p = prodMap.get(i.productId);
      if (p) { p.packs -= itemPacks(i); p.units -= itemUnits(i); p.sum -= itemSum(i); }
    }
  }
  const fix = (x) => ({ ...x, sum: round2(Math.max(0, x.sum)), packs: Math.max(0, x.packs), units: Math.max(0, x.units || 0) });
  return {
    gross, back, net: round2(gross - back),
    orders: os.length, returns: rs.length,
    groups: groupsNet(os, rs),
    avg: os.length ? round2(gross / os.length) : 0,
    visits: vs.length, withOrder, noOrder: vs.length - withOrder,
    withOrderPct: vs.length ? Math.round((withOrder / vs.length) * 100) : 0,
    repeat, repeatPct: os.length ? Math.round((repeat / os.length) * 100) : 0,
    topShops: [...shopMap.values()].map(fix).filter((s) => s.sum > 0).sort((a, b) => b.sum - a.sum).slice(0, 10),
    topProducts: [...prodMap.values()].map(fix).filter((p) => p.packs > 0 || p.units > 0).sort((a, b) => b.sum - a.sum).slice(0, 10),
  };
}

// Отказы: доля от визитов без заказа, где ЛПР был и ответил. У «нескольких ответов» сумма может быть больше 100%.
export function refusalStats(visits) {
  const asked = visits.filter((v) => live(v) && v.kind !== 'contact' && v.result === 'none' && v.lpr === true && v.refusal);
  const noLpr = visits.filter((v) => live(v) && v.kind !== 'contact' && v.result === 'none' && v.lpr === false).length;
  const questions = REFUSAL.map((q) => {
    const counts = new Map();
    for (const v of asked) {
      const a = v.refusal[q.id];
      for (const x of Array.isArray(a) ? a : a ? [a] : []) counts.set(x, (counts.get(x) || 0) + 1);
    }
    const rows = [...counts].map(([label, count]) => ({ label, count, pct: asked.length ? Math.round((count / asked.length) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
    return { id: q.id, title: q.title, multi: q.multi, rows };
  });
  const other = asked.map((v) => String(v.refusal.other || '').trim()).filter(Boolean);
  return { asked: asked.length, noLpr, questions, other };
}

// Достижения за период
export function achievements({ orders, returns, shops, products = [], allOrders = orders }) {
  const os = orders.filter(live);
  const rs = returns.filter(live);
  const shopById = new Map(shops.map((s) => [s.id, s]));
  const st = salesStats({ orders: os, returns: rs, visits: [], allOrders, shops: shopById });
  // Сумма заказа после его возвратов: так считает и программа Атама
  const back = new Map();
  for (const r of returns.filter(live)) if (r.orderId) back.set(r.orderId, (back.get(r.orderId) || 0) + returnSum(r));
  const net = (o) => Math.max(0, round2(orderSum(o) - (back.get(o.id) || 0)));
  const prod = new Map();
  for (const o of os) for (const i of o.items || []) {
    const p = prod.get(i.productId) || { name: i.name, group: groupOf(i), packs: 0, units: 0, sum: 0 };
    p.packs += itemPacks(i); p.units += itemUnits(i); p.sum += itemSum(i);
    prod.set(i.productId, p);
  }
  for (const r of rs) for (const i of r.items || []) {
    const p = prod.get(i.productId);
    if (p) { p.packs -= itemPacks(i); p.units -= itemUnits(i); p.sum -= itemSum(i); }
  }
  const list = [...prod.values()].map((p) => ({ ...p, packs: Math.max(0, p.packs), units: Math.max(0, p.units), sum: round2(Math.max(0, p.sum)) }));
  const place = (key, none) => {
    const m = new Map();
    for (const o of os) {
      const name = String(shopById.get(o.shopId)?.[key] || o.shop?.[key] || '').trim() || none;
      const x = m.get(name) || { name, sum: 0, packs: 0 };
      x.sum += net(o); x.packs += itemsPacks(o.items);
      m.set(name, x);
    }
    return [...m.values()].map((x) => ({ ...x, sum: round2(x.sum) })).sort((a, b) => b.sum - a.sum);
  };
  const count = (key) => {
    const m = new Map();
    for (const s of shops) if (!s.deleted && String(s[key] || '').trim()) m.set(s[key].trim(), (m.get(s[key].trim()) || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const days = new Map();
  const months = new Map();
  for (const o of os) {
    days.set(o.date, round2((days.get(o.date) || 0) + net(o)));
    months.set(o.date.slice(0, 7), round2((months.get(o.date.slice(0, 7)) || 0) + net(o)));
  }
  const best = (m) => [...m].sort((a, b) => b[1] - a[1])[0] || null;
  const first = firstOrders(allOrders);
  const ids = new Set(os.map((o) => o.id));
  const biggest = os.slice().sort((a, b) => net(b) - net(a))[0] || null;
  const sold = new Set(list.filter((p) => p.packs > 0 || p.units > 0).map((p) => p.name));
  return {
    net: st.net, orders: os.length, groups: st.groups,
    byPacks: list.filter((p) => p.packs > 0).sort((a, b) => b.packs - a.packs).slice(0, 10),
    byUnits: list.filter((p) => p.units > 0).sort((a, b) => b.units - a.units).slice(0, 10),
    bySum: list.filter((p) => p.sum > 0).sort((a, b) => b.sum - a.sum).slice(0, 10),
    shops: st.topShops,
    shopsByPacks: st.topShops.slice().sort((a, b) => b.packs - a.packs).slice(0, 10),
    shopsByOrders: st.topShops.slice().sort((a, b) => b.orders - a.orders).slice(0, 10),
    localities: place('locality', 'Без населённого пункта'),
    districts: place('district', 'Без района'),
    shopsPerLocality: count('locality'),
    shopsPerDistrict: count('district'),
    biggest: biggest ? { order: biggest, sum: net(biggest), name: shopById.get(biggest.shopId)?.name || biggest.shopName } : null,
    bestDay: best(days), bestMonth: best(months),
    buyers: new Set(os.map((o) => o.shopId)).size,
    repeat: st.repeat,
    newBuyers: [...first.values()].filter((id) => ids.has(id)).length,
    unsold: products.filter((p) => !p.deleted && p.active !== false && !sold.has(p.name)).length,
  };
}

// Цифры дня на главной: напитки, сладости, снеки, выручка, средний заказ
export function dayStats(orders) {
  const os = orders.filter(live);
  const sum = round2(os.reduce((n, o) => n + orderSum(o), 0));
  const g = (id) => ({ packs: os.reduce((n, o) => n + itemsPacks(o.items, id), 0), units: os.reduce((n, o) => n + itemsUnits(o.items, id), 0) });
  return { orders: os.length, sum, avg: os.length ? round2(sum / os.length) : 0, drinks: g('drinks'), sweets: g('sweets'), snacks: g('snacks') };
}

// Цифры человека в «Команде»: всё время и этот месяц
export function memberStats(email, { shops, visits, orders, returns }, month) {
  const mine = (x) => live(x) && x.rep === email;
  const vs = visits.filter((v) => mine(v) && v.kind !== 'contact');
  const mo = orders.filter((o) => mine(o) && o.date.startsWith(month));
  const mr = returns.filter((r) => mine(r) && r.date.startsWith(month));
  const last = vs.reduce((d, v) => (v.date > d ? v.date : d), '');
  return {
    shops: shops.filter(mine).length, visits: vs.length, orders: orders.filter(mine).length,
    monthPacks: Math.max(0, mo.reduce((n, o) => n + itemsPacks(o.items, 'drinks'), 0) - mr.reduce((n, r) => n + itemsPacks(r.items, 'drinks'), 0)),
    monthSum: round2(mo.reduce((n, o) => n + orderSum(o), 0) - mr.reduce((n, r) => n + returnSum(r), 0)),
    lastVisit: last,
  };
}
