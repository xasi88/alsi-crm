// Экран «Сегодня»: маршрут дня, давно без заказа, план месяца.
import { daysBetween, monthKey } from './dates.js?v=282e3437';
import { activeNext, orderPacks } from './visit.js?v=282e3437';
import { balances } from './money.js?v=282e3437';

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

// rep: почта торгового. Пусто: все точки (владелец смотрит общую картину).
export function buildDay({ shops, visits, orders, payments, today, rep = '', staleDays = 14 }) {
  const byShopVisits = groupBy(visits, 'shopId');
  const byShopOrders = groupBy(orders, 'shopId');
  const bal = balances(orders, payments, today);
  const stops = [];
  const stale = [];

  for (const s of shops) {
    if (s.deleted || s.archived) continue;
    const vs = byShopVisits.get(s.id) || [];
    const os = byShopOrders.get(s.id) || [];
    const mine = !rep || s.rep === rep || vs.some((v) => v.rep === rep);
    if (!mine) continue;
    const next = activeNext(vs);
    const todayVisits = vs.filter((v) => v.date === today && v.kind !== 'contact');
    const owed = bal.get(s.id)?.owed || 0;
    const due = next && next.date && next.date <= today ? next : null;
    if (due || todayVisits.length) {
      const doneVisit = todayVisits.sort((a, b) => ((a.at || '') < (b.at || '') ? 1 : -1))[0];
      const todayOrders = os.filter((o) => o.date === today);
      stops.push({
        shop: s,
        task: due ? due.type : null,
        visitId: due ? due.visitId : null,
        overdue: due ? Math.max(0, daysBetween(due.date, today)) : 0,
        done: !!doneVisit && !(due && due.type === 'visit'),
        result: doneVisit ? doneVisit.result : null,
        packs: todayOrders.reduce((n, o) => n + orderPacks(o.items), 0),
        owed,
      });
      continue;
    }
    if (next) continue; // действие назначено на будущее
    const lo = lastDate(os);
    const lv = lastDate(vs.filter((v) => v.kind !== 'contact'));
    const from = lo || lv;
    const days = from ? daysBetween(from, today) : null;
    if (days === null || days >= staleDays) {
      stale.push({ shop: s, days, ordered: !!lo, owed });
    }
  }

  stops.sort((a, b) => (a.done - b.done) || (b.overdue - a.overdue)
    || ((a.task === 'visit' ? 0 : 1) - (b.task === 'visit' ? 0 : 1))
    || a.shop.name.localeCompare(b.shop.name, 'ru'));
  stale.sort((a, b) => ((b.days ?? 9999) - (a.days ?? 9999)) || a.shop.name.localeCompare(b.shop.name, 'ru'));

  let debtCount = 0;
  let debtSum = 0;
  for (const s of shops) {
    if (s.deleted) continue;
    const o = bal.get(s.id)?.owed || 0;
    if (o > 0) { debtCount += 1; debtSum += o; }
  }
  return { stops, stale, debts: { count: debtCount, sum: Math.round(debtSum * 100) / 100 } };
}

// Факт плана: упаковки в заказах торгового за месяц
export function monthFact(orders, key, rep = '') {
  return orders.filter((o) => !o.deleted && monthKey(o.date) === key && (!rep || o.rep === rep))
    .reduce((n, o) => n + orderPacks(o.items), 0);
}

export function planBar(plan, fact) {
  const p = Number(plan) || 0;
  return { plan: p, fact, pct: p > 0 ? Math.min(100, Math.round((fact / p) * 1000) / 10) : 0, left: Math.max(0, p - fact) };
}
