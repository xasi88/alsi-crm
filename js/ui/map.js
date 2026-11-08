// Карта точек: те же фильтры, что у списка, метки, список под картой. Маршрут объезда: js/ui/route.js.
// Метку можно поставить или переставить только после подтверждения. Адрес точки не меняется.
// Библиотека карты (Leaflet 1.9.4, лицензия BSD) лежит в js/vendor и грузится только на этом экране.
import { S, view, canEdit } from '../store.js?v=2f681d03';
import { saveShop } from '../save.js?v=2f681d03';
import { h, icon, fill, toast, ask } from './kit.js?v=2f681d03';
import { liveHead } from './common.js?v=2f681d03';
import { isoDay } from '../logic/dates.js?v=2f681d03';
import { rub } from '../logic/format.js?v=2f681d03';
import { shopDebts } from '../logic/money.js?v=2f681d03';
import { hasPoint } from '../logic/maps.js?v=2f681d03';
import { lastVisits } from '../logic/filters.js?v=2f681d03';
import { shopView, shopFilters, filteredShops, listMapTabs } from './shops.js?v=2f681d03';
import { openShop } from './shop.js?v=2f681d03';
import { routeMode } from './route.js?v=2f681d03';

let loading = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (loading) return loading;
  loading = new Promise((ok, no) => {
    document.head.append(h('link', { rel: 'stylesheet', href: 'css/leaflet.css' }));
    const sc = h('script', { src: 'js/vendor/leaflet.js' });
    sc.onload = () => ok(window.L);
    sc.onerror = () => { loading = null; no(new Error('leaflet')); };
    document.head.append(sc);
  });
  return loading;
}

const GROZNY = [43.3178, 45.6986];
const COLOR = { debt: '#DF2228', today: '#8A97AB', base: '#0D2445' };

