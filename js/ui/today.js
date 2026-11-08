// Экран «Сегодня»: план, цифры дня, маршрут, ближайшие дела, долги, давно без заказа.
import { S, view, canEdit } from '../store.js?v=2f681d03';
import { doneNext } from '../save.js?v=2f681d03';
import { h, icon, fill, ext, toast, stat } from './kit.js?v=2f681d03';
import { head, planCard, owedTag, sec, whoText } from './common.js?v=2f681d03';
import { isoDay, dayTitle, dayShort, daysWord, plural } from '../logic/dates.js?v=2f681d03';
import { buildDay } from '../logic/day.js?v=2f681d03';
import { dayStats } from '../logic/stats.js?v=2f681d03';
import { qtyText } from '../logic/products.js?v=2f681d03';
import { rub, waLink, telLink } from '../logic/format.js?v=2f681d03';
import { routeLink, placeLink } from '../logic/maps.js?v=2f681d03';
import { openShop } from './shop.js?v=2f681d03';
import { startVisit } from './visit.js?v=2f681d03';
import { draftBanner } from './drafts.js?v=2f681d03';
import { avgDay, delta } from '../logic/dash.js?v=2f681d03';
import { deltaChip } from './figures.js?v=2f681d03';
import { addDays } from '../logic/dates.js?v=2f681d03';

const TASK = { visit: 'Визит', call: 'Позвонить', whatsapp: 'Написать в WhatsApp' };

function actions(s, task, visitId, rep) {
  const acts = [];
  if (task === 'call' && s.phone) acts.push(ext(telLink(s.phone), 'btn blue small', icon('phone'), 'Позвонить'));
  if (task === 'whatsapp' && s.phone) acts.push(ext(waLink(s.phone), 'btn blue small', icon('chat'), 'Написать'));
  if (task === 'visit') { const m = placeLink(s); if (m) acts.push(ext(m, 'btn white small', icon('route'), 'Маршрут')); }
  if ((task === 'call' || task === 'whatsapp') && canEdit({ rep })) {
    acts.push(h('button', { class: 'btn line small', onclick: () => { doneNext(visitId); toast('Отмечено: выполнено'); } }, 'Выполнено'));
  }
  return acts;
}

function stopEl(st, n, isNow) {
  const s = st.shop;
  const tags = [];
  if (st.task) {
    tags.push(h('span', { class: 'tag' + (st.task === 'visit' ? '' : ' blue') }, TASK[st.task]));
    if (st.overdue) tags.push(h('span', { class: 'tag red' }, 'Просрочено на ' + daysWord(st.overdue)));
  }
  if (st.done) tags.push(h('span', { class: 'tag grey num' }, st.result === 'order' ? 'Заказ' + (st.packs ? ' ' + st.packs + ' уп.' : '') : st.result === 'none' ? 'Без заказа' : 'Был сегодня'));
  tags.push(owedTag(st.owed));
  if (whoText(s.rep)) tags.push(h('span', { class: 'tag grey' }, whoText(s.rep)));
  const acts = actions(s, st.task, st.visitId, s.rep);
  if (isNow) acts.unshift(h('button', { class: 'btn red', onclick: () => startVisit(s.id) }, 'Начать визит'));
  return h('div', { class: 'stop' + (isNow ? ' now' : '') + (st.done && !st.task ? ' done' : '') },
    h('div', { class: 'dot num' }, st.done && !st.task ? icon('ok') : String(n)),
    h('div', { class: 't' },
      h('button', { class: 'name', onclick: () => openShop(s.id) }, s.name),
      h('small', {}, [s.address, s.locality].filter(Boolean).join(', ') || 'Адрес не указан'),
      h('div', { class: 'tags' }, tags),
      acts.length ? h('div', { class: 'acts' }, acts) : null));
}

