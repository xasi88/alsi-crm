// Команда: люди, роли, супервайзер каждого, цифры за месяц. Меняет админ.
// Роль даёт права. Супервайзер в карточке человека задаёт, чьи записи видит супервайзер.
// Главный админ (почта автора в правилах базы) меняет всех. Другой админ: только торговых и супервайзеров.
import { S, all, people, memberName } from '../store.js?v=7a9cd2c1';
import { saveMember, retag } from '../save.js?v=7a9cd2c1';
import { h, icon, fill, sheet, toast, choices, field, inp } from './kit.js?v=7a9cd2c1';
import { inviteText, normEmail, validEmail } from '../logic/auth.js?v=7a9cd2c1';
import { head } from './common.js?v=7a9cd2c1';
import { isoDay, monthKey, dayShort } from '../logic/dates.js?v=7a9cd2c1';
import { rub } from '../logic/format.js?v=7a9cd2c1';
import { memberStats } from '../logic/stats.js?v=7a9cd2c1';

export const ROLES = [['sales', 'Торговый'], ['supervisor', 'Супервайзер'], ['owner', 'Админ']];
export const roleName = (r) => (ROLES.find((x) => x[0] === r) || [, ''])[1];

// Кого может менять этот админ
const canManage = (m) => S.owner && (S.main || m.role !== 'owner');

