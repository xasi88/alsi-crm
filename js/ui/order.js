// Карточка заказа и карточка визита: смотреть, принять оплату, изменить, удалить.
import { S, subscribe, all, orderById, shopById, canEdit, memberName } from '../store.js?v=564a57de';
import { updateOrder, cashHanded, hideOrder, hide, addPayments, updateVisit } from '../save.js?v=564a57de';
import { h, icon, fill, sheet, toast, ask, field, inp, choices } from './kit.js?v=564a57de';
import { nextPicker, nextText } from './common.js?v=564a57de';
import { isoDay, dayShort } from '../logic/dates.js?v=564a57de';
import { rub, parseMoney, prettyPhone } from '../logic/format.js?v=564a57de';
import { indexMoney, orderSum, orderNet, orderDebt, paidAtOrder, payLabel, paymentError } from '../logic/money.js?v=564a57de';
import { CATS, catOf, catLabel, qtyText, itemSum, itemOf, itemsPacks, itemsUnits, unitPriceOf } from '../logic/products.js?v=564a57de';
import { editBlockedBy, deleteBlocked } from '../logic/returns.js?v=564a57de';
import { firstOrders, orderType } from '../logic/stats.js?v=564a57de';
import { REFUSAL, resultText } from '../logic/visit.js?v=564a57de';
import { productPicker, products } from './orderpick.js?v=564a57de';
import { payBlock, payError } from './steps.js?v=564a57de';
import { startReturn, openReturn } from './returns.js?v=564a57de';
import { openShop } from './shop.js?v=564a57de';

const kv = (k, v, cls = '') => h('div', { class: 'kv' }, h('span', {}, k), h('b', { class: cls }, v));
const sub = (t) => h('div', { class: 'sec', style: 'padding-left:0;padding-right:0' }, h('h2', {}, t));

