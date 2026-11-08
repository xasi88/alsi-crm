// Долги: кто должен, деньги на руках, «Деньги переданы».
import { S, addPayment, handOver } from '../store.js?v=5db8579d';
import { h, icon, fill, sheet, toast, ask, field, inp } from './kit.js?v=5db8579d';
import { head, ageText } from './common.js?v=5db8579d';
import { isoDay, plural } from '../logic/dates.js?v=5db8579d';
import { rub, parseMoney } from '../logic/format.js?v=5db8579d';
import { balances, inHand, paymentError } from '../logic/money.js?v=5db8579d';
import { openShop } from './shop.js?v=5db8579d';

export function mountDebts(root) {
  const update = () => {
    const today = isoDay();
    const bal = balances(S.orders, S.payments, today);
    const rows = S.shops.filter((s) => !s.deleted && (bal.get(s.id)?.owed || 0) > 0)
      .map((s) => ({ shop: s, ...bal.get(s.id) }))
      .sort((a, b) => b.age - a.age || b.owed - a.owed);
    const total = rows.reduce((n, r) => n + r.owed, 0);
    const hand = inHand(S.payments, S.email);
    fill(root,
      head('Долги', rows.length ? rows.length + ' ' + plural(rows.length, ['точка должна', 'точки должны', 'точек должны']) + ' ' + rub(total) : 'Долгов нет'),
      h('section', { class: 'hand' },
        h('div', { class: 'row1' }, h('span', {}, 'У вас на руках'), h('b', { class: 'big-sum num' }, rub(hand.sum))),
        h('small', {}, hand.list.length ? hand.list.length + ' ' + plural(hand.list.length, ['оплата ещё не передана', 'оплаты ещё не переданы', 'оплат ещё не переданы']) : 'Все деньги переданы'),
        hand.sum > 0 ? h('button', { class: 'btn red wide', onclick: async () => {
          const ok = await ask('Деньги переданы?', 'Отметить, что ' + rub(hand.sum) + ' переданы руководству. Оплаты останутся в истории.', 'Да, переданы');
          if (ok) { handOver(hand.list); toast('Отмечено: ' + rub(hand.sum) + ' переданы'); }
        } }, 'Деньги переданы') : null),
      rows.length ? h('div', { class: 'sec' }, h('h2', {}, 'Кто должен'), h('span', { class: 'muted', style: 'font-size:14px' }, 'старые выше')) : null,
      rows.length ? h('div', { class: 'group' }, rows.map((r) => h('div', { class: 'item' },
        h('button', { class: 't', style: 'text-align:left;min-height:48px', onclick: () => openShop(r.shop.id) },
          h('b', {}, r.shop.name), h('small', { class: r.age >= 14 ? 'red' : '' }, ageText(r.age))),
        h('span', { class: 'r red num' }, rub(r.owed)),
        h('button', { class: 'ib navy', 'aria-label': 'Получить оплату', onclick: () => takePayment(r.shop, r.owed) }, icon('cash'))))) : null,
      !rows.length && S.loaded.orders ? h('div', { class: 'empty' }, h('b', {}, 'Никто не должен'), 'Заказы в долг появятся здесь.') : null,
      h('div', { class: 'gap' }));
  };
  update();
  return update;
}

// Оплата долга от точки
export function takePayment(shop, owed) {
  const s = sheet({ title: 'Оплата долга', sub: shop.name + ', долг ' + rub(owed) });
  const i = inp({ inputmode: 'decimal', value: String(owed).replace('.', ','), style: 'font-size:24px' });
  s.body.append(field('Сколько получили', i),
    h('div', { class: 'btns' }, h('button', { class: 'btn white small', onclick: () => { i.value = String(owed).replace('.', ','); } }, 'Весь долг'),
      h('button', { class: 'btn white small', onclick: () => { i.value = ''; i.focus(); } }, 'Другая сумма')));
  let done = false;
  s.showFoot(h('button', { class: 'btn navy wide', onclick: () => {
    if (done) return;
    const v = parseMoney(i.value);
    const err = Number.isNaN(v) ? 'Сумма: только цифры' : paymentError(v, owed);
    if (err) { toast(err, true); return; }
    done = true;
    addPayment(shop, v);
    toast('Оплата ' + rub(v) + ' записана. Деньги у вас на руках');
    s.close();
  } }, 'Записать оплату'));
}
