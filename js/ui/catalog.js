// Каталог: карточки товаров с фото, категории, цены, чистые продажи. Карточка и правка товара: product.js.
// Загрузка списка товаров из файла (CSV или JSON): тот же товар обновляется, новый добавляется.
import { S, all, view } from '../store.js?v=895b33d7';
import { writeMany } from '../save.js?v=895b33d7';
import { h, fill, sheet, toast, remember, seg, pickFile } from './kit.js?v=895b33d7';
import { liveHead } from './common.js?v=895b33d7';
import { rub } from '../logic/format.js?v=895b33d7';
import { CATS, GROUPS, LINES, groupOf, catOf, catLabel, measure, sortProducts, qtyText, parseCatalog, findSame } from '../logic/products.js?v=895b33d7';
import { newId } from '../fb.js?v=895b33d7';
import { editProduct, openProduct, pic } from './product.js?v=895b33d7';

export { editProduct };

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
      [...heads].map(([title, items]) => [h('div', { class: 'sec' }, h('h2', {}, title)), h('div', { class: 'pgrid' }, items.map((p) => {
        const s = sold.get(p.id) || { packs: 0, units: 0 };
        return h('button', { class: 'pcard' + (p.active === false ? ' off' : ''), onclick: () => openProduct(p) },
          pic(p),
          h('b', {}, p.name),
          h('small', { class: 'num' }, [measure(p), p.perPack > 1 ? p.perPack + ' шт. в уп.' : ''].filter(Boolean).join(', ')),
          s.packs || s.units ? h('small', {}, 'Продано ' + qtyText(Math.max(0, s.packs), Math.max(0, s.units))) : null,
          p.active === false ? h('small', {}, 'Скрыт в заказе') : null,
          h('span', { class: 'price num' }, p.packPrice ? rub(p.packPrice) : 'нет цены'));
      }))]),
      !list.length ? h('div', { class: 'empty' }, h('b', {}, 'Товаров нет'), S.owner ? 'Добавьте товар или загрузите список из файла.' : 'Товары добавляет админ.') : null,
      h('div', { class: 'pad', style: 'margin-top:16px' },
        h('button', { class: 'btn white wide', onclick: () => { st.hidden = !st.hidden; st.save(); update(); } }, st.hidden ? 'Не показывать скрытые' : 'Показать скрытые'),
        S.owner ? h('button', { class: 'btn line wide', style: 'margin-top:8px', onclick: importCatalog }, 'Загрузить список из файла') : null),
      h('div', { class: 'gap' }));
  }
  update();
  return update;
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
