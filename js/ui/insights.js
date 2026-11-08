// Итоги: панель продаж, отказы, достижения. Период, район и населённый пункт действуют на все цифры и графики.
import { S, view, all } from '../store.js?v=536b4882';
import { h, fill, remember, seg, stat } from './kit.js?v=536b4882';
import { liveHead, filterBar, sec } from './common.js?v=536b4882';
import { isoDay, dayShort, monthTitle, plural } from '../logic/dates.js?v=536b4882';
import { rub } from '../logic/format.js?v=536b4882';
import { qtyText } from '../logic/products.js?v=536b4882';
import { picOf } from '../logic/pics.js?v=536b4882';
import { filterRecords, periodRange } from '../logic/filters.js?v=536b4882';
import { salesStats, refusalStats, achievements } from '../logic/stats.js?v=536b4882';
import { prevRange, delta, series, groupMoney, funnel } from '../logic/dash.js?v=536b4882';
import { columns } from './charts.js?v=536b4882';
import { hero, segBar, rankBars, funnelBars } from './figures.js?v=536b4882';
import { openShop } from './shop.js?v=536b4882';

const TABS = [['sales', 'Продажи'], ['refusals', 'Отказы'], ['wins', 'Достижения']];

// Белая карточка графика: заголовок, пояснение справа, сам график
export const card = (title, note, ...kids) => h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('h3', {}, title), note ? h('small', {}, note) : null), kids);

// «1-8 октября» или «25 октября - 1 ноября»
function rangeText(r, today) {
  const a = dayShort(r.from, today);
  const b = dayShort(r.to, today);
  if (r.from === r.to) return a.toLowerCase();
  if (r.from.slice(0, 7) === r.to.slice(0, 7) && /\d/.test(b)) return Number(r.from.slice(8)) + '-' + b;
  return a.toLowerCase() + ' - ' + b.toLowerCase();
}

