// Экран «Сегодня»: маршрут дня, ближайшие дела, давно без заказа, план месяца.
import { addDays, daysBetween, monthKey } from './dates.js?v=79063987';
import { activeNext } from './visit.js?v=79063987';
import { itemsPacks } from './products.js?v=79063987';
import { shopDebts } from './money.js?v=79063987';

const groupBy = (list, key) => {
  const m = new Map();
  for (const x of list) {
    if (x.deleted) continue;
    const k = x[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
};

const lastDate = (list) => list.reduce((d, x) => (x.date > d ? x.date : d), '');

// rep: почта торгового. Пусто: все точки, которые видит руководитель.
export function buildDay({ shops, visits, orders, payments, returns = [], today, rep = '', staleDays = 14, soonDays = 7 }) {
  const byShopVisits = groupBy(visits, 'shopId');
  const byShopOrders = groupBy(orders, 'shopId');
  const debts = shopDebts(orders, returns, payments, today);
  const stops = [];
  const soon = [];
  const stale = [];
  const soonEnd = addDays(today, soonDays);

  for (const s of shops) {
    if (s.deleted || s.archived) continue;
    const vs = byShopVisits.get(s.id) || [];
    const os = byShopOrders.get(s.id) || [];
    if (rep && s.rep !== rep && !vs.some((v) => v.rep === rep)) continue;
    const next = activeNext(vs);
    const todayVisits = vs.filter((v) => v.date === today && v.kind !== 'contact');
    const owed = debts.get(s.id)?.owed || 0;
    const due = next && next.date && next.date <= today ? next : null;
    if (due || todayVisits.length) {
      const doneVisit = todayVisits.sort((a, b) => ((a.at || '') < (b.at || '') ? 1 : -1))[0];
      stops.push({
        shop: s,
        task: due ? due.type : null,
        visitId: due ? due.visitId : null,
        overdue: due ? Math.max(0, daysBetween(due.date, today)) : 0,
        done: !!doneVisit && !(due && due.type === 'visit'),
        result: doneVisit ? doneVisit.result : null,
        packs: os.filter((o) => o.date === today).reduce((n, o) => n + itemsPacks(o.items), 0),
        owed,
      });
      continue;
    }
    if (next) {
      if (next.date && next.date <= soonEnd) soon.push({ shop: s, next, owed, days: daysBetween(today, next.date) });
      continue;
    }
    const lo = lastDate(os);
    const lv = lastDate(vs.filter((v) => v.kind !== 'contact'));
    const from = lo || lv;
    const days = from ? daysBetween(from, today) : null;
    if (days === null || days >= staleDays) stale.push({ shop: s, days, ordered: !!lo, owed });
  }

  const name = (a, b) => a.shop.name.localeCompare(b.shop.name, 'ru');
  stops.sort((a, b) => (a.done - b.done) || (b.overdue - a.overdue)
    || ((a.task === 'visit' ? 0 : 1) - (b.task === 'visit' ? 0 : 1)) || name(a, b));
  soon.sort((a, b) => a.days - b.days || name(a, b));
  stale.sort((a, b) => ((b.days ?? 9999) - (a.days ?? 9999)) || name(a, b));

  let debtCount = 0;
  let debtSum = 0;
  for (const s of shops) {
    if (s.deleted) continue;
    const o = debts.get(s.id)?.owed || 0;
    if (o > 0) { debtCount += 1; debtSum += o; }
  }
  return { stops, soon, stale, debts: { count: debtCount, sum: Math.round(debtSum * 100) / 100 } };
}

// Факт плана: упаковки напитков за месяц минус возвращённые упаковки напитков.
// Сладости и снеки в план не входят. rep: один человек или список почт (команда).
export function monthFact(orders, key, rep = '', returns = []) {
  const who = (x) => !rep || (Array.isArray(rep) ? rep.includes(x.rep) : x.rep === rep);
  const sold = orders.filter((o) => !o.deleted && monthKey(o.date) === key && who(o))
    .reduce((n, o) => n + itemsPacks(o.items, 'drinks'), 0);
  const back = returns.filter((r) => !r.deleted && monthKey(r.date) === key && who(r))
    .reduce((n, r) => n + itemsPacks(r.items, 'drinks'), 0);
  return Math.max(0, sold - back);
}

export function planBar(plan, fact) {
  const p = Number(plan) || 0;
  return { plan: p, fact, pct: p > 0 ? Math.min(100, Math.round((fact / p) * 1000) / 10) : 0, left: Math.max(0, p - fact) };
}
