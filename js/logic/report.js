// Отчёт PDF: разделы на выбор, сотрудник, точка, категория, даты.
// Продажи строго по датам. Внутри даты точка один раз, её товары по категориям.
// В отчёте нет координат, ссылок на карты и внутренних номеров.
import { round2 } from './format.js?v=79063987';
import { CATS, catOf, groupOf, itemPacks, itemUnits, itemSum, qtyText } from './products.js?v=79063987';
import { returnSum, shopDebts, debtRows } from './money.js?v=79063987';
import { inRange } from './filters.js?v=79063987';
import { salesStats, refusalStats } from './stats.js?v=79063987';

export const SECTIONS = [['sales', 'Продажи'], ['analytics', 'Аналитика'], ['debts', 'Долги'], ['refusals', 'Отказы'], ['returns', 'Возвраты']];
export const PRESETS = [
  ['full', 'Полный', ['sales', 'analytics', 'debts', 'refusals', 'returns']],
  ['salesDebts', 'Продажи и долги', ['sales', 'debts']],
  ['sales', 'Только продажи', ['sales']],
  ['analytics', 'Только аналитика', ['analytics']],
  ['debts', 'Только долги', ['debts']],
  ['refusals', 'Только отказы', ['refusals']],
];

// Категория: '' все, 'drinks' 'sweets' 'snacks' группа, иначе одна категория
const catMatch = (i, cat) => !cat || groupOf(i) === cat || catOf(i) === cat;
const onlyCat = (list, cat) => list.map((x) => ({ ...x, items: (x.items || []).filter((i) => catMatch(i, cat)) }))
  .filter((x) => !cat || x.items.length);

// Точка в отчёте: только название, адрес, телефон, ЛПР
export const shopInfo = (s, snap = {}) => ({
  name: s?.name || snap.name || 'Точка', address: [s?.address || snap.address, s?.locality || snap.locality].filter(Boolean).join(', '),
  phone: s?.phone || snap.phone || '', contact: s?.contact || snap.contact || '',
});

export function buildReport({ visits, orders, returns, payments, shops, from, to, rep = '', shopId = '', cat = '', sections = [] }) {
  const range = { from, to };
  const who = (x) => !x.deleted && (!rep || x.rep === rep) && (!shopId || x.shopId === shopId);
  const shopMap = new Map(shops.map((s) => [s.id, s]));
  const osAll = orders.filter((o) => who(o) && inRange(o.date, range));
  const os = onlyCat(osAll, cat);
  const rs = onlyCat(returns.filter((r) => who(r) && inRange(r.date, range)), cat);
  const vs = visits.filter((v) => who(v) && inRange(v.date, range) && v.kind !== 'contact');
  const has = (id) => sections.includes(id);
  const out = { from, to, rep, shopId, cat, sections };

  if (has('sales')) {
    const days = new Map();
    for (const o of os.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) {
      if (!days.has(o.date)) days.set(o.date, new Map());
      const dm = days.get(o.date);
      if (!dm.has(o.shopId)) dm.set(o.shopId, { shop: shopInfo(shopMap.get(o.shopId), o.shop || { name: o.shopName }), cats: new Map(), sum: 0 });
      const s = dm.get(o.shopId);
      for (const i of o.items) {
        const c = catOf(i);
        if (!s.cats.has(c)) s.cats.set(c, new Map());
        const im = s.cats.get(c);
        const cur = im.get(i.productId) || { name: i.name, packs: 0, units: 0, sum: 0 };
        cur.packs += itemPacks(i); cur.units += itemUnits(i); cur.sum = round2(cur.sum + itemSum(i));
        im.set(i.productId, cur);
        s.sum = round2(s.sum + itemSum(i));
      }
    }
    const order = CATS.map((c) => c.id);
    out.sales = [...days].map(([date, dm]) => ({
      date,
      sum: round2([...dm.values()].reduce((n, s) => n + s.sum, 0)),
      shops: [...dm.values()].map((s) => ({
        ...s.shop, sum: s.sum,
        cats: [...s.cats].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
          .map(([c, im]) => ({ cat: c, items: [...im.values()].map((i) => ({ ...i, qty: qtyText(i.packs, i.units) })) })),
      })),
    }));
    out.salesSum = round2(out.sales.reduce((n, d) => n + d.sum, 0));
  }
  if (has('analytics')) out.analytics = salesStats({ orders: os, returns: rs, visits: vs, allOrders: orders, shops: shopMap });
  if (has('refusals')) out.refusals = refusalStats(vs);
  if (has('returns')) {
    out.returns = rs.map((r) => ({ date: r.date, shop: shopInfo(shopMap.get(r.shopId), { name: r.shopName }), sum: returnSum(r),
      items: r.items.map((i) => i.name + ' ' + qtyText(i.packs, i.units)).join(', '), note: r.note || '' }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    out.returnsSum = round2(out.returns.reduce((n, r) => n + r.sum, 0));
  }
  if (has('debts')) {
    // Долг по заказу целиком, без фильтра категории и дат: оплаты относятся ко всему заказу
    const mine = (x) => !x.deleted && (!rep || x.rep === rep) && (!shopId || x.shopId === shopId);
    const debts = shopDebts(orders.filter(mine), returns.filter(mine), payments.filter(mine), to);
    out.debts = debtRows(shops.filter((s) => !shopId || s.id === shopId), debts, payments.filter(mine))
      .filter((r) => r.owed > 0)
      .map((r) => ({ shop: shopInfo(r.shop), owed: r.owed, age: r.age, orders: r.orders.map((x) => ({ date: x.order.date, debt: x.debt })) }));
    out.debtsSum = round2(out.debts.reduce((n, r) => n + r.owed, 0));
  }
  return out;
}
