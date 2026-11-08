// Точки: список с поиском, фильтрами и сортировкой (запоминаются), форма точки.
import { S, view } from '../store.js?v=895b33d7';
import { saveShop } from '../save.js?v=895b33d7';
import { h, icon, fill, sheet, field, inp, toast, ext, remember, pickOne, seg } from './kit.js?v=895b33d7';
import { liveHead } from './common.js?v=895b33d7';
import { isoDay, daysBetween, daysWord, plural } from '../logic/dates.js?v=895b33d7';
import { rub, shopMatches, similarShops, normPhone, prettyPhone, telLink } from '../logic/format.js?v=895b33d7';
import { shopDebts } from '../logic/money.js?v=895b33d7';
import { shopRows, lastVisits, SORTS, VISITED, districtsOf, localitiesOf } from '../logic/filters.js?v=895b33d7';
import { parseMapLink, bestFix, hasPoint } from '../logic/maps.js?v=895b33d7';
import { openShop } from './shop.js?v=895b33d7';

export const shopView = () => remember('alsi-shops-' + S.email, { q: '', district: '', locality: '', visited: 'all', sort: 'name' });

// Фильтры точек: общие у списка и карты
export function shopFilters(st, onChange) {
  const box = h('div', { class: 'filters' });
  const changed = () => { st.save(); draw(); onChange(); };
  const btn = (label, on, fn) => h('button', { class: 'choice' + (on ? ' on' : ''), onclick: fn }, label, icon('down'));
  const draw = () => {
    const shops = view('shops');
    fill(box,
      h('div', { class: 'search' }, icon('search'), inp({ type: 'search', placeholder: 'Название, ЛПР, телефон, адрес', value: st.q, 'aria-label': 'Поиск точки',
        oninput: (e) => { st.q = e.target.value; st.save(); onChange(); } })),
      h('div', { class: 'chips' },
        btn(st.district || 'Все районы', !!st.district, () => pickOne({ title: 'Район', value: st.district, search: true,
          items: [['', 'Все районы'], ...districtsOf(shops).map((d) => [d, d])],
          onPick: (v) => { st.district = v; if (v && !localitiesOf(shops, v).includes(st.locality)) st.locality = ''; changed(); } })),
        btn(st.locality || 'Все пункты', !!st.locality, () => pickOne({ title: 'Населённый пункт', sub: st.district, value: st.locality, search: true,
          items: [['', 'Все пункты'], ...localitiesOf(shops, st.district).map((d) => [d, d])], onPick: (v) => { st.locality = v; changed(); } })),
        btn(VISITED.find((x) => x[0] === st.visited)[1], st.visited !== 'all', () => pickOne({ title: 'Визит сегодня', value: st.visited,
          items: VISITED, onPick: (v) => { st.visited = v; changed(); } })),
        btn('Сортировка: ' + SORTS.find((x) => x[0] === st.sort)[1].toLowerCase(), false, () => pickOne({ title: 'Сортировка', value: st.sort,
          items: SORTS, onPick: (v) => { st.sort = v; changed(); } })),
        st.q || st.district || st.locality || st.visited !== 'all'
          ? h('button', { class: 'choice', onclick: () => { Object.assign(st, { q: '', district: '', locality: '', visited: 'all' }); changed(); } }, 'Сбросить') : null));
  };
  draw();
  return box;
}

export function filteredShops(st) {
  return shopRows(view('shops'), { ...st, lastVisit: lastVisits(view('visits')), today: isoDay() }, shopMatches);
}

export const listMapTabs = (active) => seg([['shops', 'Список'], ['map', 'Карта']], active, (id) => { location.hash = '#/' + id; });

