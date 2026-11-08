// ALSI Продажи: вход, нижнее меню, экраны.
import { login, logout, onUser } from './fb.js?v=5db8579d';
import { S, start, stop, subscribe, setErrorHandler } from './store.js?v=5db8579d';
import { h, icon, fill, toast } from './ui/kit.js?v=5db8579d';
import { mountToday } from './ui/today.js?v=5db8579d';
import { mountShops } from './ui/shops.js?v=5db8579d';
import { mountDebts } from './ui/debts.js?v=5db8579d';
import { mountMore } from './ui/more.js?v=5db8579d';
import { startVisit } from './ui/visit.js?v=5db8579d';

const root = document.getElementById('app');
const SCREENS = { today: mountToday, shops: mountShops, debts: mountDebts, more: mountMore };
let current = '';
let update = null;

setErrorHandler((e) => {
  const code = e && e.code;
  toast(code === 'permission-denied' ? 'Облако не приняло запись: нет прав. Спросите владельца' : 'Запись не ушла в облако. Повторите', true);
});

function nav(active) {
  const a = (id, label, ic) => h('a', { href: '#/' + id, class: active === id ? 'on' : '', 'aria-current': active === id ? 'page' : null }, icon(ic), label);
  return h('nav', { class: 'nav', 'aria-label': 'Разделы' }, h('div', { class: 'in' },
    a('today', 'Сегодня', 'cal'),
    a('shops', 'Точки', 'shop'),
    h('a', { href: '#/visit', class: 'go-wrap', onclick: (e) => { e.preventDefault(); startVisit(); } },
      h('span', { class: 'go' }, icon('pin')), 'Визит'),
    a('debts', 'Долги', 'wallet'),
    a('more', 'Ещё', 'more')));
}

function route() {
  if (!S.ready || S.denied || !S.user) return;
  const id = (location.hash.match(/^#\/(\w+)/) || [])[1];
  const name = SCREENS[id] ? id : 'today';
  if (name === current && update) { update(); return; }
  current = name;
  const screen = h('main', { class: 'screen' });
  fill(root, screen, nav(name));
  update = SCREENS[name](screen);
  scrollTo(0, 0);
}

function loginScreen(text = '') {
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
    h('p', {}, text || 'День торгового: точки, визиты, заказы и долги. Работает и без связи.'),
    btn,
    h('p', { class: 'note' }, 'Вход только для команды ALSI. Почту добавляет владелец.')));
}

function denied() {
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
