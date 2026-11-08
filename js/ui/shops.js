// Точки: список с поиском и форма точки.
import { S, saveShop } from '../store.js?v=282e3437';
import { h, icon, fill, sheet, field, inp, toast } from './kit.js?v=282e3437';
import { head } from './common.js?v=282e3437';
import { isoDay, daysBetween, daysWord, plural } from '../logic/dates.js?v=282e3437';
import { rub, shopMatches, similarShops, normPhone, prettyPhone } from '../logic/format.js?v=282e3437';
import { balances } from '../logic/money.js?v=282e3437';
import { openShop } from './shop.js?v=282e3437';

const view = { q: '', who: '', place: '' };

export function mountShops(root) {
  if (!view.who) view.who = S.lead ? 'all' : 'mine';
  const list = h('div');
  const chips = h('div', { class: 'chips' });
  const search = inp({ type: 'search', placeholder: 'Например: Аймани, Кадырова', value: view.q, 'aria-label': 'Поиск точки',
    oninput: (e) => { view.q = e.target.value; update(); } });
  const count = h('div', { class: 'date' });
  root.append(
    h('header', { class: 'top' }, h('div', { class: 'bar' },
      h('div', {}, h('h1', { class: 'title' }, 'Точки'), count),
      h('button', { class: 'btn navy small', onclick: () => editShop() }, 'Новая точка'))),
    h('div', { class: 'search' }, icon('search'), search),
    chips, list);

  function chip(label, on, fn) {
    return h('button', { class: 'choice' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: fn }, label);
  }

  function update() {
    const today = isoDay();
    const bal = balances(S.orders, S.payments, today);
    const lastOrder = new Map();
    for (const o of S.orders) if (!o.deleted && (lastOrder.get(o.shopId) || '') < o.date) lastOrder.set(o.shopId, o.date);
    const places = [...new Set(S.shops.filter((s) => !s.deleted && s.locality).map((s) => s.locality))].sort((a, b) => a.localeCompare(b, 'ru'));
    fill(chips,
      chip('Мои', view.who === 'mine', () => { view.who = 'mine'; update(); }),
      chip('Все', view.who === 'all', () => { view.who = 'all'; update(); }),
      places.length > 1 ? places.map((p) => chip(p, view.place === p, () => { view.place = view.place === p ? '' : p; update(); })) : null);
    const shops = S.shops.filter((s) => !s.deleted && (view.who === 'all' || s.rep === S.email)
      && (!view.place || s.locality === view.place) && shopMatches(s, view.q))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    count.textContent = shops.length + ' ' + plural(shops.length, ['точка', 'точки', 'точек']);
    if (!S.loaded.shops) { fill(list, h('div', { class: 'empty' }, 'Загружаю точки')); return; }
    if (!shops.length) {
      fill(list, h('div', { class: 'empty' }, h('b', {}, view.q ? 'Ничего не нашлось' : 'Точек пока нет'),
        view.q ? 'Проверьте название или добавьте новую точку.' : 'Добавьте первую точку.',
        h('div', {}, h('button', { class: 'btn red', onclick: () => editShop({ name: view.q }) }, 'Новая точка'))));
      return;
    }
    fill(list, h('div', { class: 'group' }, shops.map((s) => {
      const owed = bal.get(s.id)?.owed || 0;
      const lo = lastOrder.get(s.id);
      const sub = [s.address, s.locality].filter(Boolean).join(', ');
      return h('button', { class: 'item', onclick: () => openShop(s.id) },
        h('div', { class: 't' }, h('b', {}, s.name),
          h('small', {}, sub || 'Адрес не указан'),
          h('small', {}, lo ? 'Заказ ' + (lo === today ? 'сегодня' : daysWord(daysBetween(lo, today)) + ' назад') : 'Заказов ещё нет')),
        owed > 0 ? h('span', { class: 'r red num' }, rub(owed)) : null,
        h('span', { class: 'chev' }, icon('right')));
    })), h('div', { class: 'gap' }));
  }

  update();
  return update;
}

// Форма точки. Новая точка: проверка похожих, чтобы не было двойников.
export function editShop(shop = {}, onSaved) {
  const d = { locality: 'Грозный', ...shop };
  const s = sheet({ title: d.id ? 'Изменить точку' : 'Новая точка', full: true });
  const warn = h('div');
  let confirmed = false;
  const f = (key, label, props = {}, note = '') => field(label, inp({ value: d[key] || '', oninput: (e) => { d[key] = e.target.value; confirmed = false; fill(warn); }, ...props }), note);
  const gpsBtn = h('button', { class: 'btn line wide', type: 'button' }, icon('pin'), Number.isFinite(d.lat) ? 'Место отмечено. Отметить заново' : 'Отметить место по GPS');
  gpsBtn.onclick = () => {
    if (!navigator.geolocation) { toast('Телефон не даёт место', true); return; }
    gpsBtn.disabled = true;
    navigator.geolocation.getCurrentPosition((p) => {
      d.lat = Math.round(p.coords.latitude * 1e6) / 1e6;
      d.lng = Math.round(p.coords.longitude * 1e6) / 1e6;
      gpsBtn.disabled = false;
      fill(gpsBtn, icon('ok'), 'Место отмечено, точность ' + Math.round(p.coords.accuracy) + ' м');
    }, () => { gpsBtn.disabled = false; toast('Место не получено. Разрешите доступ к геопозиции', true); },
    { enableHighAccuracy: true, timeout: 15000 });
  };
  s.body.append(
    f('name', 'Название', { autocomplete: 'off' }),
    f('locality', 'Населённый пункт', { placeholder: 'Грозный' }),
    f('address', 'Адрес', { placeholder: 'Например: пр. Кадырова, 248' }),
    f('district', 'Район', {}, 'можно пусто'),
    f('contact', 'Контакт', { placeholder: 'Имя хозяина или управляющего' }, 'можно пусто'),
    f('phone', 'Телефон', { type: 'tel', inputmode: 'tel', placeholder: '+7 938 000-00-00' }, 'нужен для WhatsApp'),
    field('Заметка', h('textarea', { class: 'inp', oninput: (e) => { d.note = e.target.value; } }, d.note || '')),
    gpsBtn, warn);
  s.showFoot(h('button', { class: 'btn navy wide', onclick: () => {
    d.name = String(d.name || '').trim();
    if (!d.name) { toast('Введите название точки', true); return; }
    if (d.phone && !normPhone(d.phone)) { toast('Телефон не похож на российский номер', true); return; }
    d.phone = d.phone ? normPhone(d.phone) : '';
    const twins = d.id ? [] : similarShops(S.shops.filter((x) => !x.deleted), d);
    if (twins.length && !confirmed) {
      confirmed = true;
      fill(warn, h('div', { class: 'warnbox' }, h('b', {}, 'Похожие точки уже есть:'),
        twins.map((t) => h('div', {}, t.name + (t.address ? ', ' + t.address : '') + (t.phone ? ', ' + prettyPhone(t.phone) : ''))),
        h('div', { class: 'hint', style: 'margin:8px 0 0' }, 'Если это другая точка, нажмите «Сохранить» ещё раз.')));
      warn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const id = saveShop(d);
    toast(d.id ? 'Точка сохранена' : 'Точка добавлена');
    s.close();
    if (onSaved) setTimeout(() => onSaved(id), 260);
  } }, 'Сохранить'));
}
