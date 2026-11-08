// Карточка точки: связь, визит, долг, следующее действие, история.
import { S, subscribe, shopById, doneNext, memberName } from '../store.js?v=36adbe7e';
import { h, icon, fill, sheet, ext, toast } from './kit.js?v=36adbe7e';
import { planContact, nextText, ageText } from './common.js?v=36adbe7e';
import { isoDay, dayShort, daysWord, daysBetween } from '../logic/dates.js?v=36adbe7e';
import { rub, prettyPhone, telLink, waLink } from '../logic/format.js?v=36adbe7e';
import { balances } from '../logic/money.js?v=36adbe7e';
import { activeNext, orderPacks, optionLabel, nextById } from '../logic/visit.js?v=36adbe7e';
import { placeLink } from '../logic/maps.js?v=36adbe7e';
import { editShop } from './shops.js?v=36adbe7e';
import { startVisit, startOrder } from './visit.js?v=36adbe7e';
import { takePayment } from './debts.js?v=36adbe7e';

function history(shopId) {
  const today = isoDay();
  const rows = [];
  for (const v of S.visits) {
    if (v.shopId !== shopId || v.deleted) continue;
    let text;
    if (v.kind === 'contact') text = 'Запланировано: ' + (nextById(v.next?.type)?.label || '').toLowerCase();
    else if (v.result === 'order') continue; // заказ покажем строкой заказа
    else text = 'Без заказа' + (v.lpr === false ? ', ЛПР не было' : v.refusal?.reason ? ': ' + optionLabel('reason', v.refusal.reason).toLowerCase() : '');
    rows.push({ at: v.at || v.date, date: v.date, text, rep: v.rep, note: v.note });
  }
  for (const o of S.orders) {
    if (o.shopId !== shopId || o.deleted) continue;
    const pay = { cash: 'наличные', debt: 'в долг', transfer: 'перевод' }[o.payment] || '';
    rows.push({ at: o.at || o.date, date: o.date, text: 'Заказ ' + orderPacks(o.items) + ' уп., ' + rub(o.total) + (pay ? ', ' + pay : ''), rep: o.rep, note: o.note, red: o.payment === 'debt' });
  }
  for (const p of S.payments) {
    if (p.shopId !== shopId || p.deleted || p.kind === 'order') continue;
    rows.push({ at: p.at || p.date, date: p.date, text: 'Оплата долга ' + rub(p.amount), rep: p.rep });
  }
  rows.sort((a, b) => (a.at < b.at ? 1 : -1));
  return rows.slice(0, 15).map((r) => h('div', { class: 'item' },
    h('div', { class: 't' }, h('b', { class: r.red ? 'red' : '' }, r.text),
      h('small', {}, dayShort(r.date, today) + (S.lead && r.rep !== S.email ? ', ' + memberName(r.rep) : '') + (r.note ? '. ' + r.note : '')))));
}

export function openShop(id) {
  let off = null;
  const s = sheet({ title: 'Точка', full: true, onClose: () => off && off() });
  const draw = () => {
    const shop = shopById(id);
    if (!shop) { fill(s.body, h('div', { class: 'empty' }, 'Точка не найдена')); return; }
    s.setTitle(shop.name, [shop.address, shop.locality].filter(Boolean).join(', '));
    const today = isoDay();
    const bal = balances(S.orders, S.payments, today).get(id) || { owed: 0, age: 0 };
    const next = activeNext(S.visits.filter((v) => v.shopId === id));
    const links = [];
    if (shop.phone) {
      links.push(ext(telLink(shop.phone), 'btn white', icon('phone'), 'Позвонить'));
      links.push(ext(waLink(shop.phone), 'btn white', icon('chat'), 'WhatsApp'));
    }
    const map = placeLink(shop);
    if (map) links.push(ext(map, 'btn white', icon('route'), 'Маршрут'));
    const hist = history(id);
    fill(s.body,
      links.length ? h('div', { class: 'btns' }, links) : null,
      h('div', { class: 'gap' }),
      h('button', { class: 'btn red wide', onclick: () => startVisit(id) }, 'Начать визит'),
      h('div', { class: 'sec', style: 'padding-left:0;padding-right:0' }, h('h2', {}, 'Следующее действие')),
      h('div', { class: 'group', style: 'margin:0' }, next
        ? h('div', { class: 'item' }, h('div', { class: 't' }, h('b', { class: next.date < today ? 'red' : '' }, nextText(next)),
          next.date < today ? h('small', {}, 'Просрочено на ' + daysWord(daysBetween(next.date, today))) : null),
        h('button', { class: 'btn line small', onclick: () => { doneNext(next.visitId); toast('Отмечено: выполнено'); } }, 'Выполнено'))
        : h('button', { class: 'item', onclick: () => planContact(shop) }, h('div', { class: 't' }, h('b', {}, 'Не запланировано'), h('small', {}, 'Нажмите, чтобы запланировать звонок или приезд')), h('span', { class: 'chev' }, icon('right')))),
      h('div', { class: 'sec', style: 'padding-left:0;padding-right:0' }, h('h2', {}, 'Долг')),
      h('div', { class: 'group', style: 'margin:0' },
        h('div', { class: 'item' }, h('div', { class: 't' }, h('b', { class: 'big-sum num' + (bal.owed > 0 ? ' red' : '') }, rub(Math.max(0, bal.owed))),
          h('small', {}, bal.owed > 0 ? ageText(bal.age) : 'Долга нет')),
        bal.owed > 0 ? h('button', { class: 'btn navy small', onclick: () => takePayment(shop, bal.owed) }, 'Получить') : null)),
      h('div', { class: 'gap' }),
      h('button', { class: 'btn line wide', onclick: () => startOrder(id) }, 'Заказ по телефону'),
      h('div', { class: 'sec', style: 'padding-left:0;padding-right:0' }, h('h2', {}, 'О точке')),
      h('div', { class: 'group', style: 'margin:0' },
        shop.contact ? h('div', { class: 'kv' }, h('span', {}, 'Контакт'), h('b', {}, shop.contact)) : null,
        shop.phone ? h('div', { class: 'kv' }, h('span', {}, 'Телефон'), h('b', { class: 'num' }, prettyPhone(shop.phone))) : null,
        shop.district ? h('div', { class: 'kv' }, h('span', {}, 'Район'), h('b', {}, shop.district)) : null,
        h('div', { class: 'kv' }, h('span', {}, 'Место на карте'), h('b', {}, Number.isFinite(shop.lat) ? 'Отмечено' : 'Не отмечено')),
        S.lead ? h('div', { class: 'kv' }, h('span', {}, 'Торговый'), h('b', {}, memberName(shop.rep))) : null,
        shop.note ? h('div', { class: 'kv' }, h('span', {}, 'Заметка'), h('b', {}, shop.note)) : null),
      h('div', { class: 'gap' }),
      h('button', { class: 'btn line wide', onclick: () => editShop(shop) }, icon('edit'), 'Изменить точку'),
      h('div', { class: 'sec', style: 'padding-left:0;padding-right:0' }, h('h2', {}, 'История')),
      hist.length ? h('div', { class: 'group', style: 'margin:0' }, hist) : h('div', { class: 'empty', style: 'margin:0' }, 'Визитов и заказов ещё нет'));
  };
  draw();
  off = subscribe(draw);
}
