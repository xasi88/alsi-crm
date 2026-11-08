// Карточка товара: большое фото, упаковка, цены, продажи. Владелец меняет товар и фото.
// Фото: своё (снято на телефон, лежит в товаре, поле photo) или фото упаковки производителя (img/products).
import { S, all, view } from '../store.js?v=536b4882';
import { saveProduct, hide } from '../save.js?v=536b4882';
import { h, icon, fill, sheet, toast, ask, choices, field, inp, fileButton } from './kit.js?v=536b4882';
import { rub, parseMoney, parseCount, norm } from '../logic/format.js?v=536b4882';
import { CATS, LINES, catOf, catLabel, measure, sellsUnits, unitPriceOf, qtyText } from '../logic/products.js?v=536b4882';
import { picOf } from '../logic/pics.js?v=536b4882';
import { dayShort, isoDay } from '../logic/dates.js?v=536b4882';

// Фото товара или пустое место со значком банки
export function pic(p, cls = 'pic') {
  const src = picOf(p);
  return src ? h('img', { class: cls, src, alt: '', loading: 'lazy', decoding: 'async' }) : h('div', { class: cls + ' none' }, icon('can'));
}

// Продажи товара во взгляде: упаковки и штуки минус возвраты, сумма, сколько точек брали, последний заказ
function salesOf(id) {
  const r = { packs: 0, units: 0, sum: 0, shops: new Set(), last: '' };
  for (const o of view('orders')) for (const i of o.items || []) {
    if (i.productId !== id) continue;
    r.packs += i.packs || 0; r.units += i.units || 0;
    r.sum += (i.packs || 0) * (i.packPrice || 0) + (i.units || 0) * (i.unitPrice || 0);
    r.shops.add(o.shopId);
    if (o.date > r.last) r.last = o.date;
  }
  for (const x of view('returns')) for (const i of x.items || []) {
    if (i.productId !== id) continue;
    r.packs -= i.packs || 0; r.units -= i.units || 0;
    r.sum -= (i.packs || 0) * (i.packPrice || 0) + (i.units || 0) * (i.unitPrice || 0);
  }
  return r;
}

const kv = (k, v) => h('div', { class: 'kv' }, h('span', {}, k), h('b', { class: 'num' }, v));

export function openProduct(p0) {
  const s = sheet({ title: p0.name, sub: catLabel(catOf(p0)) + (p0.line ? ', ' + p0.line : ''), full: true });
  let local = null; // своё фото до прихода из облака
  const draw = () => {
    const p = { ...(all('products').find((x) => x.id === p0.id) || p0), ...(local || {}) };
    const r = salesOf(p.id);
    fill(s.body,
      h('div', { class: 'pbig' }, pic(p, 'pic big')),
      h('div', { class: 'group', style: 'margin:12px 0 0' },
        measure(p) ? kv(Number(p.weightG) > 0 ? 'Вес' : 'Объём', measure(p)) : null,
        kv('В упаковке', (p.perPack || 1) + ' шт.'),
        kv('Цена упаковки', p.packPrice ? rub(p.packPrice) : 'нет цены'),
        sellsUnits(p) ? kv('Цена штуки', rub(unitPriceOf(p))) : kv('Продаём', 'только упаковками'),
        p.sku ? kv('Артикул', p.sku) : null,
        p.active === false ? kv('В заказе', 'скрыт') : null),
      h('div', { class: 'q' }, 'Продажи'),
      h('div', { class: 'group', style: 'margin:0' },
        kv('Продано', qtyText(Math.max(0, r.packs), Math.max(0, r.units))),
        kv('На сумму', rub(Math.max(0, r.sum))),
        kv('Точек брали', String(r.shops.size)),
        kv('Последний заказ', r.last ? dayShort(r.last, isoDay()) : 'не было')),
      S.owner ? [h('div', { class: 'q' }, 'Фото'),
        h('p', { class: 'hint', style: 'margin:0 0 8px' }, p.photo ? 'Своё фото. Можно вернуть фото производителя.' : 'Можно снять товар на телефон или выбрать фото.'),
        fileButton(p.photo ? 'Сменить фото' : 'Снять или выбрать фото', 'image/*', async (f) => {
          const data = await shrink(f);
          if (!data) { toast('Фото не читается', true); return; }
          saveProduct({ id: p.id, photo: data });
          local = { photo: data };
          toast('Фото сохранено');
          draw();
        }, { raw: true, cls: 'btn white wide' }),
        p.photo ? h('button', { class: 'btn line wide', style: 'margin-top:8px', onclick: () => {
          saveProduct({ id: p.id, photo: '' }); local = { photo: '' }; toast('Фото производителя'); draw();
        } }, 'Вернуть фото производителя') : null] : null,
      h('div', { class: 'gap' }));
    if (S.owner) s.showFoot(h('button', { class: 'btn navy wide', onclick: () => s.close().then(() => editProduct(p)) }, icon('edit'), 'Изменить товар'));
  };
  draw();
}

