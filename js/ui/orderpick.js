// Выбор товаров в заказ: категории, поиск, упаковки и штуки.
// Касание названия добавляет упаковку. Число и штуки вводятся в окне товара.
import { S, all } from '../store.js?v=79063987';
import { h, icon, fill, sheet, toast, inp, field, seg } from './kit.js?v=79063987';
import { rub, parseCount, norm } from '../logic/format.js?v=79063987';
import { activeProducts, GROUPS, groupOf, LINES, catLabel, catOf, measure, sellsUnits, unitPriceOf, itemsFromPick, itemsSum } from '../logic/products.js?v=79063987';
import { editProduct } from './catalog.js?v=79063987';

export const products = () => activeProducts(all('products'));

const meta = (p) => [measure(p), p.perPack > 1 ? p.perPack + ' шт. в уп.' : '', p.packPrice ? rub(p.packPrice) + ' за уп.' : 'цена не задана',
  sellsUnits(p) ? rub(unitPriceOf(p)) + ' за шт.' : ''].filter(Boolean).join(', ');

// pick: { productId: { packs, units } }. Возвращает итог для подвала листа.
export function productPicker(body, pick, onChange) {
  let group = '';
  let q = '';
  const listBox = h('div');
  const tabsBox = h('div');
  const draw = () => {
    const ps = products();
    if (!ps.length) {
      fill(listBox, h('div', { class: 'empty', style: 'margin:0' }, h('b', {}, 'Каталог пуст'), S.owner ? 'Добавьте товары: Ещё, Каталог.' : 'Товары добавляет владелец.'));
      return;
    }
    const groups = GROUPS.filter((g) => ps.some((p) => groupOf(p) === g.id));
    if (!group || !groups.some((g) => g.id === group)) group = groups[0].id;
    const chosen = (gid) => ps.filter((p) => groupOf(p) === gid && pick[p.id] && (pick[p.id].packs || pick[p.id].units)).length;
    fill(tabsBox, groups.length > 1 ? seg(groups.map((g) => [g.id, g.label + (chosen(g.id) ? ' · ' + chosen(g.id) : '')]), group, (v) => { group = v; draw(); }) : null);
    const words = norm(q).split(' ').filter(Boolean);
    const shown = ps.filter((p) => (words.length ? words.every((w) => norm(p.name + ' ' + (p.sku || '')).includes(w)) : groupOf(p) === group));
    const heads = new Map();
    for (const p of shown) {
      const key = groupOf(p) === 'drinks' ? (LINES.includes(p.line) ? p.line : 'Другие напитки') : catLabel(catOf(p));
      if (!heads.has(key)) heads.set(key, []);
      heads.get(key).push(p);
    }
    fill(listBox, shown.length ? [...heads].map(([title, list]) => [h('div', { class: 'line-h' }, title), h('div', { class: 'prods' }, list.map(row))])
      : h('div', { class: 'empty', style: 'margin:0' }, 'Такого товара нет'));
  };
  const row = (p) => {
    const q0 = () => pick[p.id] || { packs: 0, units: 0 };
    const cnt = h('button', { class: 'cnt num', 'aria-label': 'Ввести количество ' + p.name });
    const el = h('div', { class: 'prod' });
    const paint = () => {
      const x = q0();
      const on = x.packs > 0 || x.units > 0;
      fill(cnt, h('span', {}, String(x.packs || 0)), x.units ? h('small', {}, x.units + ' шт.') : null);
      cnt.classList.toggle('wide', !!x.units);
      el.classList.toggle('on', on);
    };
    const set = (packs, units) => {
      pick[p.id] = { packs: Math.max(0, packs), units: Math.max(0, units) };
      paint();
      cnt.classList.remove('pop'); void cnt.offsetWidth; cnt.classList.add('pop');
      onChange();
    };
    cnt.onclick = () => askQty(p, q0(), set);
    fill(el,
      h('button', { class: 'add', onclick: () => set(q0().packs + 1, q0().units), 'aria-label': 'Добавить упаковку ' + p.name },
        h('b', {}, p.name), h('small', { class: 'num' }, meta(p))),
      h('button', { class: 'minus', 'aria-label': 'Убрать', onclick: () => { const x = q0(); if (x.packs > 0) set(x.packs - 1, x.units); else set(0, x.units - 1); } }, icon('minus')),
      cnt);
    paint();
    return el;
  };
  fill(body,
    h('p', { class: 'hint', style: 'margin:0 0 8px' }, 'Касание названия добавляет упаковку. Касание числа: ввести упаковки' + (products().some(sellsUnits) ? ' и штуки' : '') + '.'),
    tabsBox,
    products().length > 12 ? h('div', { class: 'search', style: 'margin:8px 0 0' }, icon('search'),
      inp({ type: 'search', placeholder: 'Найти товар', 'aria-label': 'Найти товар', oninput: (e) => { q = e.target.value; draw(); } })) : null,
    listBox,
    S.owner ? h('button', { class: 'btn line wide', style: 'margin-top:16px', onclick: () => editProduct({ cat: group || 'drinks', active: true, sort: (products().length + 1) * 10 }, (id) => {
      setTimeout(() => { pick[id] = { packs: 1, units: 0 }; draw(); onChange(); }, 400);
    }) }, 'Новый товар') : null);
  draw();
  return { redraw: draw };
}

export const pickItems = (pick) => itemsFromPick(pick, products());
export const pickTotal = (pick) => itemsSum(pickItems(pick));

// Количество товара: упаковки и, если можно, штуки
function askQty(p, value, set) {
  const s = sheet({ title: p.name, sub: meta(p) });
  const pi = inp({ type: 'text', inputmode: 'numeric', value: value.packs || '', placeholder: '0', style: 'font-size:28px;text-align:center', 'aria-label': 'Упаковки' });
  const ui = sellsUnits(p) ? inp({ type: 'text', inputmode: 'numeric', value: value.units || '', placeholder: '0', style: 'font-size:28px;text-align:center', 'aria-label': 'Штуки' }) : null;
  const ok = () => {
    const a = parseCount(pi.value);
    const b = ui ? parseCount(ui.value) : 0;
    if (Number.isNaN(a) || Number.isNaN(b)) { toast('Только целые числа', true); return; }
    set(a, b);
    s.close();
  };
  for (const i of [pi, ui]) if (i) i.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
  s.body.append(field('Упаковки', pi), ui ? field('Отдельные штуки', ui, 'кроме целых упаковок') : h('p', { class: 'hint' }, 'Этот товар продаётся только упаковками.'));
  s.showFoot(h('button', { class: 'btn navy wide', onclick: ok }, 'Готово'));
  setTimeout(() => pi.focus(), 250);
}
