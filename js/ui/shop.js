// Карточка точки: связь, визит, долг, следующее действие, цифры, история.
import { S, subscribe, shopById, all, canEdit, memberName } from '../store.js?v=79063987';
import { doneNext, hide } from '../save.js?v=79063987';
import { h, icon, fill, sheet, ext, toast, ask, stat } from './kit.js?v=79063987';
import { planContact, nextText, ageText, whoText } from './common.js?v=79063987';
import { isoDay, dayShort, daysWord, daysBetween } from '../logic/dates.js?v=79063987';
import { rub, prettyPhone, telLink, waLink } from '../logic/format.js?v=79063987';
import { shopDebts, orderSum, returnSum, payLabel, inHand } from '../logic/money.js?v=79063987';
import { activeNext, resultText } from '../logic/visit.js?v=79063987';
import { itemsPacks } from '../logic/products.js?v=79063987';
import { placeLink, dgisLink, googleLink, hasPoint } from '../logic/maps.js?v=79063987';
import { editShop } from './shops.js?v=79063987';
import { startVisit, startOrder } from './visit.js?v=79063987';
import { openOrder, openVisit } from './order.js?v=79063987';
import { startReturn, openReturn } from './returns.js?v=79063987';
import { openShopDebt } from './debts.js?v=79063987';

function history(shopId) {
  const today = isoDay();
  const rows = [];
  for (const v of all('visits')) {
    if (v.shopId !== shopId || v.result === 'order') continue; // визит с заказом покажем строкой заказа
    rows.push({ at: v.at || v.date, date: v.date, text: resultText(v), rep: v.rep, note: v.note, open: () => openVisit(v.id) });
  }
  for (const o of all('orders')) {
    if (o.shopId !== shopId) continue;
    rows.push({ at: o.at || o.date, date: o.date, text: 'Заказ ' + itemsPacks(o.items) + ' уп., ' + rub(orderSum(o)) + ', ' + payLabel(o.payment).toLowerCase(),
      rep: o.rep, note: o.note, red: o.payment === 'debt' || o.payment === 'partial', open: () => openOrder(o.id) });
  }
  for (const r of all('returns')) {
    if (r.shopId !== shopId) continue;
    rows.push({ at: r.at || r.date, date: r.date, text: 'Возврат ' + rub(returnSum(r)), rep: r.rep, note: r.note, open: () => openReturn(r.id) });
  }
  for (const p of all('payments')) {
    if (p.shopId !== shopId || p.kind === 'order') continue;
    rows.push({ at: p.at || p.date, date: p.date, text: 'Оплата долга ' + rub(p.amount) + (p.handedAt ? '' : ', не передана'), rep: p.rep,
      open: p.orderId ? () => openOrder(p.orderId) : null });
  }
  rows.sort((a, b) => (a.at < b.at ? 1 : -1));
  return rows.slice(0, 40).map((r) => h(r.open ? 'button' : 'div', { class: 'item', onclick: r.open },
    h('div', { class: 't' }, h('b', { class: r.red ? 'red' : '' }, r.text),
      h('small', {}, dayShort(r.date, today) + (whoText(r.rep) ? ', ' + whoText(r.rep) : '') + (r.note ? '. ' + r.note : ''))),
    r.open ? h('span', { class: 'chev' }, icon('right')) : null));
}

