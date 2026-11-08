// ALSI Продажи: вход, меню, экраны.
// Телефон: нижнее меню из пяти кнопок. Широкий экран (Surface, компьютер): боковая панель со всеми разделами.
import { login, onUser, logout } from './fb.js?v=92040873';
import { S, start, stop, subscribe } from './store.js?v=92040873';
import { setErrorHandler } from './save.js?v=92040873';
import { h, icon, fill, toast } from './ui/kit.js?v=92040873';
import { mountToday } from './ui/today.js?v=92040873';
import { mountShops } from './ui/shops.js?v=92040873';
import { mountMap } from './ui/map.js?v=92040873';
import { mountDebts } from './ui/debts.js?v=92040873';
import { mountMore, MENU } from './ui/more.js?v=92040873';
import { mountJournal } from './ui/journal.js?v=92040873';
import { mountStats } from './ui/insights.js?v=92040873';
import { mountReport } from './ui/report.js?v=92040873';
import { mountPlan } from './ui/common.js?v=92040873';
import { mountCatalog } from './ui/catalog.js?v=92040873';
import { mountScript } from './ui/script.js?v=92040873';
import { mountDrafts } from './ui/drafts.js?v=92040873';
import { mountTeam } from './ui/team.js?v=92040873';
import { mountData } from './ui/data.js?v=92040873';
import { startVisit } from './ui/visit.js?v=92040873';

const root = document.getElementById('app');
const SCREENS = {
  today: mountToday, shops: mountShops, map: mountMap, debts: mountDebts, more: mountMore, journal: mountJournal,
  stats: mountStats, report: mountReport, plan: mountPlan, catalog: mountCatalog, script: mountScript,
  drafts: mountDrafts, team: mountTeam, data: mountData,
};
let current = '';
let update = null;

setErrorHandler((e) => {
  const code = e && e.code;
  toast(code === 'permission-denied' ? 'Облако не приняло запись: нет прав. Спросите владельца' : 'Запись не ушла в облако. Повторите', true);
});

// Раздел «Ещё» на телефоне подсвечивает и вложенные экраны
const PHONE = ['today', 'shops', 'debts', 'more'];
const phoneTab = (name) => (PHONE.includes(name) ? name : name === 'map' ? 'shops' : 'more');

function nav(active) {
  const tab = phoneTab(active);
  const a = (id, label, ic) => h('a', { href: '#/' + id, class: tab === id ? 'on' : '', 'aria-current': tab === id ? 'page' : null }, icon(ic), label);
  return h('nav', { class: 'nav', 'aria-label': 'Разделы' }, h('div', { class: 'in' },
    a('today', 'Сегодня', 'cal'),
    a('shops', 'Точки', 'shop'),
    h('a', { href: '#/visit', class: 'go-wrap', onclick: (e) => { e.preventDefault(); startVisit(); } },
      h('span', { class: 'go' }, icon('pin')), 'Визит'),
    a('debts', 'Долги', 'wallet'),
    a('more', 'Ещё', 'more')));
}

function side(active) {
  const items = MENU().flatMap((g) => g.items);
  return h('aside', { class: 'side', 'aria-label': 'Все разделы' },
    h('div', { class: 'brand' }, h('span', { class: 'mark' }, 'ALSI'), h('span', {}, 'Продажи')),
    h('button', { class: 'btn red wide', onclick: () => startVisit() }, icon('pin'), 'Начать визит'),
    h('div', { class: 'links' }, items.filter((i) => i.id).map((i) => h('a', {
      href: '#/' + i.id, class: active === i.id || (i.id === 'shops' && active === 'map') ? 'on' : '', 'aria-current': active === i.id ? 'page' : null,
    }, icon(i.icon), i.title))),
    h('div', { class: 'who' }, h('b', {}, S.me?.name || S.email), h('small', {}, S.email)));
}

function route() {
  if (!S.ready || S.denied || !S.user) return;
  const id = (location.hash.match(/^#\/(\w+)/) || [])[1];
  const name = SCREENS[id] ? id : 'today';
  if (name === current && update) { update(); return; }
  current = name;
  const screen = h('main', { class: 'screen' });
  root.classList.add('signed');
  fill(root, side(name), screen, nav(name));
  update = SCREENS[name](screen);
  scrollTo(0, 0);
}

function loginScreen(text = '') {
  root.classList.remove('signed');
  current = '';
  update = null;
  const btn = h('button', { class: 'btn red wide' }, 'Войти через Google');
  btn.onclick = async () => {
    btn.disabled = true;
    try { await login(); } catch (e) { toast('Вход не удался. Проверьте связь и повторите', true); }
    btn.disabled = false;
  };
  fill(root, h('section', { class: 'login' },
    h('div', { class: 'mark' }, 'ALSI'),
    h('h1', {}, 'Продажи'),
    h('p', {}, text || 'День торгового: точки, визиты, заказы, возвраты и долги. Работает и без связи.'),
    btn,
    h('p', { class: 'note' }, 'Вход только для команды ALSI. Почту добавляет владелец.')));
}

function denied() {
  root.classList.remove('signed');
  current = '';
  update = null;
  fill(root, h('section', { class: 'login' },
    h('div', { class: 'mark' }, 'ALSI'),
    h('h1', {}, 'Нет доступа'),
    h('p', {}, 'Почты ' + S.email + ' нет в команде. Попросите владельца добавить её в разделе «Команда».'),
    h('button', { class: 'btn white wide', onclick: () => logout() }, 'Войти другой почтой')));
}

subscribe(() => {
  if (!S.user) return;
  if (S.denied) { denied(); return; }
  route();
});
addEventListener('hashchange', route);

onUser(async (user) => {
  if (!user) { stop(); loginScreen(); return; }
  fill(root, h('section', { class: 'login' }, h('div', { class: 'mark' }, 'ALSI'), h('h1', {}, 'Загрузка')));
  await start(user);
});

// Работа без связи: служба копий и список файлов для неё
if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then((reg) => {
      setTimeout(() => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name).concat(location.href.split('#')[0]);
        reg.active && reg.active.postMessage({ cache: urls });
      }, 4000);
    }).catch(() => {});
  });
}
