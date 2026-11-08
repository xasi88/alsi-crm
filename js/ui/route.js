// Маршрут объезда на карте: кого объехать, порядок от места телефона, номера и линия на карте,
// части для Яндекс Карт по 10 точек. Маршрут хранится на телефоне до закрытия: можно уйти в визит и вернуться.
import { S, view } from '../store.js?v=69f8b533';
import { h, icon, fill, toast, remember, seg, ext } from './kit.js?v=69f8b533';
import { rub } from '../logic/format.js?v=69f8b533';
import { hasPoint } from '../logic/maps.js?v=69f8b533';
import { planRoute, routeParts, pathKm } from '../logic/route.js?v=69f8b533';
import { openShop } from './shop.js?v=69f8b533';

const WHO = [['all', 'Все'], ['debt', 'Должники'], ['stale', 'Давно без заказа'], ['new', 'Не были сегодня']];
const STALE = 14; // дней без заказа
const PART = 10;  // точек в одной ссылке Яндекс Карт

function lastOrders() {
  const m = new Map();
  for (const o of view('orders')) if (!o.deleted && (m.get(o.shopId) || '') < o.date) m.set(o.shopId, o.date);
  return m;
}
const daysAgo = (day, today) => Math.round((Date.parse(today) - Date.parse(day)) / 864e5);

// Место телефона. Окно разрешения может висеть: ждём не больше 15 секунд
function where() {
  return new Promise((ok) => {
    if (!navigator.geolocation) { ok(null); return; }
    const t = setTimeout(() => ok(null), 15000);
    const done = (x) => { clearTimeout(t); ok(x); };
    navigator.geolocation.getCurrentPosition((p) => done({ lat: p.coords.latitude, lng: p.coords.longitude }), () => done(null),
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 });
  });
}

