// Отчёт PDF: разделы на выбор, сотрудник, точка, категория, даты. Выбор запоминается.
// Кнопка «Сохранить PDF» открывает окно печати: там выбрать «Сохранить как PDF».
import { S, view, people, memberName, shopById } from '../store.js?v=69f8b533';
import { h, icon, fill, remember, choices, field, inp, pickOne, toast } from './kit.js?v=69f8b533';
import { liveHead } from './common.js?v=69f8b533';
import { isoDay, dayShort, dayTitle, plural } from '../logic/dates.js?v=69f8b533';
import { rub, prettyPhone } from '../logic/format.js?v=69f8b533';
import { CATS, GROUPS, catLabel } from '../logic/products.js?v=69f8b533';
import { periodRange } from '../logic/filters.js?v=69f8b533';
import { buildReport, SECTIONS, PRESETS } from '../logic/report.js?v=69f8b533';

const CAT_ITEMS = [['', 'Все категории'], ...GROUPS.map((g) => [g.id, g.label]), ...CATS.filter((c) => c.group !== 'drinks').map((c) => [c.id, c.label])];

export function mountReport(root) {
  const today = isoDay();
  const m = periodRange('month', today);
  const st = remember('alsi-report-' + S.email, { preset: 'full', sections: PRESETS[0][2], rep: '', shopId: '', cat: '', from: m.from, to: m.to });
  const top = liveHead('Отчёт');
  const form = h('div', { class: 'pad noprint' });
  const doc = h('div', { class: 'report' });
  root.append(top.el, form, doc);

  const drawForm = () => {
    const shop = shopById(st.shopId);
    fill(form,
      h('div', { class: 'q' }, 'Какой отчёт'),
      choices(PRESETS.map((p) => [p[0], p[1]]), st.preset, (v) => { st.preset = v; st.sections = PRESETS.find((p) => p[0] === v)[2]; st.save(); drawForm(); update(); }),
      h('div', { class: 'q' }, 'Что включить'),
      choices(SECTIONS, st.sections, (v) => { st.sections = v; st.preset = ''; st.save(); drawForm(); update(); }, { multi: true }),
      h('div', { class: 'q' }, 'Даты'),
      h('div', { class: 'chips', style: 'padding:0' }, [['today', 'Сегодня'], ['week', 'Неделя'], ['month', 'Месяц'], ['prev', 'Прошлый месяц'], ['year', 'Год']].map(([id, label]) =>
        h('button', { class: 'choice', onclick: () => { const r = periodRange(id, today); st.from = r.from; st.to = r.to; st.save(); drawForm(); update(); } }, label))),
      h('div', { class: 'dates' },
        field('С', inp({ type: 'date', value: st.from, onchange: (e) => { st.from = e.target.value; st.save(); update(); } })),
        field('По', inp({ type: 'date', value: st.to, onchange: (e) => { st.to = e.target.value; st.save(); update(); } }))),
      h('div', { class: 'chips', style: 'padding:0' },
        S.lead && people().length > 1 ? h('button', { class: 'choice' + (st.rep ? ' on' : ''), onclick: () => pickOne({ title: 'Сотрудник', value: st.rep,
          items: [['', 'Все сотрудники'], ...people().map((p) => [p.id, p.name || p.id])], onPick: (v) => { st.rep = v; st.save(); drawForm(); update(); } }) },
        st.rep ? memberName(st.rep) : 'Все сотрудники', icon('down')) : null,
        h('button', { class: 'choice' + (st.shopId ? ' on' : ''), onclick: () => pickOne({ title: 'Точка', value: st.shopId, search: true,
          items: [['', 'Все точки'], ...view('shops').sort((a, b) => a.name.localeCompare(b.name, 'ru')).map((s) => [s.id, s.name, [s.address, s.locality].filter(Boolean).join(', ')])],
          onPick: (v) => { st.shopId = v; st.save(); drawForm(); update(); } }) }, shop ? shop.name : 'Все точки', icon('down')),
        h('button', { class: 'choice' + (st.cat ? ' on' : ''), onclick: () => pickOne({ title: 'Категория товаров', value: st.cat, items: CAT_ITEMS,
          onPick: (v) => { st.cat = v; st.save(); drawForm(); update(); } }) }, CAT_ITEMS.find((x) => x[0] === st.cat)[1], icon('down'))),
      h('p', { class: 'hint', style: 'margin:8px 0 0' }, 'Категория действует на продажи, аналитику и возвраты. Долг считается по заказу целиком.'),
      h('button', { class: 'btn navy wide', style: 'margin-top:16px', onclick: () => {
        if (!st.sections.length) { toast('Выберите хотя бы один раздел', true); return; }
        print();
      } }, icon('print'), 'Сохранить PDF'));
  };

  function update() {
    top.refresh('Выберите разделы и даты, отчёт строится ниже');
    if (!st.sections.length) { fill(doc, h('div', { class: 'empty' }, 'Выберите хотя бы один раздел')); return; }
    const scopeRep = st.rep || S.scope || '';
    const r = buildReport({ visits: view('visits'), orders: view('orders'), returns: view('returns'), payments: view('payments'), shops: view('shops'),
      from: st.from || '0000-01-01', to: st.to || '9999-12-31', rep: scopeRep, shopId: st.shopId, cat: st.cat, sections: st.sections });
    const shopLine = (x) => [x.address, x.phone ? prettyPhone(x.phone) : '', x.contact ? 'ЛПР: ' + x.contact : ''].filter(Boolean).join(', ');
    const h3 = (t) => h('h3', { class: 'rep-h' }, t);
    fill(doc,
      h('div', { class: 'rep-title' }, h('b', {}, 'ALSI Продажи: отчёт'),
        h('div', {}, (st.from ? dayShort(st.from, '') : 'с начала') + ' - ' + (st.to ? dayShort(st.to, '') : 'сегодня')
          + '. ' + (scopeRep ? memberName(scopeRep) : S.lead ? 'Вся команда' : memberName(S.email))
          + (st.shopId ? '. ' + (shopById(st.shopId)?.name || '') : '') + (st.cat ? '. ' + CAT_ITEMS.find((x) => x[0] === st.cat)[1] : '')),
        h('small', {}, 'Составлен ' + dayTitle(today).toLowerCase())),
      r.sales ? [h3('Продажи: ' + rub(r.salesSum)), r.sales.length ? r.sales.map((d) => h('div', { class: 'rep-day' }, h('h3', {}, dayTitle(d.date) + ', ' + rub(d.sum)),
        d.shops.map((sh) => h('div', { class: 'rep-shop' },
          h('div', { class: 'head' }, h('span', {}, sh.name), h('span', { class: 'num' }, rub(sh.sum))),
          shopLine(sh) ? h('div', { class: 'ln' }, shopLine(sh)) : null,
          sh.cats.map((c) => h('div', { class: 'ln' }, h('b', {}, catLabel(c.cat) + ': '), c.items.map((i) => i.name + ' ' + i.qty + ' (' + rub(i.sum) + ')').join(', '))))))) : h('p', { class: 'muted' }, 'Продаж нет')] : null,
      r.analytics ? [h3('Аналитика'), h('div', { class: 'group' }, [
        ['Чистая выручка', rub(r.analytics.net)], ['Продажи', rub(r.analytics.gross)], ['Возвраты', rub(r.analytics.back)],
        ['Заказов', String(r.analytics.orders)], ['Средний заказ', rub(r.analytics.avg)],
        ['Напитки', r.analytics.groups.drinks.packs + ' уп.'], ['Сладости', r.analytics.groups.sweets.packs + ' уп., ' + r.analytics.groups.sweets.units + ' шт.'],
        ['Снеки', r.analytics.groups.snacks.packs + ' уп., ' + r.analytics.groups.snacks.units + ' шт.'],
        ['Визитов', String(r.analytics.visits)], ['Визитов с заказом', r.analytics.withOrderPct + '%'], ['Повторные заказы', r.analytics.repeat + ' из ' + r.analytics.orders],
      ].map(([k, v]) => h('div', { class: 'kv' }, h('span', {}, k), h('b', { class: 'num' }, v)))),
      r.analytics.topShops.length ? h('p', { class: 'ln' }, 'Лучшие точки: ' + r.analytics.topShops.slice(0, 5).map((x) => x.name + ' ' + rub(x.sum)).join(', ')) : null] : null,
      r.debts ? [h3('Долги: ' + rub(r.debtsSum)), r.debts.length ? h('div', { class: 'group' }, r.debts.map((d) => h('div', { class: 'item' },
        h('div', { class: 't' }, h('b', {}, d.shop.name), h('small', {}, [shopLine(d.shop), 'не оплачено ' + d.age + ' ' + plural(d.age, ['день', 'дня', 'дней'])].filter(Boolean).join('. '))),
        h('span', { class: 'r num' }, rub(d.owed))))) : h('p', { class: 'muted' }, 'Долгов нет')] : null,
      r.refusals ? [h3('Отказы: опрошено ЛПР ' + r.refusals.asked), r.refusals.questions.filter((q) => q.rows.length).map((q) => h('div', { class: 'rep-day' }, h('h3', {}, q.title),
        q.rows.map((x) => h('div', { class: 'ln' }, x.label + ': ' + x.count + ', ' + x.pct + '%'))))] : null,
      r.returns ? [h3('Возвраты: ' + rub(r.returnsSum)), r.returns.length ? h('div', { class: 'group' }, r.returns.map((x) => h('div', { class: 'item' },
        h('div', { class: 't' }, h('b', {}, dayShort(x.date, '') + ', ' + x.shop.name), h('small', {}, x.items + (x.note ? '. ' + x.note : ''))),
        h('span', { class: 'r num' }, rub(x.sum))))) : h('p', { class: 'muted' }, 'Возвратов нет')] : null,
      h('div', { class: 'gap' }));
  }

  drawForm();
  update();
  return update;
}
