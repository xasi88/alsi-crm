// Экран «Сегодня»: маршрут дня торгового.
import { S, doneNext } from '../store.js?v=282e3437';
import { h, icon, fill, ext, toast } from './kit.js?v=282e3437';
import { head, planCard, owedTag } from './common.js?v=282e3437';
import { isoDay, dayTitle, daysWord, plural } from '../logic/dates.js?v=282e3437';
import { buildDay } from '../logic/day.js?v=282e3437';
import { rub, waLink, telLink } from '../logic/format.js?v=282e3437';
import { routeLink, placeLink } from '../logic/maps.js?v=282e3437';
import { openShop } from './shop.js?v=282e3437';
import { startVisit } from './visit.js?v=282e3437';

const TASK = { visit: 'Визит', call: 'Позвонить', whatsapp: 'Написать в WhatsApp' };

function stopEl(st, n, isNow) {
  const s = st.shop;
  const tags = [];
  if (st.task) {
    tags.push(h('span', { class: 'tag' + (st.task === 'visit' ? '' : ' blue') }, TASK[st.task]));
    if (st.overdue) tags.push(h('span', { class: 'tag red' }, 'Просрочено на ' + daysWord(st.overdue)));
  }
  if (st.done) {
    tags.push(h('span', { class: 'tag grey num' }, st.result === 'order' ? 'Заказ' + (st.packs ? ' ' + st.packs + ' уп.' : '') : st.result === 'none' ? 'Без заказа' : 'Был сегодня'));
  }
  tags.push(owedTag(st.owed));
  const acts = [];
  if (isNow) acts.push(h('button', { class: 'btn red', onclick: () => startVisit(s.id) }, 'Начать визит'));
  if (st.task === 'call' && s.phone) acts.push(ext(telLink(s.phone), 'btn blue small', icon('phone'), 'Позвонить'));
  if (st.task === 'whatsapp' && s.phone) acts.push(ext(waLink(s.phone), 'btn blue small', icon('chat'), 'Написать'));
  if (st.task === 'call' || st.task === 'whatsapp') {
    acts.push(h('button', { class: 'btn line small', onclick: () => { doneNext(st.visitId); toast('Отмечено: выполнено'); } }, 'Выполнено'));
  }
  return h('div', { class: 'stop' + (isNow ? ' now' : '') + (st.done && !st.task ? ' done' : '') },
    h('div', { class: 'dot num' }, st.done && !st.task ? icon('ok') : String(n)),
    h('div', { class: 't' },
      h('button', { class: 'name', onclick: () => openShop(s.id) }, s.name),
      h('small', {}, [s.address, s.locality].filter(Boolean).join(', ') || 'Адрес не указан'),
      h('div', { class: 'tags' }, tags),
      acts.length ? h('div', { class: 'acts' }, acts) : null));
}

export function mountToday(root) {
  const update = () => {
    const today = isoDay();
    const day = buildDay({ shops: S.shops, visits: S.visits, orders: S.orders, payments: S.payments, today, rep: S.email });
    const nowIdx = day.stops.findIndex((x) => x.task === 'visit' && !x.done);
    const visitStops = day.stops.filter((x) => x.task === 'visit' && !x.done).map((x) => x.shop);
    const route = visitStops.length > 1 ? routeLink(visitStops) : visitStops.length === 1 ? placeLink(visitStops[0]) : '';
    const loading = !S.loaded.shops || !S.loaded.visits;

    fill(root,
      head('Сегодня', dayTitle(today)),
      h('div', { class: 'pad' }, planCard()),
      route ? h('div', { class: 'ya' }, ext(route, 'btn line wide', icon('route'), 'Маршрут дня в Яндекс Картах')) : null,
      loading ? h('div', { class: 'empty' }, 'Загружаю точки')
        : day.stops.length
          ? h('section', { class: 'route', 'aria-label': 'Маршрут дня' }, day.stops.map((st, i) => stopEl(st, i + 1, i === nowIdx)))
          : h('div', { class: 'empty' }, h('b', {}, 'На сегодня дел нет'),
            'Выберите точку ниже или начните визит кнопкой внизу.'),
      day.debts.count ? h('div', { class: 'sec' }, h('h2', {}, 'Долги точек'), h('a', { class: 'more', href: '#/debts' }, 'Все долги')) : null,
      day.debts.count ? h('div', { class: 'group' }, h('a', { class: 'item', href: '#/debts' },
        icon('wallet'), h('div', { class: 't' }, h('b', {}, day.debts.count + ' ' + plural(day.debts.count, ['точка должна', 'точки должны', 'точек должны'])),
          h('small', {}, 'Нажмите, чтобы забрать оплату')), h('span', { class: 'r red num' }, rub(day.debts.sum)))) : null,
      day.stale.length ? h('div', { class: 'sec' }, h('h2', {}, 'Давно без заказа'), h('a', { class: 'more', href: '#/shops' }, 'Все точки')) : null,
      day.stale.length ? h('div', { class: 'group' }, day.stale.slice(0, 5).map((x) => h('button', { class: 'item', onclick: () => openShop(x.shop.id) },
        h('div', { class: 't' }, h('b', {}, x.shop.name), h('small', {}, x.days === null ? 'Ещё не были' : (x.ordered ? 'Без заказа ' : 'Не были ') + daysWord(x.days))),
        x.owed > 0 ? h('span', { class: 'r red num' }, rub(x.owed)) : null, h('span', { class: 'chev' }, icon('right'))))) : null,
      h('div', { class: 'gap' }));
  };
  update();
  return update;
}