export function openShop(id) {
  let off = null;
  const s = sheet({ title: 'Точка', full: true, onClose: () => off && off() });
  const draw = () => {
    const shop = shopById(id);
    if (!shop || shop.deleted) { fill(s.body, h('div', { class: 'empty' }, 'Точка не найдена или скрыта')); return; }
    s.setTitle(shop.name, [shop.address, shop.locality].filter(Boolean).join(', '));
    const today = isoDay();
    const mine = (x) => x.shopId === id;
    const orders = all('orders').filter(mine);
    const returns = all('returns').filter(mine);
    const visits = all('visits').filter(mine);
    const debt = shopDebts(orders, returns, all('payments').filter(mine), today).get(id) || { owed: 0, age: 0 };
    const hand = inHand(all('payments'), '', id);
    const next = activeNext(visits);
    const edit = canEdit(shop);
    const lastO = orders.reduce((d, o) => (o.date > d ? o.date : d), '');
    const lastV = visits.filter((v) => v.kind !== 'contact').reduce((d, v) => (v.date > d ? v.date : d), '');
    const sold = orders.reduce((n, o) => n + orderSum(o), 0);
    const back = returns.reduce((n, r) => n + returnSum(r), 0);
    const links = [];
    if (shop.phone) {
      links.push(ext(telLink(shop.phone), 'btn white', icon('phone'), 'Позвонить'));
      links.push(ext(waLink(shop.phone), 'btn white', icon('chat'), 'WhatsApp'));
    }
    const maps = [['Яндекс', placeLink(shop)], ['2ГИС', dgisLink(shop)], ['Google', googleLink(shop)]].filter(([, u]) => u);
    const ago = (d) => (d ? dayShort(d, today) + (d === today ? '' : ', ' + daysWord(daysBetween(d, today)) + ' назад') : 'не было');
    fill(s.body,
      links.length ? h('div', { class: 'btns' }, links) : null,
      maps.length ? h('div', { class: 'btns', style: 'margin-top:8px' }, maps.map(([n, u]) => ext(u, 'btn white small', icon('route'), n))) : null,
      h('div', { class: 'gap' }),
      edit ? h('button', { class: 'btn red wide', onclick: () => startVisit(id) }, 'Начать визит') : h('p', { class: 'warnbox' }, 'Это точка ' + memberName(shop.rep) + '. Вы видите её записи, менять их может сам торговый или владелец.'),
      edit ? h('div', { class: 'btns', style: 'margin-top:8px' },
        h('button', { class: 'btn line', onclick: () => startOrder(id) }, 'Заказ по телефону'),
        h('button', { class: 'btn line', onclick: () => startReturn(id) }, 'Возврат')) : null,
      h('div', { class: 'sec', style: 'padding-left:0;padding-right:0' }, h('h2', {}, 'Следующее действие')),
      h('div', { class: 'group', style: 'margin:0' }, next
        ? h('div', { class: 'item' }, h('div', { class: 't' }, h('b', { class: next.date < today ? 'red' : '' }, nextText(next)),
          next.date < today ? h('small', {}, 'Просрочено на ' + daysWord(daysBetween(next.date, today))) : null),
        edit ? h('button', { class: 'btn line small', onclick: () => { doneNext(next.visitId); toast('Отмечено: выполнено'); } }, 'Выполнено') : null)
        : h(edit ? 'button' : 'div', { class: 'item', onclick: edit ? () => planContact(shop) : null }, h('div', { class: 't' }, h('b', {}, 'Не запланировано'),
          edit ? h('small', {}, 'Нажмите, чтобы запланировать звонок или приезд') : null), edit ? h('span', { class: 'chev' }, icon('right')) : null)),
      h('div', { class: 'sec', style: 'padding-left:0;padding-right:0' }, h('h2', {}, 'Долг')),
      h('button', { class: 'group item', style: 'margin:0', onclick: () => openShopDebt(id) },
        h('div', { class: 't' }, h('b', { class: 'big-sum num' + (debt.owed > 0 ? ' red' : ' ok') }, rub(debt.owed)),
          h('small', {}, debt.owed > 0 ? ageText(debt.age) : 'Долга нет'),
          hand.sum > 0 ? h('small', {}, 'Получено и не передано: ' + rub(hand.sum)) : null),
        h('span', { class: 'chev' }, icon('right'))),
      h('div', { class: 'sec', style: 'padding-left:0;padding-right:0' }, h('h2', {}, 'Цифры')),
      h('div', { class: 'stats', style: 'margin:0' },
        stat(String(orders.length), 'заказов'), stat(rub(sold - back), 'чистая сумма'),
        stat(rub(sold), 'продажи всего'), stat(rub(back), 'возвраты')),
      h('div', { class: 'group', style: 'margin:8px 0 0' },
        h('div', { class: 'kv' }, h('span', {}, 'Последний заказ'), h('b', {}, ago(lastO))),
        h('div', { class: 'kv' }, h('span', {}, 'Последний визит'), h('b', {}, ago(lastV)))),
      h('div', { class: 'sec', style: 'padding-left:0;padding-right:0' }, h('h2', {}, 'О точке')),
      h('div', { class: 'group', style: 'margin:0' },
        shop.contact ? h('div', { class: 'kv' }, h('span', {}, 'ЛПР'), h('b', {}, shop.contact)) : null,
        shop.phone ? h('div', { class: 'kv' }, h('span', {}, 'Телефон'), h('b', { class: 'num' }, prettyPhone(shop.phone))) : null,
        shop.address ? h('div', { class: 'kv' }, h('span', {}, 'Адрес'), h('b', {}, shop.address)) : null,
        shop.district ? h('div', { class: 'kv' }, h('span', {}, 'Район'), h('b', {}, shop.district)) : null,
        h('div', { class: 'kv' }, h('span', {}, 'Место на карте'), h('b', {}, hasPoint(shop) ? 'Отмечено' + (shop.pointSrc ? ', ' + shop.pointSrc : '') : 'Не отмечено')),
        S.lead ? h('div', { class: 'kv' }, h('span', {}, 'Торговый'), h('b', {}, memberName(shop.rep))) : null,
        shop.note ? h('div', { class: 'kv' }, h('span', {}, 'Заметка'), h('b', {}, shop.note)) : null),
      edit ? h('div', { class: 'btns', style: 'margin-top:12px' },
        h('button', { class: 'btn line', onclick: () => editShop(shop) }, icon('edit'), 'Изменить'),
        h('button', { class: 'btn line', onclick: async () => {
          if (await ask('Скрыть точку?', 'Точка пропадёт из списков. Её визиты, заказы и долги останутся в истории и отчётах. Вернуть можно через резервную копию.', 'Скрыть', true)) {
            hide('shops', id); toast('Точка скрыта'); s.close();
          }
        } }, 'Скрыть точку')) : null,
      h('div', { class: 'sec', style: 'padding-left:0;padding-right:0' }, h('h2', {}, 'История')),
      (() => { const hist = history(id); return hist.length ? h('div', { class: 'group', style: 'margin:0' }, hist) : h('div', { class: 'empty', style: 'margin:0' }, 'Визитов и заказов ещё нет'); })());
  };
  draw();
  off = subscribe(draw);
}
