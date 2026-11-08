// Ещё: план, отчёт, каталог, команда, выход.
import { S, saveProduct, saveMember, subscribe } from '../store.js?v=9020e2e8';
import { h, icon, fill, sheet, toast, ask, choices, field, inp } from './kit.js?v=9020e2e8';
import { head, openPlan } from './common.js?v=9020e2e8';
import { rub, parseMoney, parseCount, norm } from '../logic/format.js?v=9020e2e8';
import { logout } from '../fb.js?v=9020e2e8';
import { openReport } from './report.js?v=9020e2e8';

const ROLES = [['sales', 'Торговый'], ['supervisor', 'Супервайзер'], ['owner', 'Владелец']];
const roleName = (r) => (ROLES.find((x) => x[0] === r) || [, ''])[1];
const LINES = ['Alsi Cola', 'Code Red', 'FIFA', 'Nerve', 'Другое'];

export function mountMore(root) {
  const update = () => {
    const row = (ic, title, sub, fn) => h('button', { class: 'item', onclick: fn }, icon(ic),
      h('div', { class: 't' }, h('b', {}, title), sub ? h('small', {}, sub) : null), h('span', { class: 'chev' }, icon('right')));
    fill(root,
      head('Ещё', (S.me?.name || S.email) + ', ' + roleName(S.role).toLowerCase()),
      h('div', { class: 'group' },
        row('target', 'План месяца', S.lead ? 'Задать план команде' : 'Ваш план в упаковках', () => (S.lead ? openPlan() : toast('План задаёт владелец или супервайзер'))),
        row('chart', 'Отчёт', 'Визиты, заказы, причины отказов. Можно в PDF', () => openReport()),
        row('can', 'Каталог', S.owner ? 'Напитки, упаковки и цены' : 'Напитки и цены', () => openCatalog()),
        S.owner ? row('team', 'Команда', 'Кто входит и с какой ролью', () => openTeam()) : null),
      h('div', { class: 'sec' }, h('h2', {}, 'Связь с облаком')),
      h('div', { class: 'group' }, h('div', { class: 'item' }, icon('cloud'), h('div', { class: 't' },
        h('b', {}, S.online ? 'Связь есть' : 'Нет связи'),
        h('small', {}, 'Записи сначала сохраняются на телефоне, потом уходят в облако сами. Закрывать приложение можно.')))),
      h('div', { class: 'gap' }),
      h('div', { class: 'pad' }, h('button', { class: 'btn line wide', onclick: async () => {
        const ok = await ask('Выйти?', 'Записи, которые ещё не ушли в облако, останутся на телефоне и уйдут после входа.', 'Выйти');
        if (ok) logout();
      } }, icon('door'), 'Выйти')),
      h('p', { class: 'muted pad', style: 'font-size:13px;margin-top:16px' }, 'ALSI Продажи, версия 1.0'));
  };
  update();
  return update;
}

function openCatalog() {
  let off = null;
  const s = sheet({ title: 'Каталог', full: true, onClose: () => off && off() });
  const draw = () => {
    const ps = S.products.filter((p) => !p.deleted).sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.name.localeCompare(b.name, 'ru'));
    const groups = LINES.map((l) => [l, ps.filter((p) => (LINES.includes(p.line) ? p.line : 'Другое') === l)]).filter(([, l]) => l.length);
    fill(s.body,
      S.owner ? h('button', { class: 'btn navy wide', onclick: () => editProduct({ line: 'Alsi Cola', active: true, sort: (ps.length + 1) * 10 }, draw) }, 'Новый напиток') : null,
      groups.length ? groups.map(([line, list]) => [h('div', { class: 'line-h' }, line), h('div', { class: 'group', style: 'margin:0' }, list.map((p) => h(S.owner ? 'button' : 'div', {
        class: 'item', onclick: S.owner ? () => editProduct(p, draw) : null,
      }, h('div', { class: 't' }, h('b', { class: p.active === false ? 'muted' : '' }, p.name + (p.active === false ? ', не продаём' : '')),
        h('small', { class: 'num' }, [p.volumeMl ? p.volumeMl + ' мл' : '', p.perPack ? p.perPack + ' шт. в уп.' : '', p.packPrice && p.perPack ? rub(p.packPrice / p.perPack) + ' за шт.' : ''].filter(Boolean).join(', '))),
      h('span', { class: 'r num' }, p.packPrice ? rub(p.packPrice) : 'нет цены'))))])
        : h('div', { class: 'empty', style: 'margin:16px 0' }, h('b', {}, 'Каталог пуст'), S.owner ? 'Добавьте напитки кнопкой выше.' : 'Напитки добавляет владелец.'));
  };
  draw();
  off = subscribe(draw);
}