export function mountShops(root) {
  const st = shopView();
  const top = liveHead('Точки', h('button', { class: 'btn navy small', onclick: () => editShop() }, 'Новая точка'));
  const list = h('div');
  root.append(top.el, h('div', { class: 'pad' }, listMapTabs('shops')), shopFilters(st, () => update()), list);

  function update() {
    const today = isoDay();
    const debts = shopDebts(view('orders'), view('returns'), view('payments'), today);
    const lastOrder = new Map();
    for (const o of view('orders')) if ((lastOrder.get(o.shopId) || '') < o.date) lastOrder.set(o.shopId, o.date);
    const rows = filteredShops(st);
    top.refresh(rows.length + ' ' + plural(rows.length, ['точка', 'точки', 'точек']));
    if (!S.loaded.shops) { fill(list, h('div', { class: 'empty' }, 'Загружаю точки')); return; }
    if (!rows.length) {
      fill(list, h('div', { class: 'empty' }, h('b', {}, st.q ? 'Ничего не нашлось' : 'Точек нет'),
        st.q ? 'Проверьте название или добавьте новую точку.' : 'Измените фильтры или добавьте точку.',
        h('div', {}, h('button', { class: 'btn red', onclick: () => editShop({ name: st.q }) }, 'Новая точка'))));
      return;
    }
    fill(list, h('div', { class: 'group' }, rows.slice(0, 300).map((s) => {
      const owed = debts.get(s.id)?.owed || 0;
      const lo = lastOrder.get(s.id);
      return h('div', { class: 'item' },
        h('button', { class: 't', style: 'text-align:left;min-height:56px', onclick: () => openShop(s.id) }, h('b', {}, s.name),
          h('small', {}, [s.address, s.locality].filter(Boolean).join(', ') || 'Адрес не указан'),
          h('small', {}, lo ? 'Заказ ' + (lo === today ? 'сегодня' : daysWord(daysBetween(lo, today)) + ' назад') : 'Заказов ещё нет')),
        owed > 0 ? h('span', { class: 'r red num' }, rub(owed)) : null,
        s.phone ? ext(telLink(s.phone), 'ib white', icon('phone')) : null);
    })), rows.length > 300 ? h('p', { class: 'muted pad' }, 'Показаны первые 300. Уточните поиск.') : null, h('div', { class: 'gap' }));
  }
  update();
  return update;
}

const formKey = () => 'alsi-shopform-' + S.email;

// Место точки по GPS: несколько замеров за 10 секунд, берём самый точный
export function gpsFix(onDone, onFail) {
  if (!navigator.geolocation) { onFail('Телефон не даёт место'); return; }
  const fixes = [];
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    navigator.geolocation.clearWatch(w);
    const b = bestFix(fixes);
    if (b) onDone(b); else onFail('Место не получено. Разрешите доступ к геопозиции');
  };
  const w = navigator.geolocation.watchPosition((p) => {
    fixes.push({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6, acc: Math.round(p.coords.accuracy), src: 'GPS' });
    if (p.coords.accuracy <= 15 || fixes.length >= 5) finish();
  }, () => finish(), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  setTimeout(finish, 10000);
}

// Ввод ссылки из карты своим листом
export function askMapLink(onPoint) {
  const s = sheet({ title: 'Место из карты', sub: 'Яндекс Карты, 2ГИС или Google Maps' });
  const i = h('textarea', { class: 'inp', placeholder: 'Вставьте ссылку «Поделиться» или координаты: 43.3178, 45.6986' });
  s.body.append(h('p', { class: 'hint', style: 'margin:0 0 12px' }, 'В карте поставьте метку на точке, нажмите «Поделиться» и скопируйте ссылку.'), i);
  s.showFoot(h('button', { class: 'btn navy wide', onclick: () => {
    const r = parseMapLink(i.value);
    if (r.error) { toast(r.error, true); return; }
    onPoint(r);
    s.close();
  } }, 'Взять место'));
  setTimeout(() => i.focus(), 250);
}

