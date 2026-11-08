// Итоги: продажи, отказы, достижения. Период, район и населённый пункт действуют на все цифры.
import { S, view, all } from '../store.js?v=79063987';
import { h, fill, remember, seg, stat } from './kit.js?v=79063987';
import { liveHead, filterBar, sec } from './common.js?v=79063987';
import { isoDay, dayShort, monthTitle, plural } from '../logic/dates.js?v=79063987';
import { rub } from '../logic/format.js?v=79063987';
import { qtyText } from '../logic/products.js?v=79063987';
import { filterRecords, periodRange } from '../logic/filters.js?v=79063987';
import { salesStats, refusalStats, achievements } from '../logic/stats.js?v=79063987';

const TABS = [['sales', 'Продажи'], ['refusals', 'Отказы'], ['wins', 'Достижения']];

const bars = (rows, max = 0) => {
  const top = max || Math.max(1, ...rows.map((r) => r.value));
  return h('div', { class: 'group bars' }, rows.map((r) => h('div', { class: 'bar-row' },
    h('div', {}, h('span', {}, r.label), h('b', { class: 'num' }, r.text)),
    h('div', { class: 'track' }, h('i', { style: 'width:' + Math.min(100, Math.round((r.value / top) * 100)) + '%' })))));
};
const list = (rows) => h('div', { class: 'group' }, rows.map(([k, v]) => h('div', { class: 'kv' }, h('span', {}, k), h('b', { class: 'num' }, v))));