// Фото с телефона: до 600 точек, WebP (или JPEG, если браузер не умеет WebP), до 140 КБ
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = url; });
    const k = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.82, 0.7, 0.55, 0.4]) {
      let d = c.toDataURL('image/webp', q);
      if (!d.startsWith('data:image/webp')) d = c.toDataURL('image/jpeg', q);
      if (d.length < 140000) return d;
    }
    return '';
  } catch (e) {
    return '';
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Новый товар или правка (только владелец)
export function editProduct(p, after) {
  const d = { ...p };
  const s = sheet({ title: d.id ? d.name : 'Новый товар', full: true });
  const num = (key, label, note) => field(label, inp({ inputmode: 'decimal', value: d[key] || '', oninput: (e) => { d[key] = e.target.value; } }), note);
  const lineBox = h('div');
  const drawLine = () => fill(lineBox, catOf(d) === 'drinks' ? [h('div', { class: 'q' }, 'Линейка'), choices([...LINES, 'Другое'].map((l) => [l, l]), d.line || 'Другое', (v) => { d.line = v === 'Другое' ? '' : v; })] : null);
  drawLine();
  s.body.append(
    field('Название', inp({ value: d.name || '', oninput: (e) => { d.name = e.target.value; } })),
    field('Артикул', inp({ value: d.sku || '', oninput: (e) => { d.sku = e.target.value; } }), 'можно пусто'),
    h('div', { class: 'q' }, 'Категория'), choices(CATS.map((c) => [c.id, c.label]), catOf(d), (v) => { d.cat = v; if (v === 'drinks') d.units = false; drawLine(); }),
    lineBox, h('div', { class: 'gap' }),
    num('volumeMl', 'Объём, мл', 'для напитков'), num('weightG', 'Вес, г', 'для сладостей и снеков'),
    num('perPack', 'Штук в упаковке'), num('packPrice', 'Цена упаковки, ₽'),
    num('unitPrice', 'Цена штуки, ₽', 'пусто: доля цены упаковки'),
    h('div', { class: 'q' }, 'Как продаём'),
    choices([['pack', 'Только упаковками'], ['units', 'Упаковками и штуками']], d.units ? 'units' : 'pack', (v) => { d.units = v === 'units'; }, { col: true }),
    num('sort', 'Порядок в списке', 'меньше: выше'),
    h('div', { class: 'q' }, 'В заказе'),
    choices([['yes', 'Показывать'], ['no', 'Скрыть']], d.active === false ? 'no' : 'yes', (v) => { d.active = v === 'yes'; }));
  s.showFoot(
    d.id ? h('button', { class: 'btn white', onclick: async () => {
      if (await ask('Удалить товар?', 'Товар пропадёт из каталога. Старые заказы с ним не меняются.', 'Удалить', true)) { hide('products', d.id); toast('Товар удалён'); s.close(); }
    } }, 'Удалить') : null,
    h('button', { class: 'btn navy', style: 'flex:1', onclick: () => {
      const name = String(d.name || '').trim();
      const price = parseMoney(String(d.packPrice || '0'));
      const unit = parseMoney(String(d.unitPrice || '0'));
      const per = parseCount(String(d.perPack || '1'));
      const vol = parseCount(String(d.volumeMl || ''));
      const w = parseCount(String(d.weightG || ''));
      if (!name) { toast('Введите название', true); return; }
      if ([price, unit, per, vol, w].some(Number.isNaN)) { toast('Объём, вес, штуки и цены: только цифры', true); return; }
      if (!d.id && all('products').some((x) => norm(x.name) === norm(name))) { toast('Такой товар уже есть', true); return; }
      if (d.units && catOf(d) === 'drinks') { toast('Напитки продаются только упаковками', true); return; }
      const id = saveProduct({ id: d.id, name, sku: String(d.sku || '').trim(), cat: catOf(d), line: d.line || '', volumeMl: vol, weightG: w, perPack: per || 1,
        packPrice: price, unitPrice: unit, units: !!d.units, sort: parseCount(String(d.sort || '0')) || 0, active: d.active !== false });
      toast('Сохранено. Старые заказы остаются по старой цене');
      s.close();
      if (after) after(id);
    } }, 'Сохранить'));
  s.foot.style.display = 'flex';
  s.foot.style.gap = '8px';
}