// ctx: { rows (точки по фильтрам карты), debts, lv (последний визит), today }
export function routeMode(onChange) {
  const st = remember('alsi-route-' + S.email, { on: false, who: 'all', ids: [], skip: [], start: null, fit: false });
  let busy = false;

  const pick = (ctx) => {
    const lo = st.who === 'stale' ? lastOrders() : null;
    return ctx.rows.filter(hasPoint).filter((s) => !st.skip.includes(s.id)).filter((s) =>
      st.who === 'debt' ? (ctx.debts.get(s.id)?.owed || 0) > 0
        : st.who === 'stale' ? !lo.get(s.id) || daysAgo(lo.get(s.id), ctx.today) >= STALE
          : st.who === 'new' ? ctx.lv.get(s.id) !== ctx.today : true);
  };
  const stops = () => st.ids.map((id) => view('shops').find((s) => s.id === id)).filter((s) => s && !s.deleted && hasPoint(s));

  async function build(ctx) {
    if (busy) return;
    const list = pick(ctx);
    if (!list.length) { toast('По этим фильтрам нет точек на карте', true); return; }
    busy = true;
    onChange();
    const start = await where();
    busy = false;
    if (!start) toast('Место телефона не найдено. Маршрут от первой точки');
    const r = planRoute(list, start);
    Object.assign(st, { on: true, ids: r.stops.map((s) => s.id), start, fit: true });
    st.save();
    onChange();
  }

  function close() { Object.assign(st, { on: false, ids: [], skip: [], start: null }); st.save(); onChange(); }
  function drop(id) { st.ids = st.ids.filter((x) => x !== id); st.skip.push(id); st.save(); onChange(); }

  function bar(ctx) {
    if (!st.on) {
      const n = pick(ctx).length;
      return h('div', { class: 'pad rt-bar' },
        h('div', { class: 'q', style: 'margin-top:0' }, 'Маршрут объезда'),
        seg(WHO, st.who, (v) => { st.who = v; st.save(); onChange(); }),
        h('button', { class: 'btn navy wide', style: 'margin-top:12px', disabled: busy || !n, onclick: () => build(ctx) },
          icon('route'), busy ? 'Ищу место телефона' : n ? 'Построить маршрут: ' + n + ' ' + word(n) : 'Нет точек на карте'),
        h('small', { class: 'hint', style: 'display:block;margin-top:6px' }, 'Точки берутся по фильтрам выше. Порядок от вашего места, самый короткий путь.'));
    }
    const s = stops();
    const len = pathKm(s, st.start);
    return h('div', { class: 'pad rt-bar' },
      h('div', { class: 'okbox' }, h('b', {}, 'Маршрут: ' + s.length + ' ' + word(s.length) + ', около ' + Math.round(len) + ' км по прямой'),
        h('div', { class: 'hint', style: 'margin:4px 0 0' }, st.start ? 'Начало от вашего места. По дорогам путь длиннее, ведут Яндекс Карты' : 'Начало от точки 1. По дорогам ведут Яндекс Карты')),
      h('div', { class: 'btns', style: 'margin-top:8px' },
        h('button', { class: 'btn white small', disabled: busy, onclick: () => build(ctx) }, busy ? 'Ищу место' : 'Пересчитать'),
        h('button', { class: 'btn line small', onclick: close }, 'Закрыть маршрут')));
  }

  function draw(L, map, layer, ctx) {
    const s = stops();
    const line = (st.start ? [[st.start.lat, st.start.lng]] : []).concat(s.map((x) => [x.lat, x.lng]));
    if (line.length > 1) L.polyline(line, { color: '#0D2445', weight: 4, opacity: 0.7, interactive: false }).addTo(layer);
    if (st.start) L.circleMarker([st.start.lat, st.start.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#006DC0', fillOpacity: 1 }).bindTooltip('Вы здесь').addTo(layer);
    s.forEach((x, i) => {
      const kind = ctx.lv.get(x.id) === ctx.today ? ' done' : (ctx.debts.get(x.id)?.owed || 0) > 0 ? ' debt' : '';
      L.marker([x.lat, x.lng], { icon: L.divIcon({ className: 'rt-num' + kind, html: String(i + 1), iconSize: [30, 30] }), keyboard: false })
        .on('click', () => openShop(x.id)).addTo(layer);
    });
    if (st.fit && line.length) { map.fitBounds(L.latLngBounds(line), { padding: [30, 30], maxZoom: 15 }); st.fit = false; st.save(); }
  }

  function list(ctx) {
    const s = stops();
    const parts = routeParts(s, PART);
    const firstOpen = parts.findIndex((p) => p.stops.some((x) => ctx.lv.get(x.id) !== ctx.today));
    let n = 0;
    return [
      parts.map((p, k) => [
        h('div', { class: 'sec' }, h('h2', {}, parts.length > 1 ? 'Часть ' + (k + 1) + ': точки ' + p.first + '-' + p.last : 'Точки по порядку')),
        h('div', { class: 'pad' }, ext(p.link, 'btn wide ' + (k === firstOpen ? 'red' : 'white'), icon('route'), 'Ехать в Яндекс Картах' + (p.from ? ' от точки ' + (p.first - 1) : ''))),
        h('div', { class: 'group' }, p.stops.map((x) => {
          n += 1;
          const done = ctx.lv.get(x.id) === ctx.today;
          const owed = ctx.debts.get(x.id)?.owed || 0;
          return h('div', { class: 'item rt-stop' + (done ? ' done' : '') },
            h('span', { class: 'rt-n' + (done ? ' done' : owed > 0 ? ' debt' : '') }, String(n)),
            h('button', { class: 't', style: 'text-align:left;min-height:48px', onclick: () => openShop(x.id) }, h('b', {}, x.name),
              h('small', {}, [x.address, x.locality].filter(Boolean).join(', ') || 'Адрес не указан'),
              done ? h('small', {}, 'Был сегодня') : owed > 0 ? h('small', { class: 'red' }, 'Долг ' + rub(owed)) : null),
            h('button', { class: 'btn line small', 'aria-label': 'Убрать из маршрута: ' + x.name, onclick: () => drop(x.id) }, icon('minus')));
        }))]),
      st.skip.length ? h('div', { class: 'pad' }, h('button', { class: 'btn line wide', onclick: () => { st.skip = []; st.save(); build(ctx); } }, 'Вернуть убранные: ' + st.skip.length)) : null,
      h('div', { class: 'gap' })];
  }

  return { get on() { return st.on; }, bar, draw, list };
}

function word(n) {
  const a = n % 10;
  const b = n % 100;
  return a === 1 && b !== 11 ? 'точка' : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'точки' : 'точек';
}