export function mountTeam(root) {
  const update = () => {
    const month = monthKey(isoDay());
    const list = (S.owner ? S.team.slice() : people()).sort((a, b) => (a.active === false) - (b.active === false) || (a.name || a.id).localeCompare(b.name || b.id, 'ru'));
    const data = { shops: all('shops'), visits: all('visits'), orders: all('orders'), returns: all('returns') };
    fill(root,
      head('Команда', S.owner ? 'Войти могут только почты из списка: по паролю или через Google' : 'Вы и ваши торговые. Их записи вы только читаете'),
      S.owner ? h('div', { class: 'pad' }, h('button', { class: 'btn navy wide', onclick: () => editMember({ role: 'sales', active: true, lead: '' }) }, 'Добавить человека')) : null,
      h('div', { class: 'gap' }),
      h('div', { class: 'group' }, list.map((m) => {
        const st = memberStats(m.id, data, month);
        const edit = canManage(m);
        return h(edit ? 'button' : 'div', { class: 'item', onclick: edit ? () => editMember(m) : null },
          icon('team'), h('div', { class: 't' }, h('b', { class: m.active === false ? 'muted' : '' }, m.name || m.id),
            h('small', {}, roleName(m.role) + (m.lead ? ', супервайзер ' + memberName(m.lead) : '') + (m.active === false ? ', вход закрыт' : '')),
            h('small', { class: 'num' }, 'Точек ' + st.shops + ', визитов ' + st.visits + ', заказов ' + st.orders
              + '. За месяц: ' + st.monthPacks + ' уп. напитков, ' + rub(st.monthSum) + (st.lastVisit ? '. Последний визит ' + dayShort(st.lastVisit, isoDay()).toLowerCase() : ''))),
          edit ? h('span', { class: 'chev' }, icon('right')) : null);
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
  const sups = S.team.filter((x) => (x.role === 'supervisor' || x.role === 'owner') && x.active !== false && x.id !== d.id);
  const leadBox = h('div');
  const drawLead = () => fill(leadBox, d.role !== 'sales' ? h('p', { class: 'hint' }, d.role === 'owner' ? 'Админ видит всю команду, супервайзер ему не нужен.' : 'У супервайзера своего супервайзера нет.')
    : [h('div', { class: 'q' }, 'Супервайзер'),
      sups.length ? choices([['', 'Нет'], ...sups.map((x) => [x.id, (x.name || x.id) + (x.role === 'owner' ? ', админ' : '')])], d.lead || '', (v) => { d.lead = v; }, { col: true })
        : h('p', { class: 'hint' }, 'Супервайзеров пока нет. Назначьте человеку роль «Супервайзер», потом выберите его здесь.')]);
  drawLead();
  s.body.append(
    isNew ? [field('Почта', inp({ type: 'email', inputmode: 'email', autocomplete: 'off', autocapitalize: 'off', placeholder: 'name@mail.ru', oninput: (e) => { d.email = e.target.value; } })),
      h('p', { class: 'hint', style: 'margin:-8px 0 16px' }, 'Любая почта: Gmail, Яндекс, mail.ru. Человек сам придумает пароль при первом входе. С почтой Gmail можно входить и через Google.')]
      : [h('p', { class: 'muted', style: 'margin-bottom:12px' }, d.id),
        h('button', { class: 'btn line wide', style: 'margin-bottom:16px', onclick: () => s.close().then(() => invite(d)) }, icon('chat'), 'Поделиться приглашением')],
    field('Имя', inp({ value: d.name || '', placeholder: 'Имя и фамилия', oninput: (e) => { d.name = e.target.value; } })),
    h('div', { class: 'q' }, 'Роль'),
    self ? h('p', {}, roleName(d.role) + '. Свою роль сменить нельзя.') : choices(ROLES.filter((r) => S.main || r[0] !== 'owner'), d.role, (v) => { d.role = v; if (v !== 'sales') d.lead = ''; drawLead(); }, { col: true }),
    h('p', { class: 'hint', style: 'margin:12px 0' }, 'Торговый видит только свои точки и записи. Супервайзер видит своих торговых, но не меняет их записи. Админ видит и меняет всё, ведёт каталог и команду.' + (S.main ? '' : ' Роль «Админ» даёт главный админ.')),
    leadBox,
    self ? null : [h('div', { class: 'q' }, 'Вход'), choices([['yes', 'Открыт'], ['no', 'Закрыт']], d.active === false ? 'no' : 'yes', (v) => { d.active = v === 'yes'; })]);
  s.showFoot(h('button', { class: 'btn navy wide', onclick: async (e) => {
    const email = normEmail(isNew ? d.email : d.id);
    if (!validEmail(email)) { toast('Почта выглядит неверно. Пример: name@mail.ru', true); return; }
    if (isNew && S.team.some((x) => x.id === email)) { toast('Эта почта уже в команде', true); return; }
    if (d.lead === email) { toast('Человек не может быть супервайзером самому себе', true); return; }
    const reps = S.team.filter((x) => x.lead === email && x.active !== false);
    if (reps.length && (d.role === 'sales' || d.active === false)) {
      toast('К супервайзеру привязаны: ' + reps.map((x) => x.name || x.id).join(', ') + '. Сначала смените им супервайзера', true); return;
    }
    const lead = d.role === 'sales' ? d.lead || '' : '';
    saveMember(email, { name: String(d.name || '').trim() || email, role: self ? m.role : d.role || 'sales', active: self ? true : d.active !== false, lead });
    if (!isNew && (m.lead || '') !== lead) {
      e.currentTarget.disabled = true;
      try { const n = await retag(email, lead); if (n) toast('Записи человека переданы новому супервайзеру: ' + n); } catch (err) { toast('Записи не обновились, нужна связь. Повторите', true); }
    }
    if (isNew) { toast('Добавлен'); s.close().then(() => invite({ ...d, id: email })); return; }
    toast('Сохранено');
    s.close();
  } }, 'Сохранить'));
}

// Приглашение: готовый текст со ссылкой и шагами. Отправляет сам админ (WhatsApp, Telegram)
function invite(m) {
  const text = inviteText({ name: m.name || '', email: m.id || m.email });
  const s = sheet({ title: 'Приглашение', sub: m.name || m.id });
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast('Текст скопирован. Вставьте его в WhatsApp'); } catch (e) { toast('Не скопировалось. Выделите текст пальцем', true); }
  };
  s.body.append(h('p', { class: 'hint', style: 'margin-bottom:12px' }, 'Отправьте человеку этот текст. По нему он сам войдёт в приложение.'),
    h('pre', { class: 'invite' }, text));
  s.showFoot(h('div', { class: 'btns' },
    h('button', { class: 'btn line', onclick: copy }, 'Скопировать'),
    navigator.share ? h('button', { class: 'btn navy', onclick: () => navigator.share({ text }).catch(() => {}) }, icon('chat'), 'Отправить') : null));
}