export function mountStats(root) {
  const st = remember('alsi-stats-' + S.email, { tab: 'sales', period: 'month', from: '', to: '', district: '', locality: '', q: '' });
  const top = liveHead('Итоги');
  const tabs = h('div', { class: 'pad' });
  const out = h('div');
  const drawTabs = () => fill(tabs, seg(TABS, st.tab, (t) => { st.tab = t; st.save(); drawTabs(); update(); }));
  root.append(top.el, tabs, filterBar(st, () => update(), { search: false }), out);
  drawTabs();

  function update() {
    const today = isoDay();
    const shops = new Map(view('shops').map((s) => [s.id, s]));
    const range = periodRange(st.period, today, st.from, st.to);
    const opts = { range, district: st.district, locality: st.locality, shops };
    const orders = filterRecords(view('orders'), opts);
    const returns = filterRecords(view('returns'), opts);
    const visits = filterRecords(view('visits'), opts);
    top.refresh(range.from ? dayShort(range.from, today) + (range.to && range.to !== range.from ? ' - ' + dayShort(range.to, today).toLowerCase() : '') : 'Всё время');
    if (st.tab === 'sales') {
      const s = salesStats({ orders, returns, visits, allOrders: all('orders'), shops });
      fill(out,
        h('div', { class: 'stats' },
          stat(rub(s.net), 'чистая выручка', 'wide'),
          stat(rub(s.gross), 'продажи'), stat(rub(s.back), 'возвраты'),
          stat(String(s.groups.drinks.packs), 'уп. напитков, основной план'),
          stat(qtyText(s.groups.sweets.packs, s.groups.sweets.units), 'шоколад и сладости'),
          stat(qtyText(s.groups.snacks.packs, s.groups.snacks.units), 'снеки'),
          stat(rub(s.avg), 'средний заказ'),
          stat(s.withOrderPct + '%', 'визитов с заказом'),
          stat(s.repeat + ' из ' + s.orders, 'повторные заказы')),
        sec('Итоги визитов'),
        bars([{ label: 'Заказ есть', value: s.withOrder, text: String(s.withOrder) }, { label: 'Заказа нет', value: s.noOrder, text: String(s.noOrder) }]),
        s.topShops.length ? [sec('Лучшие точки'), bars(s.topShops.map((x) => ({ label: x.name, value: x.sum, text: rub(x.sum) })))] : null,
        s.topProducts.length ? [sec('Лучшие товары'), bars(s.topProducts.map((x) => ({ label: x.name, value: x.sum, text: qtyText(x.packs, x.units) + ', ' + rub(x.sum) })))] : null,
        !s.orders ? h('div', { class: 'empty' }, 'Заказов за этот период нет') : null,
        h('div', { class: 'gap' }));
    } else if (st.tab === 'refusals') {
      const r = refusalStats(visits);
      fill(out,
        h('div', { class: 'stats' }, stat(String(r.asked), 'опрошено ЛПР'), stat(String(r.noLpr), 'ЛПР не было')),
        h('p', { class: 'hint pad', style: 'margin:12px 0 0' }, 'Доля от визитов без заказа, где ЛПР был на месте и ответил. Где можно несколько ответов, сумма бывает больше 100%.'),
        r.asked ? r.questions.map((q) => q.rows.length ? [sec(q.title), bars(q.rows.map((x) => ({ label: x.label, value: x.pct, text: x.count + ', ' + x.pct + '%' })), 100)] : null)
          : h('div', { class: 'empty' }, 'Отказов с ответами ЛПР за этот период нет'),
        r.other.length ? [sec('Свои причины'), h('div', { class: 'group' }, r.other.slice(0, 30).map((t) => h('div', { class: 'kv' }, h('span', {}, t))))] : null,
        h('div', { class: 'gap' }));
    } else {
      const a = achievements({ orders, returns, shops: view('shops').filter((x) => (!st.district || x.district === st.district) && (!st.locality || x.locality === st.locality)),
        products: all('products'), allOrders: all('orders') });
      fill(out,
        h('div', { class: 'stats' },
          stat(rub(a.net), 'чистая выручка', 'wide'),
          stat(String(a.buyers), plural(a.buyers, ['точка купила', 'точки купили', 'точек купили'])),
          stat(String(a.newBuyers), 'новых точек с первым заказом'),
          stat(String(a.repeat), 'повторных заказов'),
          stat(String(a.unsold), 'товаров без продаж')),
        a.biggest || a.bestDay ? [sec('Рекорды'), list([
          a.biggest ? ['Самый крупный заказ', a.biggest.name + ', ' + rub(a.biggest.sum)] : null,
          a.bestDay ? ['Лучший день', dayShort(a.bestDay[0], today) + ', ' + rub(a.bestDay[1])] : null,
          a.bestMonth ? ['Лучший месяц', monthTitle(a.bestMonth[0]) + ', ' + rub(a.bestMonth[1])] : null].filter(Boolean))] : null,
        a.byPacks.length ? [sec('Товары по упаковкам'), bars(a.byPacks.map((x) => ({ label: x.name, value: x.packs, text: x.packs + ' уп.' })))] : null,
        a.byUnits.length ? [sec('Товары штуками'), bars(a.byUnits.map((x) => ({ label: x.name, value: x.units, text: x.units + ' шт.' })))] : null,
        a.bySum.length ? [sec('Товары по выручке'), bars(a.bySum.map((x) => ({ label: x.name, value: x.sum, text: rub(x.sum) })))] : null,
        a.shops.length ? [sec('Точки по выручке'), bars(a.shops.map((x) => ({ label: x.name, value: x.sum, text: rub(x.sum) })))] : null,
        a.shopsByOrders.length ? [sec('Точки по числу заказов'), bars(a.shopsByOrders.map((x) => ({ label: x.name, value: x.orders, text: String(x.orders) })))] : null,
        a.localities.length ? [sec('Населённые пункты'), bars(a.localities.map((x) => ({ label: x.name, value: x.sum, text: x.packs + ' уп., ' + rub(x.sum) })))] : null,
        a.districts.length ? [sec('Районы'), bars(a.districts.map((x) => ({ label: x.name, value: x.sum, text: x.packs + ' уп., ' + rub(x.sum) })))] : null,
        a.shopsPerLocality.length ? [sec('Точек в пунктах'), list(a.shopsPerLocality.slice(0, 20).map(([k, v]) => [k, String(v)]))] : null,
        a.shopsPerDistrict.length ? [sec('Точек в районах'), list(a.shopsPerDistrict.slice(0, 20).map(([k, v]) => [k, String(v)]))] : null,
        !a.orders ? h('div', { class: 'empty' }, 'Заказов за этот период нет') : null,
        h('div', { class: 'gap' }));
    }
  }
  update();
  return update;
}
