// Отчёт за период. Печать в PDF: кнопка «Печать или PDF», в окне печати выбрать «Сохранить как PDF».
import { S, memberName } from '../store.js?v=36adbe7e';
import { h, icon, fill, sheet, choices } from './kit.js?v=36adbe7e';
import { isoDay, addDays, monthKey, monthStart, monthEnd, dayShort, parseDay, plural } from '../logic/dates.js?v=36adbe7e';
import { rub } from '../logic/format.js?v=36adbe7e';
import { buildReport } from '../logic/report.js?v=36adbe7e';

function periods(today) {
  const m = monthKey(today);
  const prev = monthKey(addDays(monthStart(m), -1));
  const d = parseDay(today);
  const monday = addDays(today, -((d.getDay() + 6) % 7));
  return [
    ['today', 'Сегодня', today, today],
    ['week', 'Эта неделя', monday, today],
    ['month', 'Этот месяц', monthStart(m), today],
    ['prev', 'Прошлый месяц', monthStart(prev), monthEnd(prev)],
  ];
}

export function openReport() {
  const today = isoDay();
  const list = periods(today);
  const view = { period: 'month', rep: S.lead ? '' : S.email };
  const s = sheet({ title: 'Отчёт', full: true });
  const out = h('div');
  const people = [['', 'Вся команда'], ...S.team.filter((m) => m.active !== false).map((m) => [m.id, m.name || m.id])];

  const draw = () => {
    const [, label, from, to] = list.find((p) => p[0] === view.period);
    const r = buildReport({ visits: S.visits, orders: S.orders, payments: S.payments, shops: S.shops, from, to, rep: view.rep });
    const who = view.rep ? memberName(view.rep) : 'Вся команда';
    const stat = (v, t) => h('div', { class: 'stat' }, h('b', { class: 'num' }, v), h('span', {}, t));
    fill(out,
      h('p', { class: 'muted', style: 'margin:16px 0 8px' }, label + ': ' + dayShort(from, today) + (from !== to ? ' - ' + dayShort(to, today).toLowerCase() : '') + '. ' + who),
      h('div', { class: 'stats', style: 'margin:0' },
        stat(String(r.visits), plural(r.visits, ['визит', 'визита', 'визитов'])),
        stat(r.conversion + '%', 'визитов с заказом'),
        stat(String(r.packs), 'уп. продано'),
        stat(rub(r.sum), 'сумма заказов'),
        stat(rub(r.paid), 'получено денег'),
        stat(String(r.noOrder), 'без заказа' + (r.noOrder ? ', из них ЛПР ответил: ' + r.asked : ''))),
      r.asked ? [h('div', { class: 'sec', style: 'padding-left:0;padding-right:0' }, h('h2', {}, 'Почему нет заказа')),
        h('p', { class: 'hint', style: 'margin:-4px 0 8px' }, 'Доля от визитов без заказа, где ЛПР был и ответил: ' + r.asked),
        r.refusals.filter((q) => q.rows.length).map((q) => [h('div', { class: 'q', style: 'font-size:16px;margin:12px 0 8px' }, q.title),
          h('div', { class: 'group bars', style: 'margin:0' }, q.rows.map((row) => h('div', { class: 'bar-row' },
            h('div', {}, h('span', {}, row.label), h('b', { class: 'num' }, row.count + ', ' + row.pct + '%')),
            h('div', { class: 'track' }, h('i', { style: 'width:' + row.pct + '%' })))))])] : null,
      r.products.length ? [h('div', { class: 'sec', style: 'padding-left:0;padding-right:0' }, h('h2', {}, 'Напитки')),
        h('div', { class: 'group', style: 'margin:0' }, r.products.map((p) => h('div', { class: 'kv' },
          h('span', {}, p.name), h('b', { class: 'num' }, p.packs + ' уп., ' + rub(p.sum)))))] : null,
      r.days.length ? [h('div', { class: 'sec', style: 'padding-left:0;padding-right:0' }, h('h2', {}, 'Продажи по дням')),
        r.days.map((d) => h('div', { class: 'rep-day', style: 'margin:0 0 12px' }, h('h3', {}, dayShort(d.date, today)),
          d.shops.map((sh) => h('div', { class: 'rep-shop' },
            h('div', { class: 'head' }, h('span', {}, sh.name), h('span', { class: 'num' }, rub(sh.total))),
            sh.lines.map((l) => h('div', { class: 'ln' }, l.line + ': ' + l.items.map((i) => i.name + ' ' + i.packs + ' уп.').join(', ')))))))]
        : h('div', { class: 'empty', style: 'margin:16px 0' }, 'Заказов за этот период нет'));
  };

  fill(s.body,
    h('div', { class: 'noprint' },
      choices(list.map((p) => [p[0], p[1]]), view.period, (v) => { view.period = v; draw(); }),
      S.lead && people.length > 2 ? h('div', { style: 'margin-top:8px' }, choices(people, view.rep, (v) => { view.rep = v; draw(); })) : null),
    out,
    h('div', { class: 'gap noprint' }),
    h('button', { class: 'btn navy wide noprint', onclick: () => print() }, icon('print'), 'Печать или PDF'));
  draw();
}