export function openOrder(id) {
  let off = null;
  const s = sheet({ title: 'Заказ', full: true, onClose: () => off && off() });
  const draw = () => {
    const o = orderById(id);
    if (!o || o.deleted) { fill(s.body, h('div', { class: 'empty' }, 'Заказ не найден или удалён')); return; }
    const today = isoDay();
    const shop = shopById(o.shopId);
    const idx = indexMoney(all('returns'), all('payments'));
    const debt = orderDebt(o, idx);
    const back = idx.ret.get(o.id) || 0;
    const pays = all('payments').filter((p) => p.orderId === o.id).sort((a, b) => (a.at < b.at ? -1 : 1));
    const rets = all('returns').filter((r) => r.orderId === o.id);
    const got = paidAtOrder(o, idx) + (idx.pay.get(o.id) || 0);
    const edit = canEdit(o);
    s.setTitle('Заказ ' + dayShort(o.date, today).toLowerCase(), (shop?.name || o.shopName) + ', ' + orderType(o, firstOrders(all('orders'))).toLowerCase());
    const byCat = CATS.map((c) => [c.id, o.items.filter((i) => catOf(i) === c.id)]).filter(([, l]) => l.length);
    fill(s.body,
      h('div', { class: 'group', style: 'margin:0' },
        kv('Точка', shop?.name || o.shopName || 'Точка'),
        (shop?.contact || o.shop?.contact) ? kv('ЛПР', shop?.contact || o.shop.contact) : null,
        (shop?.phone || o.shop?.phone) ? kv('Телефон', prettyPhone(shop?.phone || o.shop.phone), 'num') : null,
        (shop?.address || o.shop?.address) ? kv('Адрес', shop?.address || o.shop.address) : null,
        kv('Оплата', payLabel(o.payment) + (o.payment === 'partial' ? ', сразу ' + rub(o.paidNow) : '')),
        S.lead ? kv('Торговый', memberName(o.rep)) : null,
        o.note ? kv('Комментарий', o.note) : null),
      byCat.map(([cat, list]) => [sub(catLabel(cat)), h('div', { class: 'group', style: 'margin:0' }, list.map((i) => h('div', { class: 'item' },
        h('div', { class: 't' }, h('b', {}, i.name), h('small', { class: 'num' }, qtyText(i.packs, i.units) + ', ' + rub(i.packPrice) + ' за уп.' + (i.units ? ', ' + rub(unitPriceOf(i)) + ' за шт.' : ''))),
        h('span', { class: 'r num' }, rub(itemSum(i))))))]),
      sub('Деньги'),
      h('div', { class: 'group', style: 'margin:0' },
        kv('Сумма заказа', rub(orderSum(o)), 'num'),
        back ? kv('Возвраты', rub(back), 'num') : null,
        back ? kv('После возвратов', rub(orderNet(o, idx)), 'num') : null,
        kv('Получено', rub(got), 'num'),
        kv('Остаток долга', rub(debt), 'num ' + (debt > 0 ? 'red' : 'ok'))),
      pays.length ? [sub('Оплаты'), h('div', { class: 'group', style: 'margin:0' }, pays.map((p) => h('div', { class: 'item' },
        h('div', { class: 't' }, h('b', { class: 'num' }, rub(p.amount) + (p.kind === 'order' ? ', при заказе' : '')),
          h('small', {}, dayShort(p.date, today) + ', ' + (p.handedAt ? 'деньги переданы ' + dayShort(p.handedDate || p.handedAt.slice(0, 10), today).toLowerCase() : 'ожидает передачи'))),
        edit && !p.handedAt && p.kind !== 'order' ? h('button', { class: 'btn line small', onclick: async () => {
          if (await ask('Удалить оплату?', rub(p.amount) + ' от ' + dayShort(p.date, today).toLowerCase() + '. Долг вырастет на эту сумму.', 'Удалить', true)) { hide('payments', p.id); toast('Оплата удалена'); }
        } }, 'Удалить') : null)))] : null,
      rets.length ? [sub('Возвраты'), h('div', { class: 'group', style: 'margin:0' }, rets.map((r) => h('button', { class: 'item', onclick: () => openReturn(r.id) },
        h('div', { class: 't' }, h('b', {}, rub(r.total)), h('small', {}, dayShort(r.date, today) + ', ' + r.items.map((i) => i.name + ' ' + qtyText(i.packs, i.units)).join(', '))),
        h('span', { class: 'chev' }, icon('right')))))] : null,
      h('div', { class: 'gap' }),
      edit && debt > 0 ? h('button', { class: 'btn navy wide', onclick: () => takeOrderPayment(o, debt) }, 'Принять оплату') : null,
      edit ? h('div', { class: 'btns', style: 'margin-top:8px' },
        h('button', { class: 'btn line', onclick: () => editOrder(o) }, icon('edit'), 'Изменить'),
        h('button', { class: 'btn line', onclick: () => startReturn(o.shopId, o.id) }, 'Возврат')) : null,
      h('div', { class: 'btns', style: 'margin-top:8px' },
        h('button', { class: 'btn white', onclick: () => openShop(o.shopId) }, 'Точка'),
        edit ? h('button', { class: 'btn white', onclick: async () => {
          if (deleteBlocked(o.id, all('returns'))) { toast('По заказу есть возврат. Сначала удалите возврат', true); return; }
          if (await ask('Удалить заказ?', 'Заказ пропадёт из списков и отчётов. Оплаты долга по нему останутся в истории.', 'Удалить', true)) { hideOrder(o); toast('Заказ удалён'); s.close(); }
        } }, 'Удалить заказ') : null));
  };
  draw();
  off = subscribe(draw);
}

