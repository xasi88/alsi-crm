// Черновики визитов и заказов. Хранятся только на этом телефоне, отдельно у каждого человека.
// Черновик не визит: он не попадает в отчёты, пока его не сохранили.
import { S, shopById } from '../store.js?v=d38d063e';
import { h, icon, fill, toast, ask } from './kit.js?v=d38d063e';
import { head } from './common.js?v=d38d063e';
import { dayShort, isoDay } from '../logic/dates.js?v=d38d063e';
import { resumeDraft } from './visit.js?v=d38d063e';

const KEEP = 7 * 24 * 3600e3; // неделя
const key = () => 'alsi-drafts-' + S.email;

export function listDrafts() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(key()) || '[]'); } catch (e) { list = []; }
  return (Array.isArray(list) ? list : []).filter((x) => x && x.id && Date.now() - x.savedAt < KEEP)
    .sort((a, b) => b.savedAt - a.savedAt);
}

function write(list) {
  try { localStorage.setItem(key(), JSON.stringify(list)); } catch (e) { /* нет места: черновик не сохранён */ }
}

export function keepDraft(draft) {
  const list = listDrafts().filter((x) => x.id !== draft.id);
  list.unshift({ ...draft, savedAt: Date.now() });
  write(list.slice(0, 20));
}

export const dropDraft = (id) => write(listDrafts().filter((x) => x.id !== id));
export const draftById = (id) => listDrafts().find((x) => x.id === id) || null;
// Незаконченный визит этой точки
export const draftFor = (mode, shopId) => listDrafts().find((x) => x.mode === mode && x.d?.shopId === shopId) || null;

const what = (x) => (x.mode === 'order' ? 'Заказ' : x.mode === 'return' ? 'Возврат' : 'Визит');

export function mountDrafts(root) {
  const update = () => {
    const list = listDrafts();
    fill(root,
      head('Черновики', 'Незаконченные визиты и заказы на этом телефоне. Хранятся неделю'),
      list.length ? h('div', { class: 'group' }, list.map((x) => {
        const shop = shopById(x.d?.shopId);
        return h('div', { class: 'item' },
          h('button', { class: 't', style: 'text-align:left;min-height:48px', onclick: () => resumeDraft(x.id) },
            h('b', {}, what(x) + ': ' + (shop?.name || x.shopName || 'точка не выбрана')),
            h('small', {}, 'Изменён ' + dayShort(isoDay(new Date(x.savedAt)), isoDay()).toLowerCase() + ', ' + new Date(x.savedAt).toTimeString().slice(0, 5))),
          h('button', { class: 'btn navy small', onclick: () => resumeDraft(x.id) }, 'Продолжить'),
          h('button', { class: 'ib white', 'aria-label': 'Удалить черновик', onclick: async () => {
            if (await ask('Удалить черновик?', 'Введённое в нём пропадёт.', 'Удалить', true)) { dropDraft(x.id); toast('Черновик удалён'); update(); }
          } }, icon('trash')));
      })) : h('div', { class: 'empty' }, h('b', {}, 'Черновиков нет'), 'Если закрыть визит до сохранения, он появится здесь.'),
      h('div', { class: 'gap' }));
  };
  update();
  return update;
}

// Полоса на главной: есть незаконченный визит
export function draftBanner() {
  const list = listDrafts();
  if (!list.length) return null;
  const x = list[0];
  const shop = shopById(x.d?.shopId);
  return h('a', { class: 'banner', href: '#/drafts' }, icon('edit'),
    h('div', { class: 't' }, h('b', {}, list.length === 1 ? 'Незаконченный ' + what(x).toLowerCase() : 'Черновиков: ' + list.length),
      h('small', {}, shop?.name || 'Нажмите, чтобы продолжить')), icon('right'));
}
