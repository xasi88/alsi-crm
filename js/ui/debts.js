// Долги: кто должен, деньги на руках, «Деньги переданы».
// Точка остаётся в списке, пока есть долг или деньги, которые ещё не переданы руководству.
import { S, view, all, subscribe, shopById, canEdit } from '../store.js?v=564a57de';
import { addPayments, handOver } from '../save.js?v=564a57de';
import { h, icon, fill, sheet, toast, ask, field, inp } from './kit.js?v=564a57de';
import { head, ageText, sec } from './common.js?v=564a57de';
import { isoDay, dayShort, plural } from '../logic/dates.js?v=564a57de';
import { rub, parseMoney } from '../logic/format.js?v=564a57de';
import { shopDebts, debtRows, inHand, paymentError, allocate } from '../logic/money.js?v=564a57de';
import { openOrder } from './order.js?v=564a57de';
import { openShop } from './shop.js?v=564a57de';

async function handOverAsk(list, what) {
  const sum = list.reduce((n, p) => n + Number(p.amount), 0);
  const ok = await ask('Деньги переданы?', 'Отметить, что ' + rub(sum) + ' ' + what + ' переданы руководству. Оплаты останутся в истории с датой передачи.', 'Да, переданы');
  if (ok) { handOver(list); toast('Отмечено: ' + rub(sum) + ' переданы'); }
}

export function mountDebts(root) {
  const update = () => {
    const today = isoDay();
    const debts = shopDebts(view('orders'), view('returns'), view('payments'), today);
    const rows = debtRows(view('shops'), debts, view('payments'));
    const total = rows.reduce((n, r) => n + r.owed, 0);
    const owing = rows.filter((r) => r.owed > 0).length;
    const hand = inHand(view('payments'), S.scope || (S.lead ? '' : S.email));
    const mine = hand.list.filter((p) => canEdit(p));
    fill(root,
      head('Долги', owing ? owing + ' ' + plural(owing, ['точка должна', 'точки должны', 'точек должны']) + ' ' + rub(total) : 'Долгов нет'),
      h('section', { class: 'hand' },
        h('div', { class: 'row1' }, h('span', {}, S.lead && !S.scope ? 'На руках у команды' : 'Деньги на руках'), h('b', { class: 'big-sum num' }, rub(hand.sum))),
        h('small', {}, hand.list.length ? hand.list.length + ' ' + plural(hand.list.length, ['оплата ещё не передана', 'оплаты ещё не переданы', 'оплат ещё не переданы']) : 'Все деньги переданы'),
        mine.length ? h('button', { class: 'btn red wide', onclick: () => handOverAsk(mine, 'с рук') }, 'Деньги переданы') : null),
      rows.length ? sec('Кто должен', h('span', { class: 'muted', style: 'font-size:14px' }, 'старые выше')) : null,
      rows.length ? h('div', { class: 'group' }, rows.map((r) => h('button', { class: 'item', onclick: () => openShopDebt(r.shop.id) },
        h('div', { class: 't' }, h('b', {}, r.shop.name),
          h('small', { class: r.age >= 14 ? 'red' : '' }, r.owed > 0 ? ageText(r.age) : 'Долг погашен'),
          r.toHand > 0 ? h('small', {}, 'К передаче ' + rub(r.toHand)) : null),
        h('span', { class: 'r num ' + (r.owed > 0 ? 'red' : 'ok') }, rub(r.owed)),
        h('span', { class: 'chev' }, icon('right'))))) : null,
      !rows.length && S.loaded.orders ? h('div', { class: 'empty' }, h('b', {}, 'Никто не должен'), 'Заказы «В долг» и «Часть сразу» появятся здесь.') : null,
      h('div', { class: 'gap' }));
  };
  update();
  return update;
}