const pic = (name) => picOf(all('products').find((p) => p.name === name) || { name });
const shopRow = (x) => ({ label: x.name, value: x.sum, text: rub(x.sum), sub: x.orders ? x.orders + ' ' + plural(x.orders, ['заказ', 'заказа', 'заказов']) + (x.packs ? ', ' + x.packs + ' уп.' : '') : '', id: x.id });

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
    const k = st.tab + st.period + st.district + st.locality + st.from + st.to; // новый отбор: графики вырастают заново
    top.refresh(range.from ? dayShort(range.from, today) + (range.to && range.to !== range.from ? ' - ' + dayShort(range.to, today).toLowerCase() : '') : 'Всё время');
    if (st.tab === 'sales') {
      const s = salesStats({ orders, returns, visits, allOrders: all('orders'), shops });
      const pr = prevRange(range);
      const prev = pr ? salesStats({ orders: filterRecords(view('orders'), { ...opts, range: pr }), returns: filterRecords(view('returns'), { ...opts, range: pr }), visits: [], shops }) : null;
      const ser = series(orders, returns, range, today);
      const money = groupMoney(orders, returns);
      const g = s.groups;
      fill(out,
        hero({ key: 'net' + k, label: 'Чистая выручка', value: s.net, delta: prev ? delta(s.net, prev.net) : null, compare: pr ? 'к ' + rangeText(pr, today) : '',
          sub: [h('span', {}, 'Продажи ', h('b', { class: 'num' }, rub(s.gross))), h('span', {}, 'Возвраты ', h('b', { class: 'num' }, rub(s.back))),
            h('span', {}, 'Заказов ', h('b', { class: 'num' }, String(s.orders)))] }),
        h('div', { class: 'gap-s' }),
        ser.points.length > 1 ? card(ser.unit === 'month' ? 'Выручка по месяцам' : 'Выручка по дням', '',
          columns({ key: 'cols' + k, points: ser.points, unit: ser.unit, today, title: 'Выручка' })) : null,
        h('div', { class: 'gap-s' }),
        h('div', { class: 'pair' },
          card('Категории', 'доля выручки', segBar({ key: 'cat' + k, title: 'Категории', parts: [
            { label: 'Напитки, ' + g.drinks.packs + ' уп.', value: money.drinks, text: rub(money.drinks), color: 'var(--c-drinks)' },
            { label: 'Сладости, ' + qtyText(g.sweets.packs, g.sweets.units), value: money.sweets, text: rub(money.sweets), color: 'var(--c-sweets)' },
            { label: 'Снеки, ' + qtyText(g.snacks.packs, g.snacks.units), value: money.snacks, text: rub(money.snacks), color: 'var(--c-snacks)' }] })),
          card('Визиты и заказы', s.withOrderPct + '% визитов с заказом', funnelBars({ key: 'fn' + k, steps: funnel(visits) }))),
        h('div', { class: 'stats three', style: 'margin-top:8px' },
          stat(rub(s.avg), 'средний заказ'),
          stat(s.repeat + ' из ' + s.orders, 'повторные заказы'),
          stat(String(g.drinks.packs), 'уп. напитков, основной план')),
        s.topProducts.length ? [sec('Лучшие товары'), rankBars({ key: 'tp' + k, rows: s.topProducts.map((x) => ({ label: x.name, value: x.sum, text: rub(x.sum), sub: qtyText(x.packs, x.units), pic: pic(x.name) })) })] : null,
        s.topShops.length ? [sec('Лучшие точки'), rankBars({ key: 'ts' + k, rows: s.topShops.map(shopRow), onPick: (r) => openShop(r.id) })] : null,
        !s.orders ? h('div', { class: 'empty' }, 'Заказов за этот период нет') : null,
        h('div', { class: 'gap' }));
    } else if (st.tab === 'refusals') {
      const r = refusalStats(visits);
      fill(out,
        h('div', { class: 'stats' }, stat(String(r.asked), 'опрошено ЛПР'), stat(String(r.noLpr), 'ЛПР не было')),
        h('div', { class: 'gap-s' }),
        card('Визиты и заказы', 'ЛПР: тот, кто решает о закупке', funnelBars({ key: 'rfn' + k, steps: funnel(visits) })),
        h('p', { class: 'hint pad', style: 'margin:12px 0 0' }, 'Доля от визитов без заказа, где ЛПР был на месте и ответил. Где можно несколько ответов, сумма бывает больше 100%.'),
        r.asked ? r.questions.map((q, i) => q.rows.length ? [sec(q.title), rankBars({ key: 'rq' + i + k, max: 100, rows: q.rows.map((x) => ({ label: x.label, value: x.pct, text: x.pct + '%', sub: x.count + ' ' + plural(x.count, ['ответ', 'ответа', 'ответов']) })) })] : null)
          : h('div', { class: 'empty' }, 'Отказов с ответами ЛПР за этот период нет'),
        r.other.length ? [sec('Свои причины'), h('div', { class: 'group' }, r.other.slice(0, 30).map((t) => h('div', { class: 'kv' }, h('span', {}, t))))] : null,
        h('div', { class: 'gap' }));
    } else {
      const a = achievements({ orders, returns, shops: view('shops').filter((x) => (!st.district || x.district === st.district) && (!st.locality || x.locality === st.locality)),
        products: all('products'), allOrders: all('orders') });
      const rows = (list, f) => list.map(f);
      fill(out,
        hero({ key: 'anet' + k, label: 'Чистая выручка', value: a.net,
          sub: [h('span', {}, plural(a.buyers, ['Точка купила ', 'Точки купили ', 'Точек купили ']), h('b', { class: 'num' }, String(a.buyers))),
            h('span', {}, 'Новых с первым заказом ', h('b', { class: 'num' }, String(a.newBuyers))),
            h('span', {}, 'Повторных заказов ', h('b', { class: 'num' }, String(a.repeat))),
            h('span', {}, 'Товаров без продаж ', h('b', { class: 'num' }, String(a.unsold)))] }),
        a.biggest || a.bestDay ? [sec('Рекорды'), h('div', { class: 'group' }, [
          a.biggest ? ['Самый крупный заказ', a.biggest.name + ', ' + rub(a.biggest.sum)] : null,
          a.bestDay ? ['Лучший день', dayShort(a.bestDay[0], today) + ', ' + rub(a.bestDay[1])] : null,
          a.bestMonth ? ['Лучший месяц', monthTitle(a.bestMonth[0]) + ', ' + rub(a.bestMonth[1])] : null].filter(Boolean)
          .map(([x, v]) => h('div', { class: 'kv' }, h('span', {}, x), h('b', { class: 'num' }, v))))] : null,
        a.byPacks.length ? [sec('Товары по упаковкам'), rankBars({ key: 'bp' + k, rows: rows(a.byPacks, (x) => ({ label: x.name, value: x.packs, text: x.packs + ' уп.', pic: pic(x.name) })) })] : null,
        a.byUnits.length ? [sec('Товары штуками'), rankBars({ key: 'bu' + k, rows: rows(a.byUnits, (x) => ({ label: x.name, value: x.units, text: x.units + ' шт.', pic: pic(x.name) })) })] : null,
        a.bySum.length ? [sec('Товары по выручке'), rankBars({ key: 'bs' + k, rows: rows(a.bySum, (x) => ({ label: x.name, value: x.sum, text: rub(x.sum), pic: pic(x.name) })) })] : null,
        a.shops.length ? [sec('Точки по выручке'), rankBars({ key: 'as' + k, rows: a.shops.map(shopRow), onPick: (r) => openShop(r.id) })] : null,
        a.shopsByOrders.length ? [sec('Точки по числу заказов'), rankBars({ key: 'ao' + k, rows: rows(a.shopsByOrders, (x) => ({ label: x.name, value: x.orders, text: String(x.orders), id: x.id })), onPick: (r) => r.id && openShop(r.id) })] : null,
        a.localities.length ? [sec('Населённые пункты'), rankBars({ key: 'al' + k, rows: rows(a.localities, (x) => ({ label: x.name, value: x.sum, text: rub(x.sum), sub: x.packs + ' уп.' })) })] : null,
        a.districts.length ? [sec('Районы'), rankBars({ key: 'ad' + k, rows: rows(a.districts, (x) => ({ label: x.name, value: x.sum, text: rub(x.sum), sub: x.packs + ' уп.' })) })] : null,
        a.shopsPerLocality.length ? [sec('Точек в пунктах'), rankBars({ key: 'pl' + k, rows: rows(a.shopsPerLocality.slice(0, 20), ([n, v]) => ({ label: n, value: v, text: String(v) })) })] : null,
        a.shopsPerDistrict.length ? [sec('Точек в районах'), rankBars({ key: 'pd' + k, rows: rows(a.shopsPerDistrict.slice(0, 20), ([n, v]) => ({ label: n, value: v, text: String(v) })) })] : null,
        !a.orders ? h('div', { class: 'empty' }, 'Заказов за этот период нет') : null,
        h('div', { class: 'gap' }));
    }
  }
  update();
  return update;
}