function editProduct(p, after) {
  const d = { ...p };
  const s = sheet({ title: d.id ? d.name : 'Новый напиток' });
  const num = (key, label, note) => field(label, inp({ inputmode: 'decimal', value: d[key] ?? '', oninput: (e) => { d[key] = e.target.value; } }), note);
  s.body.append(
    field('Название', inp({ value: d.name || '', oninput: (e) => { d.name = e.target.value; } })),
    h('div', { class: 'q' }, 'Линейка'), choices(LINES.map((l) => [l, l]), d.line, (v) => { d.line = v; }),
    h('div', { class: 'gap' }),
    num('volumeMl', 'Объём, мл'), num('perPack', 'Штук в упаковке'), num('packPrice', 'Цена упаковки, ₽'),
    num('sort', 'Порядок в списке', 'меньше: выше'),
    h('div', { class: 'q' }, 'Продаём сейчас'),
    choices([['yes', 'Да'], ['no', 'Нет, скрыть из заказа']], d.active === false ? 'no' : 'yes', (v) => { d.active = v === 'yes'; }));
  s.showFoot(h('button', { class: 'btn navy wide', onclick: () => {
    const name = String(d.name || '').trim();
    const price = parseMoney(String(d.packPrice ?? '0'));
    const per = parseCount(String(d.perPack ?? ''));
    const vol = parseCount(String(d.volumeMl ?? ''));
    if (!name) { toast('Введите название', true); return; }
    if (Number.isNaN(price) || Number.isNaN(per) || Number.isNaN(vol)) { toast('Объём, штуки и цена: только цифры', true); return; }
    if (!d.id && S.products.some((x) => !x.deleted && norm(x.name) === norm(name))) { toast('Такой напиток уже есть', true); return; }
    saveProduct({ id: d.id, name, line: d.line || 'Другое', volumeMl: vol, perPack: per, packPrice: price, sort: parseCount(String(d.sort ?? '0')) || 0, active: d.active !== false });
    toast('Сохранено. Старые заказы остаются по старой цене');
    s.close();
    after && after();
  } }, 'Сохранить'));
}

function openTeam() {
  let off = null;
  const s = sheet({ title: 'Команда', full: true, onClose: () => off && off() });
  const draw = () => {
    const list = S.team.slice().sort((a, b) => (a.active === false) - (b.active === false) || (a.name || '').localeCompare(b.name || '', 'ru'));
    fill(s.body,
      h('p', { class: 'hint', style: 'margin:0 0 12px' }, 'Войти могут только почты из этого списка. Вход через Google.'),
      h('button', { class: 'btn navy wide', onclick: () => editMember({ role: 'sales', active: true }, draw) }, 'Добавить человека'),
      h('div', { class: 'gap' }),
      h('div', { class: 'group', style: 'margin:0' }, list.map((m) => h('button', { class: 'item', onclick: () => editMember(m, draw) },
        icon('team'), h('div', { class: 't' }, h('b', { class: m.active === false ? 'muted' : '' }, m.name || m.id),
          h('small', {}, m.id + ', ' + roleName(m.role).toLowerCase() + (m.active === false ? ', вход закрыт' : ''))),
        h('span', { class: 'chev' }, icon('right'))))));
  };
  draw();
  off = subscribe(draw);
}

function editMember(m, after) {
  const d = { ...m };
  const isNew = !d.id;
  const self = d.id === S.email;
  const s = sheet({ title: isNew ? 'Новый человек' : d.name || d.id });
  s.body.append(
    isNew ? field('Почта Google', inp({ type: 'email', inputmode: 'email', autocomplete: 'off', placeholder: 'name@gmail.com', oninput: (e) => { d.email = e.target.value; } }))
      : h('p', { class: 'muted', style: 'margin-bottom:12px' }, d.id),
    field('Имя', inp({ value: d.name || '', oninput: (e) => { d.name = e.target.value; } })),
    h('div', { class: 'q' }, 'Роль'),
    self ? h('p', {}, roleName(d.role) + '. Свою роль сменить нельзя.') : choices(ROLES, d.role, (v) => { d.role = v; }, { col: true }),
    h('p', { class: 'hint', style: 'margin:12px 0' }, 'Торговый видит свои визиты и заказы. Супервайзер и владелец видят всё. Владелец меняет каталог и команду.'),
    self ? null : [h('div', { class: 'q' }, 'Вход'), choices([['yes', 'Открыт'], ['no', 'Закрыт']], d.active === false ? 'no' : 'yes', (v) => { d.active = v === 'yes'; })]);
  s.showFoot(h('button', { class: 'btn navy wide', onclick: () => {
    const email = String(isNew ? d.email || '' : d.id).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Почта выглядит неверно', true); return; }
    if (isNew && S.team.some((x) => x.id === email)) { toast('Эта почта уже в команде', true); return; }
    saveMember(email, { name: String(d.name || '').trim() || email, role: d.role || 'sales', active: d.active !== false });
    toast(isNew ? 'Добавлен. Пусть войдёт через Google с этой почтой' : 'Сохранено');
    s.close();
    after && after();
  } }, 'Сохранить'));
}

