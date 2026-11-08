// Каталог: категории, упаковки и штуки, цены, чистые продажи. Меняет только владелец.
// Загрузка списка товаров из файла (CSV или JSON): тот же товар обновляется, новый добавляется.
import { S, all, view } from '../store.js?v=453931aa';
import { saveProduct, hide, writeMany } from '../save.js?v=453931aa';
import { h, icon, fill, sheet, toast, ask, choices, field, inp, remember, seg, pickFile } from './kit.js?v=453931aa';
import { liveHead } from './common.js?v=453931aa';
import { rub, parseMoney, parseCount, norm } from '../logic/format.js?v=453931aa';
import { CATS, GROUPS, LINES, groupOf, catOf, catLabel, measure, sellsUnits, unitPriceOf, sortProducts, qtyText, parseCatalog, findSame } from '../logic/products.js?v=453931aa';
import { newId } from '../fb.js?v=453931aa';

export function mountCatalog(root) {
  const st = remember('alsi-catalog-' + S.email, { group: 'drinks', hidden: false });
  const top = liveHead('Каталог', S.owner ? h('button', { class: 'btn navy small', onclick: () => editProduct({ cat: st.group === 'drinks' ? 'drinks' : CATS.find((c) => c.group === st.group).id, active: true }) }, 'Новый товар') : null);
  const tabs = h('div', { class: 'pad' });
  const out = h('div');
  root.append(top.el, tabs, out);

  function update() {
    const ps = sortProducts(all('products'));
    // Чистые продажи товара во взгляде: упаковки и штуки минус возвраты
    const sold = new Map();
    const add = (list, sign) => { for (const x of list) for (const i of x.items || []) {
      const c = sold.get(i.productId) || { packs: 0, units: 0 };
      c.packs += sign * (i.packs || 0); c.units += sign * (i.units || 0); sold.set(i.productId, c);
    } };
    add(view('orders'), 1);
    add(view('returns'), -1);
    fill(tabs, seg(GROUPS.map((g) => [g.id, g.label + ' · ' + ps.filter((p) => groupOf(p) === g.id && p.active !== false).length]), st.group, (v) => { st.group = v; st.save(); update(); }));
    const list = ps.filter((p) => groupOf(p) === st.group && (st.hidden || p.active !== false));
    const heads = new Map();
    for (const p of list) {
      const key = st.group === 'drinks' ? (LINES.includes(p.line) ? p.line : 'Другие напитки') : catLabel(catOf(p));
      if (!heads.has(key)) heads.set(key, []);
      heads.get(key).push(p);
    }
    top.refresh(S.owner ? 'Цены видит только команда. Старые заказы остаются по старой цене' : 'Товары и цены');
    fill(out,
      [...heads].map(([title, items]) => [h('div', { class: 'sec' }, h('h2', {}, title)), h('div', { class: 'group' }, items.map((p) => {
        const s = sold.get(p.id) || { packs: 0, units: 0 };
        return h(S.owner ? 'button' : 'div', { class: 'item', onclick: S.owner ? () => editProduct(p) : null },
          h('div', { class: 't' }, h('b', { class: p.active === false ? 'muted' : '' }, p.name + (p.active === false ? ', скрыт' : '')),
            h('small', { class: 'num' }, [p.sku ? 'арт. ' + p.sku : '', measure(p), p.perPack > 1 ? p.perPack + ' шт. в уп.' : '', sellsUnits(p) ? 'упаковки и штуки, ' + rub(unitPriceOf(p)) + ' за шт.' : 'только упаковки'].filter(Boolean).join(', ')),
            s.packs || s.units ? h('small', {}, 'Продано ' + qtyText(Math.max(0, s.packs), Math.max(0, s.units))) : null),
          h('span', { class: 'r num' }, p.packPrice ? rub(p.packPrice) : 'нет цены'));
      }))]),
      !list.length ? h('div', { class: 'empty' }, h('b', {}, 'Товаров нет'), S.owner ? 'Добавьте товар или загрузите список из файла.' : 'Товары добавляет владелец.') : null,
      h('div', { class: 'pad', style: 'margin-top:16px' },
        h('button', { class: 'btn white wide', onclick: () => { st.hidden = !st.hidden; st.save(); update(); } }, st.hidden ? 'Не показывать скрытые' : 'Показать скрытые'),
        S.owner ? h('button', { class: 'btn line wide', style: 'margin-top:8px', onclick: importCatalog }, 'Загрузить список из файла') : null),
      h('div', { class: 'gap' }));
  }
  update();
  return update;
}

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

// Загрузка каталога списком: предпросмотр, потом запись
async function importCatalog() {
  const f = await pickFile('.csv,.json,.txt,text/csv,application/json');
  if (!f) return;
  const r = parseCatalog(f.text);
  if (!r.rows.length) { toast(r.errors[0] || 'В файле нет товаров', true); return; }
  const ours = all('products');
  const plan = r.rows.map((x) => ({ x, same: findSame(ours, x) }));
  const s = sheet({ title: 'Загрузка каталога', sub: f.name, full: true });
  const neu = plan.filter((p) => !p.same).length;
  s.body.append(
    h('p', {}, 'Новых товаров: ' + neu + '. Уже есть, обновятся: ' + (plan.length - neu) + '.'),
    r.errors.length ? h('div', { class: 'warnbox' }, h('b', {}, 'Пропущено строк: ' + r.errors.length), h('div', {}, r.errors.slice(0, 5).join('. '))) : null,
    h('p', { class: 'hint' }, 'Столбцы CSV: название; артикул; категория; объём мл; вес г; штук в упаковке; цена упаковки; цена штуки; штуками (да или нет).'),
    h('div', { class: 'group', style: 'margin:0' }, plan.slice(0, 100).map(({ x, same }) => h('div', { class: 'item' },
      h('div', { class: 't' }, h('b', {}, x.name), h('small', {}, (same ? 'обновится' : 'новый') + ', ' + catLabel(x.cat) + ', ' + x.perPack + ' шт. в уп.')),
      h('span', { class: 'r num' }, rub(x.packPrice))))));
  s.showFoot(h('button', { class: 'btn navy wide', onclick: async (e) => {
    if (!S.online) { toast('Нужна связь с облаком', true); return; }
    e.currentTarget.disabled = true;
    try {
      await writeMany(plan.map(({ x, same }) => ({ col: 'products', id: same ? same.id : newId('products'), data: { ...x, by: S.email, updatedAt: new Date().toISOString() }, merge: true })));
      toast('Каталог загружен: ' + plan.length);
      s.close();
    } catch (err) { toast('Не загрузилось: ' + (err.code || 'нет связи'), true); e.currentTarget.disabled = false; }
  } }, 'Загрузить ' + plan.length));
}