export function mountMap(root) {
  const st = shopView();
  const top = liveHead('Точки');
  const box = h('div', { class: 'map-box' }, h('div', { class: 'empty', style: 'margin:0' }, 'Загружаю карту'));
  const banner = h('div');
  const list = h('div');
  const routeBar = h('div');
  const rt = routeMode(() => update());
  root.append(top.el, h('div', { class: 'pad' }, listMapTabs('map')), shopFilters(st, () => update()), routeBar, banner, h('div', { class: 'pad' }, box), list);
  let map = null;
  let layer = null;
  let editing = null; // точка, которой ставим метку
  let temp = null;
  let fitted = false;

  loadLeaflet().then((L) => {
    if (!box.isConnected) return;
    fill(box);
    // Масштаб пальцами: кнопок «плюс» и «минус» нет (брендбук). Подпись OpenStreetMap остаётся: так требует лицензия карты.
    map = L.map(box, { zoomControl: false, preferCanvas: true, renderer: L.canvas({ tolerance: 14 }) }).setView(GROZNY, 11);
    map.attributionControl.setPrefix(false);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    layer = L.layerGroup().addTo(map);
    map.on('click', (e) => { if (editing) choose(e.latlng.lat, e.latlng.lng); });
    update();
  }).catch(() => fill(box, h('div', { class: 'empty', style: 'margin:0' }, 'Карта не загрузилась. Нужна связь. Список точек ниже работает')));

  function choose(lat, lng) {
    const L = window.L;
    if (temp) temp.remove();
    temp = L.circleMarker([lat, lng], { radius: 12, color: '#fff', weight: 3, fillColor: COLOR.debt, fillOpacity: 1 }).addTo(map);
    confirmPoint(editing, lat, lng);
  }

  async function confirmPoint(shop, lat, lng) {
    const ok = await ask('Сохранить место?', shop.name + ': метка встанет сюда. Маршруты Яндекс, 2ГИС и Google поведут сюда. Адрес не меняется.', 'Сохранить');
    if (ok) {
      saveShop({ id: shop.id, lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, pointSrc: 'Карта', pointLink: '', pointAt: new Date().toISOString() });
      toast('Место точки сохранено');
    } else toast('Место не изменено');
    stopEdit();
  }

  function startEdit(shop) {
    editing = shop;
    fill(banner, h('div', { class: 'warnbox pad-in' }, h('b', {}, shop.name + ': '), 'нажмите на карте точное место' + (hasPoint(shop) ? ' или перетащите метку' : ''),
      h('div', { style: 'margin-top:8px' }, h('button', { class: 'btn white small', onclick: stopEdit }, 'Отмена'))));
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    update();
  }

  function stopEdit() {
    editing = null;
    if (temp) { temp.remove(); temp = null; }
    fill(banner);
    update();
  }

  function update() {
    const today = isoDay();
    const rows = filteredShops(st);
    const debts = shopDebts(view('orders'), view('returns'), view('payments'), today);
    const lv = lastVisits(view('visits'));
    const pts = rows.filter(hasPoint);
    const none = rows.filter((s) => !hasPoint(s));
    top.refresh(pts.length + ' на карте, ' + none.length + ' без места');
    const ctx = { rows, debts, lv, today };
    fill(routeBar, editing ? null : rt.bar(ctx));
    if (map && layer) {
      const L = window.L;
      layer.clearLayers();
      if (rt.on && !editing) rt.draw(L, map, layer, ctx);
      else for (const s of pts) {
        const kind = (debts.get(s.id)?.owed || 0) > 0 ? 'debt' : lv.get(s.id) === today ? 'today' : 'base';
        const moving = editing && editing.id === s.id;
        const m = moving
          ? L.marker([s.lat, s.lng], { draggable: true, autoPan: true })
          : L.circleMarker([s.lat, s.lng], { radius: 10, color: '#fff', weight: 3, fillColor: COLOR[kind], fillOpacity: 1 });
        if (moving) m.on('dragend', () => { const p = m.getLatLng(); confirmPoint(s, p.lat, p.lng); });
        else m.on('click', () => {
          if (editing) return;
          const pop = h('div', { class: 'pop' }, h('b', {}, s.name), h('small', {}, [s.address, s.locality].filter(Boolean).join(', ')),
            debts.get(s.id)?.owed ? h('small', { class: 'red' }, 'Долг ' + rub(debts.get(s.id).owed)) : null,
            h('div', { class: 'btns' }, h('button', { class: 'btn navy small', onclick: () => openShop(s.id) }, 'Карточка'),
              canEdit(s) ? h('button', { class: 'btn white small', onclick: () => { map.closePopup(); startEdit(s); } }, 'Переставить') : null));
          L.popup({ maxWidth: 260 }).setLatLng([s.lat, s.lng]).setContent(pop).openOn(map);
        });
        m.addTo(layer);
      }
      if (!fitted && pts.length && !rt.on) { map.fitBounds(L.latLngBounds(pts.map((s) => [s.lat, s.lng])), { padding: [30, 30], maxZoom: 15 }); fitted = true; }
    }
    if (rt.on && !editing) { fill(list, rt.list(ctx)); return; }
    fill(list,
      h('div', { class: 'legend pad' }, h('span', {}, h('i', { style: 'background:' + COLOR.base }), 'точка'),
        h('span', {}, h('i', { style: 'background:' + COLOR.debt }), 'есть долг'), h('span', {}, h('i', { style: 'background:' + COLOR.today }), 'был сегодня')),
      none.length ? [h('div', { class: 'sec' }, h('h2', {}, 'Без места на карте')), h('div', { class: 'group' }, none.slice(0, 100).map((s) => h('div', { class: 'item' },
        h('button', { class: 't', style: 'text-align:left;min-height:48px', onclick: () => openShop(s.id) }, h('b', {}, s.name), h('small', {}, [s.address, s.locality].filter(Boolean).join(', ') || 'Адрес не указан')),
        canEdit(s) && map ? h('button', { class: 'btn line small', onclick: () => startEdit(s) }, 'Указать точку') : null)))] : null,
      pts.length ? [h('div', { class: 'sec' }, h('h2', {}, 'На карте')), h('div', { class: 'group' }, pts.slice(0, 100).map((s) => h('button', { class: 'item', onclick: () => {
        if (map) { map.setView([s.lat, s.lng], 16); box.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      } }, icon('pin'), h('div', { class: 't' }, h('b', {}, s.name), h('small', {}, [s.address, s.locality].filter(Boolean).join(', '))))))] : null,
      !rows.length ? h('div', { class: 'empty' }, S.loaded.shops ? 'Точек по этим фильтрам нет' : 'Загружаю точки') : null,
      h('div', { class: 'gap' }));
  }
  update();
  return update;
}
