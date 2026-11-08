// Отчёт за период: визиты, заказы, отказы, продажи по дням.
// В отчёте нет координат, ссылок на карты и внутренних номеров точек.
import { round2 } from './format.js?v=36adbe7e';
import { REFUSAL, orderPacks } from './visit.js?v=36adbe7e';

const inRange = (x, from, to) => !x.deleted && x.date >= from && x.date <= to;

export function buildReport({ visits, orders, payments, shops, from, to, rep = '' }) {
  const who = (x) => !rep || x.rep === rep;
  const vs = visits.filter((v) => inRange(v, from, to) && who(v) && v.kind !== 'contact');
  const os = orders.filter((o) => inRange(o, from, to) && who(o));
  const ps = payments.filter((p) => inRange(p, from, to) && who(p));
  const shopName = new Map(shops.map((s) => [s.id, s.name]));

  const withOrder = vs.filter((v) => v.result === 'order').length;
  const noOrder = vs.filter((v) => v.result === 'none').length;
  const asked = vs.filter((v) => v.result === 'none' && v.lpr === true && v.refusal);

  // Причины отказа: знаменатель только визиты без заказа, где ЛПР был и ответил
  const refusals = REFUSAL.map((q) => {
    const counts = new Map(q.options.map(([id]) => [id, 0]));
    for (const v of asked) {
      const a = v.refusal[q.id];
      for (const id of Array.isArray(a) ? a : [a]) if (counts.has(id)) counts.set(id, counts.get(id) + 1);
    }
    const rows = q.options.map(([id, label]) => ({
      id, label, count: counts.get(id), pct: asked.length ? Math.round((counts.get(id) / asked.length) * 100) : 0,
    })).filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
    return { id: q.id, title: q.title, multi: q.multi, rows };
  });

  // Продажи по дням: внутри дня каждая точка один раз, напитки по линейкам
  const days = new Map();
  const products = new Map();
  for (const o of os.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) {
    if (!days.has(o.date)) days.set(o.date, new Map());
    const shops2 = days.get(o.date);
    const name = o.shopName || shopName.get(o.shopId) || 'Точка';
    if (!shops2.has(o.shopId)) shops2.set(o.shopId, { name, lines: new Map(), total: 0 });
    const s = shops2.get(o.shopId);
    s.total += Number(o.total) || 0;
    for (const i of o.items || []) {
      const line = i.line || 'Другое';
      if (!s.lines.has(line)) s.lines.set(line, new Map());
      const items = s.lines.get(line);
      const cur = items.get(i.name) || { name: i.name, packs: 0, sum: 0 };
      cur.packs += i.packs;
      cur.sum += i.packs * i.packPrice;
      items.set(i.name, cur);
      const p = products.get(i.name) || { name: i.name, line, packs: 0, sum: 0 };
      p.packs += i.packs;
      p.sum += i.packs * i.packPrice;
      products.set(i.name, p);
    }
  }
  const dayList = [...days].map(([date, m]) => ({
    date,
    shops: [...m.values()].map((s) => ({
      name: s.name, total: round2(s.total),
      lines: [...s.lines].map(([line, items]) => ({ line, items: [...items.values()] })),
    })),
  }));

  return {
    from, to,
    visits: vs.length, withOrder, noOrder, asked: asked.length,
    conversion: vs.length ? Math.round((withOrder / vs.length) * 100) : 0,
    orders: os.length,
    packs: os.reduce((n, o) => n + orderPacks(o.items), 0),
    sum: round2(os.reduce((n, o) => n + (Number(o.total) || 0), 0)),
    paid: round2(ps.reduce((n, p) => n + (Number(p.amount) || 0), 0)),
    refusals,
    days: dayList,
    products: [...products.values()].sort((a, b) => b.packs - a.packs),
  };
}