// Долг одной точки: заказы с долгом, оплаты к передаче, принять оплату
export function openShopDebt(shopId) {
  let off = null;
  const s = sheet({ title: 'Долг', full: true, onClose: () => off && off() });
  const draw = () => {
    const shop = shopById(shopId);
    if (!shop) { fill(s.body, h('div', { class: 'empty' }, 'Точка не найдена')); return; }
    const today = isoDay();
    const mine = (x) => x.shopId === shopId;
    const d = shopDebts(all('orders').filter(mine), all('returns').filter(mine), all('payments').filter(mine), today).get(shopId) || { owed: 0, orders: [], age: 0 };
    const hand = inHand(all('payments'), '', shopId);
    const edit = canEdit(shop) || d.orders.some((x) => canEdit(x.order));
    s.setTitle('Долг: ' + shop.name, d.owed > 0 ? ageText(d.age) : 'Долга нет');
    fill(s.body,
      h('div', { class: 'stats', style: 'margin:0' },
        h('div', { class: 'stat' }, h('b', { class: 'num ' + (d.owed > 0 ? 'red' : 'ok') }, rub(d.owed)), h('span', {}, 'долг')),
        h('div', { class: 'stat' }, h('b', { class: 'num' }, rub(hand.sum)), h('span', {}, 'к передаче'))),
      h('div', { class: 'gap' }),
      edit && d.owed > 0 ? h('button', { class: 'btn navy wide', onclick: () => takePayment(shop, d) }, 'Принять оплату') : null,
      hand.list.some(canEdit) ? h('button', { class: 'btn red wide', style: 'margin-top:8px', onclick: () => handOverAsk(hand.list.filter(canEdit), 'от этой точки') }, 'Деньги переданы') : null,
      d.orders.length ? [h('div', { class: 'sec', style: 'padding:24px 0 8px' }, h('h2', {}, 'Заказы с долгом')),
        h('div', { class: 'group', style: 'margin:0' }, d.orders.map((x) => h('button', { class: 'item', onclick: () => openOrder(x.order.id) },
          h('div', { class: 't' }, h('b', {}, 'Заказ ' + dayShort(x.order.date, today).toLowerCase()), h('small', {}, 'Сумма ' + rub(x.order.total))),
          h('span', { class: 'r red num' }, rub(x.debt)), h('span', { class: 'chev' }, icon('right')))))] : null,
      hand.list.length ? [h('div', { class: 'sec', style: 'padding:24px 0 8px' }, h('h2', {}, 'Получено, не передано')),
        h('div', { class: 'group', style: 'margin:0' }, hand.list.map((p) => h('div', { class: 'kv' },
          h('span', {}, dayShort(p.date, today) + (p.kind === 'order' ? ', при заказе' : ', оплата долга')), h('b', { class: 'num' }, rub(p.amount)))))] : null,
      h('div', { class: 'gap' }),
      h('button', { class: 'btn white wide', onclick: () => openShop(shopId) }, 'Открыть точку'));
  };
  draw();
  off = subscribe(draw);
}

// Оплата долга от точки: сумма раскладывается по заказам, старые первыми
export function takePayment(shop, d) {
  const s = sheet({ title: 'Оплата долга', sub: shop.name + ', долг ' + rub(d.owed) });
  const i = inp({ inputmode: 'decimal', value: String(d.owed).replace('.', ','), style: 'font-size:24px', 'aria-label': 'Сумма' });
  const note = inp({ placeholder: 'Например: перевод Сбер', 'aria-label': 'Комментарий' });
  s.body.append(field('Сколько получили', i),
    h('div', { class: 'btns' }, h('button', { class: 'btn white small', onclick: () => { i.value = String(d.owed).replace('.', ','); } }, 'Весь долг'),
      h('button', { class: 'btn white small', onclick: () => { i.value = ''; i.focus(); } }, 'Другая сумма')),
    h('div', { class: 'gap' }), field('Комментарий', note, 'можно пусто'),
    h('p', { class: 'hint' }, 'Оплата гасит самые старые заказы первыми. Оплату на один заказ можно принять в его карточке.'));
  let done = false;
  s.showFoot(h('button', { class: 'btn navy wide', onclick: () => {
    if (done) return;
    const v = parseMoney(i.value);
    const err = Number.isNaN(v) ? 'Сумма: только цифры' : paymentError(v, d.owed);
    if (err) { toast(err, true); return; }
    done = true;
    addPayments(shop, allocate(v, d.orders).parts, note.value.trim());
    toast('Оплата ' + rub(v) + ' записана. Деньги у вас на руках');
    s.close();
  } }, 'Записать оплату'));
}
