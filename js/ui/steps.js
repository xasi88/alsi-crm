// Общие шаги визита, заказа и возврата: выбор точки, предупреждение о долге, оплата.
import { S, view, all } from '../store.js?v=69f8b533';
import { h, icon, fill, choices, field, inp } from './kit.js?v=69f8b533';
import { isoDay, dayShort } from '../logic/dates.js?v=69f8b533';
import { rub, parseMoney, shopMatches } from '../logic/format.js?v=69f8b533';
import { shopDebts, PAYMENTS, partialError } from '../logic/money.js?v=69f8b533';
import { editShop } from './shops.js?v=69f8b533';

// Предупреждение о долге точки при выборе
export function debtWarn(shopId) {
  const d = shopDebts(all('orders'), all('returns'), all('payments'), isoDay()).get(shopId);
  if (!d || !(d.owed > 0)) return null;
  const last = all('payments').filter((p) => p.shopId === shopId && p.kind !== 'order').sort((a, b) => (a.at < b.at ? 1 : -1))[0];
  return h('div', { class: 'warnbox' }, h('b', {}, 'Долг точки: ' + rub(d.owed)),
    h('div', { class: 'hint', style: 'margin:4px 0 0' }, last ? 'Последняя оплата ' + dayShort(last.date, isoDay()).toLowerCase() + ', ' + rub(last.amount) : 'Оплат по долгу ещё не было'));
}

// Список точек с поиском и кнопкой «Новая точка»
export function shopStep(body, onPick) {
  let q = '';
  const list = h('div');
  const debts = shopDebts(view('orders'), view('returns'), view('payments'), isoDay());
  const drawList = () => {
    const mine = all('shops').filter((x) => x.rep === S.email && shopMatches(x, q))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru')).slice(0, 60);
    fill(list, mine.length ? h('div', { class: 'group', style: 'margin:0' }, mine.map((x) => h('button', { class: 'item', onclick: () => onPick(x.id) },
      h('div', { class: 't' }, h('b', {}, x.name), h('small', {}, [x.address, x.locality].filter(Boolean).join(', ') || 'Адрес не указан')),
      debts.get(x.id)?.owed ? h('span', { class: 'r red num' }, rub(debts.get(x.id).owed)) : null, h('span', { class: 'chev' }, icon('right')))))
      : h('div', { class: 'empty', style: 'margin:0' }, q ? 'Такой точки нет' : 'Ваших точек пока нет'));
  };
  fill(body,
    h('div', { class: 'search', style: 'margin:0 0 12px' }, icon('search'),
      inp({ type: 'search', placeholder: 'Название, ЛПР, телефон, адрес', 'aria-label': 'Поиск точки', oninput: (e) => { q = e.target.value; drawList(); } })),
    h('button', { class: 'btn line wide', style: 'margin-bottom:12px', onclick: () => editShop({ name: q }, (id) => onPick(id)) }, 'Новая точка'),
    list);
  drawList();
}

// Выбор оплаты. d: { payment, paidNow }
export function payBlock(d, total, onChange = () => {}) {
  const box = h('div');
  const draw = () => fill(box,
    choices(PAYMENTS.map((p) => [p.id, p.label]), d.payment, (v) => { d.payment = v; onChange(); draw(); }, { col: true }),
    d.payment ? h('p', { class: 'hint', style: 'margin:8px 0 0' }, PAYMENTS.find((p) => p.id === d.payment).note) : null,
    d.payment === 'partial' ? h('div', { style: 'margin-top:12px' }, field('Сколько отдали сразу', inp({ inputmode: 'decimal', placeholder: '0', value: d.paidNow || '',
      oninput: (e) => { d.paidNow = e.target.value; onChange(); } }), 'остальное: долг')) : null);
  draw();
  return box;
}
export function payError(d, total) {
  if (!d.payment) return 'Выберите оплату';
  if (d.payment !== 'partial') return '';
  const v = parseMoney(d.paidNow);
  return Number.isNaN(v) ? 'Сумма: только цифры' : partialError(v, total);
}