export function takeOrderPayment(o, debt) {
  const shop = shopById(o.shopId) || { id: o.shopId, name: o.shopName };
  const s = sheet({ title: 'Оплата по заказу', sub: shop.name + ', долг ' + rub(debt) });
  const i = inp({ inputmode: 'decimal', value: String(debt).replace('.', ','), style: 'font-size:24px', 'aria-label': 'Сумма' });
  s.body.append(field('Сколько получили', i));
  let done = false;
  s.showFoot(h('button', { class: 'btn navy wide', onclick: () => {
    if (done) return;
    const v = parseMoney(i.value);
    const err = Number.isNaN(v) ? 'Сумма: только цифры' : paymentError(v, debt);
    if (err) { toast(err, true); return; }
    done = true;
    addPayments(shop, [{ orderId: o.id, amount: v }]);
    toast('Оплата ' + rub(v) + ' записана. Деньги у вас на руках');
    s.close();
  } }, 'Записать оплату'));
}

// Изменить заказ: состав, оплата, дата, комментарий. Старые строки сохраняют цену на момент продажи.
function editOrder(o) {
  const pick = {};
  for (const i of o.items) pick[i.productId] = { packs: i.packs || 0, units: i.units || 0 };
  const known = new Set(products().map((p) => p.id));
  const fixed = o.items.filter((i) => !known.has(i.productId));
  const d = { payment: o.payment, paidNow: o.paidNow || '', note: o.note || '', date: o.date };
  const locked = cashHanded(o);
  const s = sheet({ title: 'Изменить заказ', sub: o.shopName, full: true });
  const items = () => [...fixed, ...products().filter((p) => pick[p.id] && (pick[p.id].packs || pick[p.id].units)).map((p) => {
    const old = o.items.find((i) => i.productId === p.id);
    return old ? { ...old, packs: pick[p.id].packs, units: old.unitPrice ? pick[p.id].units : 0 } : itemOf(p, pick[p.id].packs, pick[p.id].units);
  })];
  const total = () => items().reduce((n, i) => n + itemSum(i), 0);
  const sumEl = h('div', { class: 'sum num' });
  const paint = () => fill(sumEl, h('span', {}, qtyText(itemsPacks(items()), itemsUnits(items()))), h('span', {}, rub(total())));
  const box = h('div');
  const payBox = h('div');
  fill(s.body, fixed.length ? h('div', { class: 'warnbox' }, 'Товары, скрытые в каталоге, остаются в заказе как были: ' + fixed.map((i) => i.name).join(', ')) : null,
    box, h('div', { class: 'q' }, 'Оплата'), payBox,
    field('Дата', inp({ type: 'date', value: d.date, max: isoDay(), onchange: (e) => { d.date = e.target.value || o.date; } })),
    field('Комментарий', h('textarea', { class: 'inp', oninput: (e) => { d.note = e.target.value; } }, d.note)));
  productPicker(box, pick, paint);
  fill(payBox, locked ? h('p', { class: 'warnbox' }, payLabel(o.payment) + '. Деньги по заказу уже переданы, оплату не изменить.') : payBlock(d, total()));
  paint();
  s.showFoot(sumEl, h('button', { class: 'btn red wide', onclick: () => {
    const list = items();
    if (!list.length) { toast('В заказе нет товаров. Чтобы убрать заказ, удалите его', true); return; }
    const bad = editBlockedBy(o.id, list, all('returns'));
    if (bad.length) { toast('По заказу уже вернули больше, чем останется: ' + o.items.filter((i) => bad.includes(i.productId)).map((i) => i.name).join(', '), true); return; }
    const t = Math.round(total() * 100) / 100;
    if (!locked) { const e = payError(d, t); if (e) { toast(e, true); return; } }
    updateOrder(o, { items: list, total: t, payment: d.payment, paidNow: parseMoney(d.paidNow) || 0, note: d.note, date: d.date });
    toast('Заказ изменён');
    s.close();
  } }, 'Сохранить'));
}