// Форма точки. Новая точка: проверка похожих, черновик на случай закрытия.
export function editShop(shop = {}, onSaved) {
  let saved = null;
  if (!shop.id) { try { saved = JSON.parse(localStorage.getItem(formKey()) || 'null'); } catch (e) { saved = null; } }
  const d = { locality: 'Грозный', ...(saved && !shop.name ? saved : {}), ...shop };
  if (saved && !shop.name && saved.name) toast('Вернул незаконченную точку: ' + saved.name);
  const keep = () => { if (!d.id) { try { localStorage.setItem(formKey(), JSON.stringify(d)); } catch (e) { /* без черновика */ } } };
  const forget = () => { try { localStorage.removeItem(formKey()); } catch (e) { /* пусто */ } };
  const s = sheet({ title: d.id ? 'Изменить точку' : 'Новая точка', full: true });
  const warn = h('div');
  let confirmed = false;
  const f = (key, label, props = {}, note = '') => field(label, inp({ value: d[key] || '', oninput: (e) => { d[key] = e.target.value; confirmed = false; fill(warn); keep(); }, ...props }), note);
  const place = h('div', { class: 'group', style: 'margin:0 0 16px' });
  const drawPlace = () => fill(place,
    h('div', { class: 'item' }, icon('pin'), h('div', { class: 't' }, h('b', {}, hasPoint(d) ? 'Место отмечено' : 'Место не отмечено'),
      h('small', {}, hasPoint(d) ? (d.pointSrc || 'GPS') + (d.pointAcc ? ', точность ' + d.pointAcc + ' м' : '') : 'Нужно для маршрута и карты. Адрес не меняется'))),
    h('div', { class: 'btns', style: 'padding:0 12px 12px' },
      h('button', { class: 'btn white small', type: 'button', onclick: (e) => {
        const b = e.currentTarget;
        b.disabled = true;
        fill(b, 'Ищу место...');
        gpsFix((p) => { Object.assign(d, { lat: p.lat, lng: p.lng, pointSrc: 'GPS', pointAcc: p.acc, pointLink: '', pointAt: new Date().toISOString() }); keep(); drawPlace(); },
          (m) => { toast(m, true); drawPlace(); });
      } }, 'По GPS'),
      h('button', { class: 'btn white small', type: 'button', onclick: () => askMapLink((p) => {
        Object.assign(d, { lat: p.lat, lng: p.lng, pointSrc: p.src, pointAcc: null, pointLink: p.link, pointAt: new Date().toISOString() }); keep(); drawPlace();
      }) }, 'Из ссылки карты')));
  drawPlace();
  s.body.append(
    f('name', 'Название', { autocomplete: 'off', placeholder: 'Например: Магазин Кавказ' }),
    f('locality', 'Населённый пункт', { placeholder: 'Грозный' }),
    f('district', 'Район', { placeholder: 'Например: Шалинский район' }, 'можно пусто'),
    f('address', 'Адрес', { placeholder: 'Например: пр. Кадырова, 248' }),
    f('contact', 'ЛПР или контакт', { placeholder: 'Имя хозяина или управляющего' }, 'можно пусто'),
    f('phone', 'Телефон', { type: 'tel', inputmode: 'tel', placeholder: '+7 938 000-00-00' }, 'он же для WhatsApp'),
    field('Заметка', h('textarea', { class: 'inp', oninput: (e) => { d.note = e.target.value; keep(); } }, d.note || '')),
    place, warn);
  s.showFoot(h('button', { class: 'btn navy wide', onclick: () => {
    d.name = String(d.name || '').trim();
    if (!d.name) { toast('Введите название точки', true); return; }
    if (d.phone && !normPhone(d.phone)) { toast('Телефон не похож на российский номер', true); return; }
    d.phone = d.phone ? normPhone(d.phone) : '';
    const twins = d.id ? [] : similarShops(view('shops'), d);
    if (twins.length && !confirmed) {
      confirmed = true;
      fill(warn, h('div', { class: 'warnbox' }, h('b', {}, 'Похожие точки уже есть:'),
        twins.map((t) => h('div', {}, t.name + (t.address ? ', ' + t.address : '') + (t.phone ? ', ' + prettyPhone(t.phone) : ''))),
        h('div', { class: 'hint', style: 'margin:8px 0 0' }, 'Если это другая точка, нажмите «Сохранить» ещё раз.')));
      warn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const id = saveShop(d);
    forget();
    toast(d.id ? 'Точка сохранена' : 'Точка добавлена');
    s.close();
    if (onSaved) setTimeout(() => onSaved(id), 260);
  } }, 'Сохранить'));
}
