// Команда: люди, роли, супервайзер каждого, цифры за месяц. Меняет владелец.
// Роль даёт права. Супервайзер в карточке человека задаёт, чьи записи видит супервайзер.
import { S, all, people, memberName } from '../store.js?v=e63f9436';
import { saveMember, retag } from '../save.js?v=e63f9436';
import { h, icon, fill, sheet, toast, choices, field, inp } from './kit.js?v=e63f9436';
import { head } from './common.js?v=e63f9436';
import { isoDay, monthKey, dayShort } from '../logic/dates.js?v=e63f9436';
import { rub } from '../logic/format.js?v=e63f9436';
import { memberStats } from '../logic/stats.js?v=e63f9436';

export const ROLES = [['sales', 'Торговый'], ['supervisor', 'Супервайзер'], ['owner', 'Владелец']];
export const roleName = (r) => (ROLES.find((x) => x[0] === r) || [, ''])[1];

export function mountTeam(root) {
  const update = () => {
    const month = monthKey(isoDay());
    const list = (S.owner ? S.team.slice() : people()).sort((a, b) => (a.active === false) - (b.active === false) || (a.name || a.id).localeCompare(b.name || b.id, 'ru'));
    const data = { shops: all('shops'), visits: all('visits'), orders: all('orders'), returns: all('returns') };
    fill(root,
      head('Команда', S.owner ? 'Войти могут только почты из списка. Вход через Google' : 'Вы и ваши торговые. Их записи вы только читаете'),
      S.owner ? h('div', { class: 'pad' }, h('button', { class: 'btn navy wide', onclick: () => editMember({ role: 'sales', active: true, lead: '' }) }, 'Добавить человека')) : null,
      h('div', { class: 'gap' }),
      h('div', { class: 'group' }, list.map((m) => {
        const st = memberStats(m.id, data, month);
        return h(S.owner ? 'button' : 'div', { class: 'item', onclick: S.owner ? () => editMember(m) : null },
          icon('team'), h('div', { class: 't' }, h('b', { class: m.active === false ? 'muted' : '' }, m.name || m.id),
            h('small', {}, roleName(m.role) + (m.lead ? ', супервайзер ' + memberName(m.lead) : '') + (m.active === false ? ', вход закрыт' : '')),
            h('small', { class: 'num' }, 'Точек ' + st.shops + ', визитов ' + st.visits + ', заказов ' + st.orders
              + '. За месяц: ' + st.monthPacks + ' уп. напитков, ' + rub(st.monthSum) + (st.lastVisit ? '. Последний визит ' + dayShort(st.lastVisit, isoDay()).toLowerCase() : ''))),
          S.owner ? h('span', { class: 'chev' }, icon('right')) : null);
      })),
      h('div', { class: 'gap' }));
  };
  update();
  return update;
}

function editMember(m) {
  const d = { ...m };
  const isNew = !d.id;
  const self = d.id === S.email;
  const s = sheet({ title: isNew ? 'Новый человек' : d.name || d.id, full: true });
  const sups = S.team.filter((x) => x.role === 'supervisor' && x.active !== false && x.id !== d.id);
  const leadBox = h('div');
  const drawLead = () => fill(leadBox, d.role === 'supervisor' ? h('p', { class: 'hint' }, 'У супервайзера своего супервайзера нет.')
    : [h('div', { class: 'q' }, 'Супервайзер'),
      sups.length ? choices([['', 'Нет'], ...sups.map((x) => [x.id, x.name || x.id])], d.lead || '', (v) => { d.lead = v; }, { col: true })
        : h('p', { class: 'hint' }, 'Супервайзеров пока нет. Назначьте человеку роль «Супервайзер», потом выберите его здесь.')]);
  drawLead();
  s.body.append(
    isNew ? field('Почта Google', inp({ type: 'email', inputmode: 'email', autocomplete: 'off', placeholder: 'name@gmail.com', oninput: (e) => { d.email = e.target.value; } }))
      : h('p', { class: 'muted', style: 'margin-bottom:12px' }, d.id),
    field('Имя', inp({ value: d.name || '', placeholder: 'Имя и фамилия', oninput: (e) => { d.name = e.target.value; } })),
    h('div', { class: 'q' }, 'Роль'),
    self ? h('p', {}, roleName(d.role) + '. Свою роль сменить нельзя.') : choices(ROLES.filter((r) => r[0] !== 'owner'), d.role, (v) => { d.role = v; if (v === 'supervisor') d.lead = ''; drawLead(); }, { col: true }),
    h('p', { class: 'hint', style: 'margin:12px 0' }, 'Торговый видит только свои точки и записи. Супервайзер видит своих торговых, но не меняет их записи. Владелец видит и меняет всё, ведёт каталог и команду.'),
    leadBox,
    self ? null : [h('div', { class: 'q' }, 'Вход'), choices([['yes', 'Открыт'], ['no', 'Закрыт']], d.active === false ? 'no' : 'yes', (v) => { d.active = v === 'yes'; })]);
  s.showFoot(h('button', { class: 'btn navy wide', onclick: async (e) => {
    const email = String(isNew ? d.email || '' : d.id).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Почта выглядит неверно', true); return; }
    if (isNew && S.team.some((x) => x.id === email)) { toast('Эта почта уже в команде', true); return; }
    if (d.lead === email) { toast('Человек не может быть супервайзером самому себе', true); return; }
    const reps = S.team.filter((x) => x.lead === email && x.active !== false);
    if (m.role === 'supervisor' && reps.length && (d.role !== 'supervisor' || d.active === false)) {
      toast('К супервайзеру привязаны: ' + reps.map((x) => x.name || x.id).join(', ') + '. Сначала смените им супервайзера', true); return;
    }
    const lead = d.role === 'supervisor' ? '' : d.lead || '';
    saveMember(email, { name: String(d.name || '').trim() || email, role: self ? m.role : d.role || 'sales', active: self ? true : d.active !== false, lead });
    if (!isNew && (m.lead || '') !== lead) {
      e.currentTarget.disabled = true;
      try { const n = await retag(email, lead); if (n) toast('Записи человека переданы новому супервайзеру: ' + n); } catch (err) { toast('Записи не обновились, нужна связь. Повторите', true); }
    }
    toast(isNew ? 'Добавлен. Пусть войдёт через Google с этой почтой' : 'Сохранено');
    s.close();
  } }, 'Сохранить'));
}