export function openVisit(id) {
  let off = null;
  const s = sheet({ title: 'Визит', full: true, onClose: () => off && off() });
  const draw = () => {
    const v = all('visits').find((x) => x.id === id);
    if (!v) { fill(s.body, h('div', { class: 'empty' }, 'Визит не найден или удалён')); return; }
    const today = isoDay();
    const edit = canEdit(v);
    s.setTitle(v.kind === 'contact' ? 'Запланированное действие' : 'Визит ' + dayShort(v.date, today).toLowerCase(), shopById(v.shopId)?.name || v.shopName);
    fill(s.body,
      h('div', { class: 'group', style: 'margin:0' },
        kv('Итог', resultText(v)),
        v.result === 'none' && v.kind !== 'contact' ? kv('ЛПР на месте', v.lpr === true ? 'Да' : v.lpr === false ? 'Нет' : 'Не указано') : null,
        v.next ? kv('Следующее действие', v.next.type === 'none' ? 'Ничего не нужно' : nextText(v.next) + (v.next.doneAt ? ', выполнено' : '')) : null,
        v.geo ? kv('Место визита', v.geo.src + (v.geo.acc ? ', ' + v.geo.acc + ' м' : '')) : null,
        S.lead ? kv('Торговый', memberName(v.rep)) : null,
        v.note ? kv('Заметка', v.note) : null),
      v.refusal ? [sub('Ответы ЛПР'), h('div', { class: 'group', style: 'margin:0' }, REFUSAL.map((q) => {
        const a = v.refusal[q.id];
        const t = Array.isArray(a) ? a.join(', ') : a;
        return t ? kv(q.title, q.id === 'reason' && v.refusal.other ? t + ': ' + v.refusal.other : t) : null;
      }))] : null,
      h('div', { class: 'gap' }),
      v.orderId ? h('button', { class: 'btn navy wide', onclick: () => openOrder(v.orderId) }, 'Открыть заказ') : null,
      h('div', { class: 'btns', style: 'margin-top:8px' },
        h('button', { class: 'btn white', onclick: () => openShop(v.shopId) }, 'Точка'),
        edit ? h('button', { class: 'btn line', onclick: () => editVisit(v) }, icon('edit'), 'Изменить') : null,
        edit ? h('button', { class: 'btn white', onclick: async () => {
          if (await ask('Удалить визит?', v.orderId ? 'Заказ этого визита останется. Удалить его можно в карточке заказа.' : 'Визит пропадёт из списков и отчётов.', 'Удалить', true)) { hide('visits', v.id); toast('Визит удалён'); s.close(); }
        } }, 'Удалить') : null));
  };
  draw();
  off = subscribe(draw);
}

function editVisit(v) {
  const d = { date: v.date, note: v.note || '', next: { type: v.next?.type || 'none', date: v.next?.date || '' }, refusal: { ...(v.refusal || {}) } };
  const s = sheet({ title: 'Изменить визит', sub: v.shopName, full: true });
  s.body.append(
    field('Дата', inp({ type: 'date', value: d.date, max: isoDay(), onchange: (e) => { d.date = e.target.value || v.date; } })),
    v.refusal ? REFUSAL.map((q) => [h('div', { class: 'q' }, q.title), choices(q.options.map((o) => [o, o]), d.refusal[q.id], (x) => { d.refusal[q.id] = x; }, { multi: q.multi })]) : null,
    h('div', { class: 'q' }, 'Следующее действие'), nextPicker(d.next, () => {}, shopById(v.shopId)),
    h('div', { style: 'margin-top:16px' }, field('Заметка', h('textarea', { class: 'inp', oninput: (e) => { d.note = e.target.value; } }, d.note))));
  s.showFoot(h('button', { class: 'btn navy wide', onclick: () => {
    if (d.next.type !== 'none' && !d.next.date) { toast('Выберите дату следующего действия', true); return; }
    updateVisit(v.id, { date: d.date, note: d.note, next: { type: d.next.type, date: d.next.type === 'none' ? null : d.next.date, doneAt: v.next?.doneAt || null },
      refusal: v.refusal ? d.refusal : undefined });
    toast('Визит изменён');
    s.close();
  } }, 'Сохранить'));
}
