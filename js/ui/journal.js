// Журнал: визиты, заказы, возвраты. Фильтры и поиск запоминаются у каждой вкладки.
// Цифры над списком считаются из того же отбора, что и список.
import { S, view } from '../store.js?v=69f8b533';
import { h, icon, fill, remember, seg, stat } from './kit.js?v=69f8b533';
import { liveHead, filterBar, whoText } from './common.js?v=69f8b533';
import { isoDay, dayShort, plural } from '../logic/dates.js?v=69f8b533';
import { rub } from '../logic/format.js?v=69f8b533';
import { orderSum, returnSum, payLabel, indexMoney, orderDebt } from '../logic/money.js?v=69f8b533';
import { qtyText, itemsPacks, itemsUnits } from '../logic/products.js?v=69f8b533';
import { filterRecords, periodRange, ordersSummary, returnsSummary } from '../logic/filters.js?v=69f8b533';
import { resultText, nextById } from '../logic/visit.js?v=69f8b533';
import { openOrder, openVisit } from './order.js?v=69f8b533';
import { openReturn, startReturn } from './returns.js?v=69f8b533';
import { startOrder } from './visit.js?v=69f8b533';

const TABS = [['visits', 'Визиты'], ['orders', 'Заказы'], ['returns', 'Возвраты']];

export function mountJournal(root) {
  const tabState = remember('alsi-journal-' + S.email, { tab: 'orders' });
  const top = liveHead('Журнал');
  const tabs = h('div', { class: 'pad' });
  const filters = h('div');
  const kpis = h('div');
  const list = h('div');
  let st = null;
  root.append(top.el, tabs, filters, kpis, list);

  const setTab = (t) => {
    tabState.tab = t;
    tabState.save();
    st = remember('alsi-journal-' + t + '-' + S.email, { period: 'month', from: '', to: '', district: '', locality: '', q: '' });
    fill(tabs, seg(TABS, t, setTab));
    fill(filters, filterBar(st, () => update(), { placeholder: t === 'visits' ? 'Точка, итог, действие' : 'Поиск по точке' }));
    update();
  };

  function update() {
    const today = isoDay();
    const t = tabState.tab;
    const shops = new Map(view('shops').map((s) => [s.id, s]));
    const range = periodRange(st.period, today, st.from, st.to);
    const opts = { range, district: st.district, locality: st.locality, q: st.q, shops };
    const row = (x, title, small, right, open) => h('button', { class: 'item', onclick: open },
      h('div', { class: 't' }, h('b', {}, title), h('small', {}, small)), right, h('span', { class: 'chev' }, icon('right')));
    const when = (x) => dayShort(x.date, today) + (whoText(x.rep) ? ', ' + whoText(x.rep) : '');
    const name = (x) => shops.get(x.shopId)?.name || x.shopName || 'Точка';
    let rows = [];
    if (t === 'visits') {
      rows = filterRecords(view('visits'), { ...opts, text: (v) => resultText(v) + ' ' + (nextById(v.next?.type)?.label || '') + ' ' + (v.note || '') });
      const withOrder = rows.filter((v) => v.result === 'order').length;
      const plan = rows.filter((v) => v.kind === 'contact').length;
      fill(kpis, h('div', { class: 'stats' }, stat(String(rows.length - plan), plural(rows.length - plan, ['визит', 'визита', 'визитов'])),
        stat(String(withOrder), 'с заказом'), stat(String(rows.length - plan - withOrder), 'без заказа'), plan ? stat(String(plan), 'запланировано') : null));
      fill(list, rows.length ? h('div', { class: 'group' }, rows.slice(0, 300).map((v) => row(v, name(v), when(v) + ', ' + resultText(v).toLowerCase()
        + (v.next && v.next.type !== 'none' ? '. Дальше: ' + nextById(v.next.type).label.toLowerCase() : ''), null, () => openVisit(v.id)))) : empty());
    } else if (t === 'orders') {
      rows = filterRecords(view('orders'), { ...opts, text: (o) => payLabel(o.payment) + ' ' + (o.note || '') + ' ' + o.items.map((i) => i.name).join(' ') });
      const sum = ordersSummary(rows);
      const idx = indexMoney(view('returns'), view('payments'));
      fill(kpis, h('div', { class: 'stats' }, stat(String(sum.count), plural(sum.count, ['заказ', 'заказа', 'заказов'])),
        stat(qtyText(sum.packs, sum.units), 'продано'), stat(rub(sum.sum), 'сумма')),
      h('div', { class: 'pad', style: 'margin-top:8px' }, h('button', { class: 'btn line wide', onclick: () => startOrder() }, 'Заказ по телефону')));
      fill(list, rows.length ? h('div', { class: 'group' }, rows.slice(0, 300).map((o) => {
        const debt = orderDebt(o, idx);
        return row(o, name(o), when(o) + ', ' + qtyText(itemsPacks(o.items), itemsUnits(o.items)) + ', ' + payLabel(o.payment).toLowerCase(),
          h('span', { class: 'r num' + (debt > 0 ? ' red' : '') }, rub(orderSum(o))), () => openOrder(o.id));
      })) : empty());
    } else {
      rows = filterRecords(view('returns'), { ...opts, text: (r) => (r.note || '') + ' ' + r.items.map((i) => i.name).join(' ') });
      const sum = returnsSummary(rows);
      fill(kpis, h('div', { class: 'stats' }, stat(String(sum.count), plural(sum.count, ['возврат', 'возврата', 'возвратов'])),
        stat(qtyText(sum.packs, sum.units), 'вернули'), stat(rub(sum.sum), 'сумма')),
      h('div', { class: 'pad', style: 'margin-top:8px' }, h('button', { class: 'btn line wide', onclick: () => startReturn() }, 'Новый возврат')));
      fill(list, rows.length ? h('div', { class: 'group' }, rows.slice(0, 300).map((r) => row(r, name(r),
        when(r) + ', ' + r.items.map((i) => i.name + ' ' + qtyText(i.packs, i.units)).join(', '),
        h('span', { class: 'r num' }, rub(returnSum(r))), () => openReturn(r.id)))) : empty());
    }
    if (rows.length > 300) list.append(h('p', { class: 'muted pad' }, 'Показаны первые 300. Уточните период или поиск.'));
    list.append(h('div', { class: 'gap' }));
    top.refresh(t === 'visits' ? 'Визиты и запланированные действия' : t === 'orders' ? 'Заказы по датам, новые сверху' : 'Возвраты по заказам');
  }

  const empty = () => h('div', { class: 'empty' }, h('b', {}, 'Ничего нет'), 'Измените период или фильтры.');

  setTab(tabState.tab);
  return update;
}