function dayBlock(today) {
  const d = dayStats(view('orders').filter((o) => o.date === today));
  if (!d.orders) return null;
  // Сравнение с обычным днём: средняя выручка дня с заказами за прошлые 30 дней
  const usual = avgDay(view('orders'), view('returns'), addDays(today, -30), addDays(today, -1));
  return [sec('Продано сегодня', usual ? deltaChip(delta(d.sum, usual), 'к обычному дню') : null), h('div', { class: 'stats' },
    stat(String(d.drinks.packs), 'уп. напитков'),
    stat(rub(d.sum), d.orders + ' ' + plural(d.orders, ['заказ', 'заказа', 'заказов'])),
    d.sweets.packs || d.sweets.units ? stat(qtyText(d.sweets.packs, d.sweets.units), 'сладости') : null,
    d.snacks.packs || d.snacks.units ? stat(qtyText(d.snacks.packs, d.snacks.units), 'снеки') : null,
    stat(rub(d.avg), 'средний заказ'))];
}

export function mountToday(root) {
  const update = () => {
    const today = isoDay();
    const day = buildDay({ shops: view('shops'), visits: view('visits'), orders: view('orders'), payments: view('payments'), returns: view('returns'), today });
    const nowIdx = day.stops.findIndex((x) => x.task === 'visit' && !x.done);
    const visitStops = day.stops.filter((x) => x.task === 'visit' && !x.done).map((x) => x.shop);
    const route = visitStops.length > 1 ? routeLink(visitStops) : visitStops.length === 1 ? placeLink(visitStops[0]) : '';
    const loading = !S.loaded.shops || !S.loaded.visits;
    const tomorrow = day.soon.filter((x) => x.days === 1);
    const later = day.soon.filter((x) => x.days > 1);
    const soonRow = (x) => h('div', { class: 'item' },
      h('button', { class: 't', style: 'text-align:left;min-height:48px', onclick: () => openShop(x.shop.id) },
        h('b', {}, x.shop.name), h('small', {}, (TASK[x.next.type] || '') + ', ' + dayShort(x.next.date, today).toLowerCase() + (whoText(x.shop.rep) ? ', ' + whoText(x.shop.rep) : ''))),
      x.owed > 0 ? h('span', { class: 'r red num' }, rub(x.owed)) : null);

    fill(root,
      head('Сегодня', dayTitle(today)),
      h('div', { class: 'pad' }, planCard()),
      draftBanner(),
      dayBlock(today),
      route ? h('div', { class: 'ya' }, ext(route, 'btn line wide', icon('route'), 'Маршрут дня в Яндекс Картах')) : null,
      sec('Дела на сегодня'),
      loading ? h('div', { class: 'empty' }, 'Загружаю точки')
        : day.stops.length
          ? h('section', { class: 'route', 'aria-label': 'Маршрут дня' }, day.stops.map((st, i) => stopEl(st, i + 1, i === nowIdx)))
          : h('div', { class: 'empty' }, h('b', {}, 'На сегодня дел нет'), 'Выберите точку ниже или начните визит кнопкой «Визит».'),
      tomorrow.length ? [sec('Завтра'), h('div', { class: 'group' }, tomorrow.map(soonRow))] : null,
      later.length ? [sec('Ближайшие 7 дней'), h('div', { class: 'group' }, later.map(soonRow))] : null,
      day.debts.count ? [sec('Долги точек', h('a', { class: 'more', href: '#/debts' }, 'Все долги')),
        h('div', { class: 'group' }, h('a', { class: 'item', href: '#/debts' },
          icon('wallet'), h('div', { class: 't' }, h('b', {}, day.debts.count + ' ' + plural(day.debts.count, ['точка должна', 'точки должны', 'точек должны'])),
            h('small', {}, 'Нажмите, чтобы забрать оплату')), h('span', { class: 'r red num' }, rub(day.debts.sum))))] : null,
      day.stale.length ? [sec('Давно без заказа', h('a', { class: 'more', href: '#/shops' }, 'Все точки')),
        h('div', { class: 'group' }, day.stale.slice(0, 5).map((x) => h('button', { class: 'item', onclick: () => openShop(x.shop.id) },
          h('div', { class: 't' }, h('b', {}, x.shop.name), h('small', {}, x.days === null ? 'Ещё не были' : (x.ordered ? 'Без заказа ' : 'Не были ') + daysWord(x.days))),
          x.owed > 0 ? h('span', { class: 'r red num' }, rub(x.owed)) : null, h('span', { class: 'chev' }, icon('right')))))] : null,
      h('div', { class: 'gap' }));
  };
  update();
  return update;
}
