// ATAM SALES CRM: вход, меню, экраны.
// Телефон: нижнее меню из пяти кнопок. Широкий экран (Surface, компьютер): боковая панель со всеми разделами.
import { onUser } from './fb.js?v=2f681d03';
import { S, start, stop, subscribe } from './store.js?v=2f681d03';
import { setErrorHandler } from './save.js?v=2f681d03';
import { h, icon, fill, toast } from './ui/kit.js?v=2f681d03';
import { mountToday } from './ui/today.js?v=2f681d03';
import { mountShops } from './ui/shops.js?v=2f681d03';
import { mountMap } from './ui/map.js?v=2f681d03';
import { mountDebts } from './ui/debts.js?v=2f681d03';
import { mountMore, MENU } from './ui/more.js?v=2f681d03';
import { mountJournal } from './ui/journal.js?v=2f681d03';
import { mountStats } from './ui/insights.js?v=2f681d03';
import { mountReport } from './ui/report.js?v=2f681d03';
import { mountPlan } from './ui/common.js?v=2f681d03';
import { mountCatalog } from './ui/catalog.js?v=2f681d03';
import { mountScript } from './ui/script.js?v=2f681d03';
import { mountDrafts } from './ui/drafts.js?v=2f681d03';
import { mountTeam } from './ui/team.js?v=2f681d03';
import { mountData } from './ui/data.js?v=2f681d03';
import { startVisit } from './ui/visit.js?v=2f681d03';
import { loginScreen, verifyScreen, deniedScreen, loadingScreen } from './ui/login.js?v=2f681d03';
import { resetMotion } from './ui/charts.js?v=2f681d03';

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
  toast(code === 'permission-denied' ? 'Облако не приняло запись: нет прав. Спросите админа' : 'Запись не ушла в облако. Повторите', true);
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
    h('div', { class: 'brand' }, h('span', { class: 'mark' }, 'ATAM'), h('span', {}, 'Sales CRM')),
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
  resetMotion(); // новый экран: графики снова вырастают один раз
  const screen = h('main', { class: 'screen' });
  root.classList.add('signed');
  fill(root, side(name), screen, nav(name));
  update = SCREENS[name](screen);
  scrollTo(0, 0);
}

subscribe(() => {
  if (!S.user) return;
  if (S.denied) { current = ''; update = null; deniedScreen(root, S.email); return; }
  route();
});
addEventListener('hashchange', route);

// Вход: Google или почта с паролем. Почта с паролем сначала подтверждается письмом
let startedFor = '';
async function enter(user) {
  if (startedFor === user.uid) return;
  startedFor = user.uid;
  loadingScreen(root);
  await start(user);
}

onUser((user) => {
  current = '';
  update = null;
  if (!user) { startedFor = ''; stop(); loginScreen(root); return; }
  if (!user.emailVerified) { verifyScreen(root, user, () => enter(user)); return; }
  enter(user);
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
