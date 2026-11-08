// Ещё: все разделы по группам. На широком экране тот же список стоит в боковой панели.
import { S, pendingCount } from '../store.js?v=79063987';
import { h, icon, fill, ask } from './kit.js?v=79063987';
import { head } from './common.js?v=79063987';
import { logout, logoutClean } from '../fb.js?v=79063987';
import { listDrafts } from './drafts.js?v=79063987';

const ROLE = { owner: 'владелец', supervisor: 'супервайзер', sales: 'торговый' };

export const MENU = () => [
  { title: 'Работа', items: [
    { id: 'today', icon: 'cal', title: 'Сегодня', sub: 'Дела дня, план, долги' },
    { id: 'shops', icon: 'shop', title: 'Точки', sub: 'Список и карта' },
    { id: 'debts', icon: 'wallet', title: 'Долги', sub: 'Кто должен, деньги на руках' },
    { id: 'journal', icon: 'list', title: 'Журнал', sub: 'Визиты, заказы, возвраты' },
    { id: 'drafts', icon: 'edit', title: 'Черновики', sub: listDrafts().length ? 'Незаконченных: ' + listDrafts().length : 'Незаконченные визиты' },
  ] },
  { title: 'Итоги', items: [
    { id: 'plan', icon: 'target', title: 'План', sub: 'Упаковки напитков за месяц' },
    { id: 'stats', icon: 'chart', title: 'Итоги', sub: 'Продажи, отказы, достижения' },
    { id: 'report', icon: 'print', title: 'Отчёт PDF', sub: 'Разделы и даты на выбор' },
  ] },
  { title: 'Справочник', items: [
    { id: 'catalog', icon: 'can', title: 'Каталог', sub: S.owner ? 'Товары, упаковки, цены' : 'Товары и цены' },
    { id: 'script', icon: 'chat', title: 'Скрипт продаж', sub: 'Первый контакт и возражения' },
  ] },
  { title: 'Управление', items: [
    S.lead ? { id: 'team', icon: 'team', title: 'Команда', sub: S.owner ? 'Люди, роли, супервайзеры' : 'Ваши торговые' } : null,
    { id: 'data', icon: 'cloud', title: 'Данные', sub: S.owner ? 'Копия, перенос из программы Атама' : 'Копия, работа без связи' },
  ].filter(Boolean) },
];

export function mountMore(root) {
  const update = () => {
    fill(root,
      head('Ещё', (S.me?.name || S.email) + ', ' + (ROLE[S.role] || '')),
      MENU().map((g) => [
        h('div', { class: 'sec' }, h('h2', {}, g.title)),
        h('div', { class: 'group' }, g.items.filter((i) => !['today', 'shops', 'debts'].includes(i.id)).map((i) => h('a', { class: 'item', href: '#/' + i.id },
          icon(i.icon), h('div', { class: 't' }, h('b', {}, i.title), h('small', {}, i.sub)), h('span', { class: 'chev' }, icon('right')))))]),
      h('div', { class: 'gap' }),
      h('div', { class: 'pad' }, h('button', { class: 'btn line wide', onclick: async () => {
        const n = pendingCount();
        if (n > 0) {
          const ok = await ask('Выйти?', 'Ещё ' + n + ' записей не ушли в облако. Они останутся на телефоне и уйдут после входа этой же почтой.', 'Выйти');
          if (ok) logout();
          return;
        }
        if (await ask('Выйти?', 'Все записи в облаке. Копия базы на этом телефоне сотрётся, чтобы её не увидел другой человек.', 'Выйти')) logoutClean();
      } }, icon('door'), 'Выйти')),
      h('p', { class: 'muted pad', style: 'font-size:13px;margin-top:16px' }, 'ALSI Продажи, версия 2.0'));
  };
  update();
  return update;
}
