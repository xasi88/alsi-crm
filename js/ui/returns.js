// Возврат: точка, заказ, что возвращают (упаковки и штуки), не больше проданного.
import { S, subscribe, all, shopById, orderById, canEdit, memberName } from '../store.js?v=2f681d03';
import { saveReturn, hide } from '../save.js?v=2f681d03';
import { h, icon, fill, sheet, toast, ask, field, inp } from './kit.js?v=2f681d03';
import { isoDay, dayShort } from '../logic/dates.js?v=2f681d03';
import { rub, parseCount } from '../logic/format.js?v=2f681d03';
import { orderSum } from '../logic/money.js?v=2f681d03';
import { qtyText, itemsPacks, itemsUnits, itemSum } from '../logic/products.js?v=2f681d03';
import { available, returnItems, returnErrors, returnTotal } from '../logic/returns.js?v=2f681d03';
import { shopStep } from './steps.js?v=2f681d03';

const kv = (k, v) => h('div', { class: 'kv' }, h('span', {}, k), h('b', {}, v));

export function startReturn(shopId = '', orderId = '') {
  const today = isoDay();
  const d = { shopId, orderId, pick: {}, note: '', date: today };
  const s = sheet({ title: 'Возврат', full: true });
  let saving = false;

  const draw = () => {
    const shop = shopById(d.shopId);
    s.setTitle(!d.shopId ? 'Возврат: какая точка' : !d.orderId ? 'Возврат: по какому заказу' : 'Что возвращают', shop?.name || '');
    s.hideFoot();
    if (!d.shopId) { shopStep(s.body, (id) => { d.shopId = id; draw(); }); return; }
    if (!d.orderId) { stepOrder(); return; }
    stepItems();
  };

  function stepOrder() {
    const rets = all('returns');
    const list = all('orders').filter((o) => o.shopId === d.shopId && canEdit(o))
      .filter((o) => o.items.some((i) => available(o, i.productId, rets).units > 0))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    fill(s.body, list.length ? [h('p', { class: 'hint', style: 'margin:0 0 12px' }, 'Возврат идёт по заказу: так сумма и долг пересчитаются верно.'),
      h('div', { class: 'group', style: 'margin:0' }, list.slice(0, 50).map((o) => h('button', { class: 'item', onclick: () => { d.orderId = o.id; draw(); } },
        h('div', { class: 't' }, h('b', {}, 'Заказ ' + dayShort(o.date, today).toLowerCase() + ', ' + rub(orderSum(o))),
          h('small', {}, o.items.map((i) => i.name + ' ' + qtyText(i.packs, i.units)).join(', '))), h('span', { class: 'chev' }, icon('right')))))]
      : h('div', { class: 'empty', style: 'margin:0' }, h('b', {}, 'Нечего возвращать'), 'У этой точки нет заказов, по которым можно вернуть товар.'));
  }

  function stepItems() {
    const o = orderById(d.orderId);
    if (!o) { d.orderId = ''; draw(); return; }
    const rets = all('returns');
    const sumEl = h('div', { class: 'sum num' });
    const paint = () => {
      const items = returnItems(o, d.pick);
      fill(sumEl, h('span', {}, qtyText(itemsPacks(items), itemsUnits(items))), h('span', {}, rub(returnTotal(items))));
    };
    const num = (pid, key, label) => inp({ type: 'text', inputmode: 'numeric', placeholder: '0', value: d.pick[pid]?.[key] || '', 'aria-label': label,
      style: 'max-width:88px;text-align:center', oninput: (e) => { d.pick[pid] = { ...(d.pick[pid] || {}), [key]: parseCount(e.target.value) || 0 }; paint(); } });
    fill(s.body,
      h('p', { class: 'hint', style: 'margin:0 0 12px' }, 'Заказ ' + dayShort(o.date, today).toLowerCase() + '. Цена берётся из заказа. Целые упаковки и отдельные штуки можно вместе.'),
      h('div', { class: 'group', style: 'margin:0' }, o.items.map((i) => {
        const a = available(o, i.productId, rets);
        return h('div', { class: 'item ret' }, h('div', { class: 't' }, h('b', {}, i.name),
          h('small', {}, 'Продано ' + qtyText(i.packs, i.units) + ', можно вернуть ' + (a.units ? a.text : 'ничего'))),
        a.units ? h('div', { class: 'ret-in' }, field('уп.', num(i.productId, 'packs', 'Упаковки ' + i.name)), field('шт.', num(i.productId, 'units', 'Штуки ' + i.name))) : null);
      })),
      h('div', { class: 'gap' }),
      field('Дата', inp({ type: 'date', value: d.date, max: today, onchange: (e) => { d.date = e.target.value || today; } })),
      field('Причина или комментарий', h('textarea', { class: 'inp', placeholder: 'Например: просрочка, мятая упаковка', oninput: (e) => { d.note = e.target.value; } }, d.note)));
    paint();
    s.showFoot(sumEl, h('button', { class: 'btn red wide', onclick: () => {
      if (saving) return;
      const items = returnItems(o, d.pick);
      const errs = returnErrors(o, items, all('returns'));
      if (errs.length) { toast(errs[0], true); return; }
      saving = true;
      const shop = shopById(d.shopId);
      saveReturn({ shopId: d.shopId, shopName: shop?.name || o.shopName, orderId: o.id, date: d.date, items, total: returnTotal(items), note: d.note.trim() });
      toast('Возврат ' + rub(returnTotal(items)) + ' записан. Сумма заказа и долг пересчитаны');
      s.close();
    } }, 'Сохранить возврат'));
  }

  draw();
}

export function openReturn(id) {
  let off = null;
  const s = sheet({ title: 'Возврат', full: true, onClose: () => off && off() });
  const draw = () => {
    const r = all('returns').find((x) => x.id === id);
    if (!r) { fill(s.body, h('div', { class: 'empty' }, 'Возврат не найден или удалён')); return; }
    const today = isoDay();
    const o = orderById(r.orderId);
    s.setTitle('Возврат ' + dayShort(r.date, today).toLowerCase(), shopById(r.shopId)?.name || r.shopName);
    fill(s.body,
      h('div', { class: 'group', style: 'margin:0' },
        r.items.map((i) => h('div', { class: 'item' }, h('div', { class: 't' }, h('b', {}, i.name), h('small', {}, qtyText(i.packs, i.units))), h('span', { class: 'r num' }, rub(itemSum(i))))),
        kv('Сумма возврата', rub(r.total)),
        o ? kv('По заказу', dayShort(o.date, today) + ', ' + rub(orderSum(o))) : null,
        S.lead ? kv('Торговый', memberName(r.rep)) : null,
        r.note ? kv('Комментарий', r.note) : null),
      h('div', { class: 'gap' }),
      canEdit(r) ? h('button', { class: 'btn line wide', onclick: async () => {
        if (await ask('Удалить возврат?', 'Сумма заказа и долг вернутся к прежним.', 'Удалить', true)) { hide('returns', r.id); toast('Возврат удалён'); s.close(); }
      } }, 'Удалить возврат') : null);
  };
  draw();
  off = subscribe(draw);
}
